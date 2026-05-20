import type { Request, Response } from "express";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3Client, { BUCKET_NAME } from "../config/s3Config.ts";
import { conversation_messages, projects, rfis, snags, users } from "../models/index.ts";
import { getIO } from "../socket.ts";
import { sendNotification } from "../utils/notificationUtils.ts";

const AUDIO_SIZE_LIMIT = 10 * 1024 * 1024;

const resolveItemConfig = (itemType: "rfi" | "snag") => {
  if (itemType === "rfi") {
    return {
      model: rfis,
      closedStatuses: ["closed"],
      socketEvent: "rfi-conversation-message",
      notFoundMessage: "RFI not found",
    };
  }

  return {
    model: snags,
    closedStatuses: ["green"],
    socketEvent: "snag-conversation-message",
    notFoundMessage: "Snag not found",
  };
};

const canParticipate = (item: any, userId: number) =>
  Number(item.created_by) === Number(userId) || Number(item.assigned_to) === Number(userId);

const toMessageJson = async (message: any) => {
  const json = message.toJSON ? message.toJSON() : { ...message };

  if (json.file_url) {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: json.file_url,
      });
      json.downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    } catch {
      json.downloadUrl = null;
    }
  } else {
    json.downloadUrl = null;
  }

  return json;
};

const parseItemType = (rawType?: string): "rfi" | "snag" | null => {
  if (rawType === "rfi" || rawType === "snag") return rawType;
  return null;
};

const getValidatedItem = async (itemType: "rfi" | "snag", itemId: number, authUser: any) => {
  const config = resolveItemConfig(itemType);
  const item = await config.model.findByPk(itemId);

  if (!item) {
    return { error: config.notFoundMessage, status: 404 as const };
  }

  const project = await projects.findByPk(item.project_id);
  if (!project) {
    return { error: "Project not found", status: 404 as const };
  }

  const isParticipant = canParticipate(item, authUser.user_id);

  if (!isParticipant) {
    return { error: "Forbidden", status: 403 as const };
  }

  return { item, project, config };
};

export const getConversationMessages = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    if (!authUser) return res.status(401).json({ error: "Unauthorized" });

    const itemType = parseItemType(req.params.itemType as string);
    const itemId = Number(req.params.id);

    if (!itemType || !Number.isFinite(itemId)) {
      return res.status(400).json({ error: "Invalid item reference" });
    }

    const validated = await getValidatedItem(itemType, itemId, authUser);
    if ("error" in validated) {
      return res.status(validated.status as number).json({ error: validated.error });
    }

    const messages = await conversation_messages.findAll({
      where: { item_type: itemType, item_id: itemId },
      include: [{ model: users, as: "sender", attributes: ["id", "name", "role", "profile_pic"] }],
      order: [["createdAt", "ASC"]],
    });

    const serialized = await Promise.all(messages.map(toMessageJson));
    res.json({ messages: serialized });
  } catch (err) {
    console.error("getConversationMessages error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createConversationMessage = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    if (!authUser) return res.status(401).json({ error: "Unauthorized" });

    const itemType = parseItemType(req.params.itemType as string);
    const itemId = Number(req.params.id);
    if (!itemType || !Number.isFinite(itemId)) {
      return res.status(400).json({ error: "Invalid item reference" });
    }

    const validated = await getValidatedItem(itemType, itemId, authUser);
    if ("error" in validated) {
      return res.status(validated.status as number).json({ error: validated.error });
    }

    const { item, config } = validated;

    if (!canParticipate(item, authUser.user_id)) {
      return res.status(403).json({ error: "Only the creator and assignee can send messages" });
    }

    if (config.closedStatuses.includes(String(item.status))) {
      return res.status(400).json({ error: "Messages are disabled for closed items" });
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    const rawText = typeof req.body?.text === "string" ? req.body.text.trim() : "";

    if (!rawText && !file) {
      return res.status(400).json({ error: "Text or one attachment is required" });
    }

    if (file && file.mimetype.startsWith("audio/") && file.size > AUDIO_SIZE_LIMIT) {
      return res.status(400).json({ error: "Voice note exceeds the maximum allowed duration of 5 minutes." });
    }

    let attachmentType: "image" | "audio" | null = null;
    let file_url: string | null = null;
    let file_name: string | null = null;
    let file_type: string | null = null;
    let file_size: string | null = null;

    if (file) {
      if (file.mimetype.startsWith("image/")) {
        attachmentType = "image";
      } else if (file.mimetype.startsWith("audio/")) {
        attachmentType = "audio";
      } else {
        return res.status(400).json({ error: "Only image and audio attachments are supported" });
      }

      file_name = file.originalname;
      file_type = file.mimetype;
      file_size = `${(file.size / 1024).toFixed(2)} KB`;

      const extMatch = file.originalname.match(/\.[0-9a-z]+$/i);
      const extension = extMatch ? extMatch[0] : attachmentType === "audio" ? ".m4a" : ".jpg";
      file_url = `projects/${item.project_id}/${itemType}/conversations/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extension}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: file_url,
          ContentType: file.mimetype,
          Body: file.buffer,
        })
      );
    }

    const message = await conversation_messages.create({
      item_type: itemType,
      item_id: itemId,
      project_id: item.project_id,
      sender_id: authUser.user_id,
      text: rawText || null,
      attachment_type: attachmentType,
      file_url,
      file_name,
      file_type,
      file_size,
    });

    const fullMessage = await conversation_messages.findByPk(message.id, {
      include: [{ model: users, as: "sender", attributes: ["id", "name", "role", "profile_pic"] }],
    });

    const serialized = await toMessageJson(fullMessage || message);

    try {
      getIO().to(`project-${item.project_id}`).emit(config.socketEvent, {
        itemType,
        itemId,
        message: serialized,
      });
    } catch (socketErr) {
      console.error("conversation socket emit error:", socketErr);
    }

    // Notify other participants in the conversation
    try {
      const recipientIds = new Set<number>();
      
      if (item.created_by && Number(item.created_by) !== Number(authUser.user_id)) {
        recipientIds.add(Number(item.created_by));
      }
      
      if (item.assigned_to && Number(item.assigned_to) !== Number(authUser.user_id)) {
        recipientIds.add(Number(item.assigned_to));
      }

      const senderName = authUser.name || "Someone";
      const snippet = rawText 
        ? (rawText.length > 60 ? rawText.substring(0, 60) + "..." : rawText) 
        : (attachmentType === "audio" ? "sent a voice note" : "sent an image");

      for (const recipientId of recipientIds) {
        await sendNotification({
          userId: recipientId,
          title: itemType === "rfi" ? "New RFI Message" : "New Snag Message",
          body: `${senderName}: ${snippet}`,
          type: itemType === "rfi" ? "rfi_comment" : "snag_comment",
          data: {
            projectId: String(item.project_id),
            type: itemType === "rfi" ? "rfi" : "snags",
            [itemType === "rfi" ? "rfiId" : "snagId"]: String(itemId),
          },
          projectId: item.project_id,
        });
      }
    } catch (notifErr) {
      console.error("Error sending conversation message notification:", notifErr);
    }

    res.status(201).json({ message: serialized });
  } catch (err) {
    console.error("createConversationMessage error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
