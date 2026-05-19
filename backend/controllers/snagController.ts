import type { Request, Response } from "express";
import s3Client, { BUCKET_NAME } from "../config/s3Config.ts";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Op } from "sequelize";
import sharp from "sharp";
import { addWatermark } from "../utils/watermark.ts";
import {
  snags,
  users,
  project_members,
  activities,
  projects,
  folders,
  sequelize,
} from "../models/index.ts";
import { sendNotification } from "../utils/notificationUtils.ts";
import { logActivity } from "../utils/activityUtils.ts";

// Helper: generate presigned URL for a snag photo
const withPresignedUrl = async (snag: any) => {
  const json = snag.toJSON ? snag.toJSON() : { ...snag };
  if (json.photo_url) {
    try {
      const cmd = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: json.photo_url,
      });
      json.photoDownloadUrl = await getSignedUrl(s3Client, cmd, {
        expiresIn: 3600,
      });
    } catch {
      json.photoDownloadUrl = null;
    }
  }

  if (json.audio_url) {
    try {
      const cmd = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: json.audio_url,
      });
      json.audioDownloadUrl = await getSignedUrl(s3Client, cmd, {
        expiresIn: 3600,
      });
    } catch {
      json.audioDownloadUrl = null;
    }
  } else {
    json.audioDownloadUrl = null;
  }

  if (json.response_photos && Array.isArray(json.response_photos)) {
    try {
      json.responsePhotoUrls = await Promise.all(
        json.response_photos.map(async (key: string) => {
          const cmd = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
          });
          return await getSignedUrl(s3Client, cmd, {
            expiresIn: 3600,
          });
        })
      );
    } catch {
      json.responsePhotoUrls = [];
    }
  } else {
    json.responsePhotoUrls = [];
  }

  if (json.folder_ids && Array.isArray(json.folder_ids) && json.folder_ids.length > 0) {
    try {
      json.linked_folders = await folders.findAll({
        where: { id: json.folder_ids },
        attributes: ['id', 'name', 'folder_type']
      });
    } catch {
      json.linked_folders = [];
    }
  } else {
    json.linked_folders = [];
  }

  return json;
};

// GET /snags?project_id=X  — list snags for a project
export const getSnags = async (req: Request, res: Response) => {
  try {
    const { project_id } = req.query;
    if (!project_id)
      return res.status(400).json({ error: "project_id is required" });

    const data = await snags.findAll({
      where: { project_id: Number(project_id) },
      attributes: [
        "id", "project_id", "title", "description", "photo_url", "audio_url",
        "assigned_to", "status", "response", "response_photos", 
        "created_by", "createdAt", "updatedAt", "seen_at", "folder_ids"
      ],
      include: [
        { model: users, as: "assignee", attributes: ["id", "name", "email"] },
        { model: users, as: "creator", attributes: ["id", "name"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    const result = await Promise.all(data.map(withPresignedUrl));
    res.json({ snags: result });
  } catch (err) {
    console.error("getSnags error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// POST /snags  — create a snag (with optional photo upload)
export const createSnag = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    if (!authUser) return res.status(401).json({ error: "Unauthorized" });

    const { project_id, title, description, assigned_to, folder_ids } = req.body;
    if (!project_id || !title)
      return res
        .status(400)
        .json({ error: "project_id and title are required" });
    if (!assigned_to)
      return res.status(400).json({ error: "Assignee is required" });
    const files = ((req as any).files || {}) as Record<string, Express.Multer.File[]>;
    const photoFile = files.photo?.[0];
    const audioFile = files.audio?.[0];

    if (!photoFile)
      return res.status(400).json({ error: "Photo is required" });
    const project = await projects.findByPk(project_id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    let photo_url: string | null = null;
    let audio_url: string | null = null;

    if (audioFile && audioFile.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: "Voice note exceeds the maximum allowed duration of 5 minutes." });
    }

    if (photoFile) {
      let fileBuffer = photoFile.buffer;
      let ext = photoFile.originalname.match(/\.[0-9a-z]+$/i)?.[0] || ".jpg";

      if (photoFile.mimetype.startsWith("image/")) {
        try {
          const senderName = authUser.name || "Someone";
          fileBuffer = await addWatermark(photoFile.buffer, project.name, senderName);
          ext = ".jpg";
        } catch (e) {
          console.error("Sharp error in snag", e);
        }
      }

      const key = `projects/${project_id}/snags/${Date.now()}${ext}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          ContentType: photoFile.mimetype,
          Body: fileBuffer,
        }),
      );
      photo_url = key;
    }

    if (audioFile) {
      const ext = audioFile.originalname.match(/\.[0-9a-z]+$/i)?.[0] || ".m4a";
      const key = `projects/${project_id}/snags/audio/${Date.now()}${ext}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          ContentType: audioFile.mimetype,
          Body: audioFile.buffer,
        }),
      );
      audio_url = key;
    }

    let parsedFolderIds: number[] = [];
    if (folder_ids) {
      if (Array.isArray(folder_ids)) {
        parsedFolderIds = folder_ids.map(Number);
      } else if (typeof folder_ids === 'string') {
        parsedFolderIds = folder_ids.split(',').map((s: any) => Number(s.trim())).filter((n: any) => !isNaN(n));
      }
    }

    const snag = await snags.create({
      project_id: Number(project_id),
      title: title.trim(),
      description: description?.trim() || null,
      photo_url,
      audio_url,
      assigned_to: assigned_to ? Number(assigned_to) : null,
      status: "amber",
      created_by: authUser.user_id,
      folder_ids: parsedFolderIds,
    });

    await logActivity({
      projectId: Number(project_id),
      userId: authUser.user_id,
      type: "edit",
      description: `Added snag "${title.trim()}"`,
      metadata: { snagId: snag.id, type: 'snags' },
      skipNotifications: true
    });

    // Notify assignee if they belong to this project.
    if (assigned_to) {
      const recipient = await project_members.findOne({
        where: { project_id: Number(project_id), user_id: Number(assigned_to) },
      });

      if (recipient) {
        const senderName = authUser.name || "Someone";
        await sendNotification({
          userId: Number(assigned_to),
          title: "New Snag Assigned",
          body: `${senderName} assigned a new snag to you: ${title}`,
          type: "snag_assigned",
          data: { snagId: String(snag.id), projectId: String(project_id), type: 'snags' },
        });
      }
    }

    // Notify admins for the project's organization.
    try {
      const admins = await users.findAll({
        where: {
          organization_id: project.organization_id,
          role: "admin",
          id: {
            [Op.notIn]: [authUser.user_id, Number(assigned_to)].filter(Boolean),
          },
        },
      });

      for (const adminUser of admins) {
        await sendNotification({
          userId: adminUser.id,
          title: "New Snag Created",
          body: `${authUser.name} created a new snag: ${title}`,
          type: "snag_creation_admin",
          data: { snagId: String(snag.id), projectId: String(project_id), type: 'snags' },
        });
      }
    } catch (err) {
      console.error("Error notifying admins of new snag:", err);
    }

    const full = await snags.findByPk((snag as any).id, {
      attributes: [
        "id", "project_id", "title", "description", "photo_url", 
        "audio_url",
        "assigned_to", "status", "response", "response_photos", 
        "created_by", "createdAt", "updatedAt", "folder_ids"
      ],
      include: [
        { model: users, as: "assignee", attributes: ["id", "name"] },
        { model: users, as: "creator", attributes: ["id", "name"] },
      ],
    });
    res.status(201).json({ snag: await withPresignedUrl(full!) });
  } catch (err) {
    console.error("createSnag error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PATCH /snags/:id/status  — cycle status
export const updateSnagStatus = async (req: Request | any, res: Response) => {
  try {
    const authUser = (req as any).user;
    const { id } = req.params;
    const { status } = req.body;
    const valid = ["amber", "green", "red"];
    if (!valid.includes(status))
      return res.status(400).json({ error: "Invalid status" });

    const snag = await snags.findByPk(id);
    if (!snag) return res.status(404).json({ error: "Snag not found" });

    // Only the assigned user can change the status
    if (Number(snag.assigned_to) !== Number(authUser.user_id)) {
      return res.status(403).json({ error: "Only the assigned person can update the status" });
    }

    (snag as any).status = status;

    const { response } = req.body;
    if (response !== undefined) (snag as any).response = response;

    const { removedPhotos } = req.body;
    let currentResponsePhotos: string[] = snag.response_photos || [];

    // 1. Handle explicit removals
    if (removedPhotos) {
      let toRemove: string[] = [];
      if (Array.isArray(removedPhotos)) toRemove = removedPhotos;
      else if (typeof removedPhotos === 'string') {
        if (removedPhotos.startsWith('[') && removedPhotos.endsWith(']')) {
          try { toRemove = JSON.parse(removedPhotos); } catch (e) { toRemove = [removedPhotos]; }
        } else {
          toRemove = removedPhotos.split(',').map(s => s.trim());
        }
      }
      currentResponsePhotos = currentResponsePhotos.filter(p => !toRemove.includes(p));
    }

    // 2. Handle new uploads with Smart Replace
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const hasNewAudio = req.files.some((f:any) => f.mimetype.startsWith('audio/'));
      const hasNewImage = req.files.some((f:any) => f.mimetype.startsWith('image/'));
      const imageCount = req.files.filter((f:any) => f.mimetype.startsWith('image/')).length;
      const audioCount = req.files.filter((f:any) => f.mimetype.startsWith('audio/')).length;

      if (imageCount > 1 || audioCount > 1) {
        return res.status(400).json({ error: 'Snag responses support only one image and one voice note.' });
      }

      // If new audio is being uploaded, remove existing audio from the response
      if (hasNewAudio) {
        currentResponsePhotos = currentResponsePhotos.filter((p:any) => {
          const isAudio = p.match(/\.(m4a|webm|mp3|wav|aac|ogg|3gp|caf)(\?.*)?$/i);
          return !isAudio;
        });
      }

      // If new image is being uploaded, remove existing images from the response
      if (hasNewImage) {
        currentResponsePhotos = currentResponsePhotos.filter((p:any) => {
          const isImage = p.match(/\.(jpg|jpeg|png|gif|webp|heic)(\?.*)?$/i);
          return !isImage;
        });
      }

      const project = await projects.findByPk(snag.project_id);
      for (const file of req.files) {
        if (file.mimetype.startsWith('audio/') && file.size > 10 * 1024 * 1024) {
          return res.status(400).json({ error: "Voice note exceeds the maximum allowed duration of 5 minutes." });
        }

        let fileBuffer = file.buffer;
        if (file.mimetype.startsWith('image/')) {
          try {
            const senderName = authUser.name || 'Someone';
            fileBuffer = await addWatermark(file.buffer, project?.name || 'Apexis', senderName);
          } catch (err) {
            console.error('Watermarking failed for snag response photo:', err);
          }
        }

        const ext = file.originalname.match(/\.[0-9a-z]+$/i)?.[0] || '.jpg';
        const key = `projects/${snag.project_id}/snags/responses/${Date.now()}_${Math.random().toString(36).substr(2, 5)}${ext}`;
        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          ContentType: file.mimetype,
          Body: fileBuffer,
        }));
        currentResponsePhotos.push(key);
      }
    }
    
    (snag as any).response_photos = currentResponsePhotos;

    await snag.save();

    if (authUser) {
      await logActivity({
        projectId: (snag as any).project_id,
        userId: authUser.user_id,
        type: "edit",
        description: `Updated status for snag "${(snag as any).title}"`,
        metadata: { snagId: snag.id, type: 'snags' },
        skipNotifications: true
      });
    }
    res.json({ snag: await withPresignedUrl(snag) });

    // Notify assignee and creator if status changed by someone else
    const notifyIds = new Set<number>();
    if (snag.assigned_to && snag.assigned_to !== authUser.user_id)
      notifyIds.add(snag.assigned_to);
    if (snag.created_by && snag.created_by !== authUser.user_id)
      notifyIds.add(snag.created_by);

    if (notifyIds.size > 0) {
      const validRecipients = await project_members.findAll({
        where: {
          project_id: Number(snag.project_id),
          user_id: { [Op.in]: Array.from(notifyIds) },
        },
        attributes: ["user_id"],
      });

      const senderName = authUser.name || "Someone";
      const statusLabels: Record<string, string> = {
        amber: "Waiting for Clearance",
        green: "Completed",
        red: "No Action Required",
      };
      const friendlyStatus = statusLabels[status as string] || status;

      for (const recipient of validRecipients) {
        await sendNotification({
          userId: Number((recipient as any).user_id),
          title: "Snag Status Updated",
          body: `${senderName} updated status to ${friendlyStatus} for snag: ${snag.title}`,
          type: "snag_status_update",
          data: { snagId: String(snag.id), projectId: String(snag.project_id), type: 'snags' },
        });
      }
    }
  } catch (err) {
    console.error("updateSnagStatus error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PATCH /snags/:id/seen — mark snag as seen by the assignee
export const markSnagSeen = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    const { id } = req.params;

    const snag = await snags.findByPk(id);
    if (!snag) return res.status(404).json({ error: 'Snag not found' });

    // Only the assignee can mark as seen
    if (Number(snag.assigned_to) !== Number(authUser.user_id)) {
      return res.status(403).json({ error: 'Only the assignee can mark as seen' });
    }

    // Only mark seen once (first open)
    if (!(snag as any).seen_at) {
      (snag as any).seen_at = new Date();
      await snag.save();

      // Emit real-time event to the project room
      try {
        const { getIO } = await import('../socket.ts');
        getIO().to(`project-${(snag as any).project_id}`).emit('snag-seen', {
          snagId: Number(id),
          seen_at: (snag as any).seen_at,
          project_id: (snag as any).project_id,
        });
      } catch (e) {
        console.error('Socket emit error (markSnagSeen):', e);
      }
    }

    res.json({ seen_at: (snag as any).seen_at });
  } catch (err) {
    console.error('markSnagSeen error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /snags/:id
export const deleteSnag = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    const { id } = req.params;
    const snag = await snags.findByPk(id);
    if (!snag) return res.status(404).json({ error: "Snag not found" });

    if (
      authUser.role !== "admin" &&
      authUser.role !== "superadmin" &&
      (snag as any).created_by !== authUser.user_id
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (snag.response) {
      return res.status(400).json({ error: "Cannot delete snag because a response has already been generated" });
    }

    await snag.destroy();

    await logActivity({
      projectId: snag.project_id,
      userId: authUser.user_id,
      type: "edit",
      description: `Moved snag "${snag.title}" to trash`,
      metadata: { snagId: id, type: 'snags' },
      skipNotifications: true
    });

    res.json({ message: "Moved to trash" });
  } catch (err) {
    console.error("deleteSnag error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /snags/assignees?project_id=X  — non-client project members
export const getAssignees = async (req: Request, res: Response) => {
  try {
    const { project_id } = req.query;
    if (!project_id)
      return res.status(400).json({ error: "project_id is required" });

    const project = await projects.findByPk(Number(project_id));
    if (!project) return res.status(404).json({ error: "Project not found" });

    const members = await project_members.findAll({
      where: { project_id: Number(project_id) },
      include: [
        {
          model: users,
          attributes: ["id", "name", "email", "role"],
          where: {
            role: { [Op.ne]: "client" },
          },
          required: true,
        },
      ],
      attributes: [],
    });

    const memberAssignees = members.map((m: any) => {
      const u = m.user ?? m.dataValues?.user;
      return u?.toJSON ? u.toJSON() : u;
    });

    const projectAdmins = await users.findAll({
      where: {
        organization_id: project.organization_id,
        role: "admin",
      },
      attributes: ["id", "name", "email", "role"],
    });

    const assignees = [
      ...memberAssignees,
      ...projectAdmins.map((admin: any) =>
        admin.toJSON ? admin.toJSON() : admin,
      ),
    ].filter(
      (candidate: any, index: number, all: any[]) =>
        candidate?.id &&
        all.findIndex(
          (item: any) => Number(item?.id) === Number(candidate.id),
        ) === index,
    );

    res.json({ assignees });
  } catch (err) {
    console.error("getAssignees error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PATCH /snags/:id
export const updateSnag = async (req: Request | any, res: Response) => {
  try {
    const authUser = (req as any).user;
    const { id } = req.params;
    const { title, description, assigned_to, remove_audio, folder_ids } = req.body;

    const snag = await snags.findByPk(id);
    if (!snag) return res.status(404).json({ error: "Snag not found" });

    // Only creator or admin can edit
    if (
      authUser.role !== "admin" &&
      authUser.role !== "superadmin" &&
      Number(snag.created_by) !== Number(authUser.user_id)
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const hasResponse = snag.response || (snag.response_photos && snag.response_photos.length > 0);
    const hasPhoto = req.files && req.files.photo && req.files.photo.length > 0;
    const hasAudio = req.files && req.files.audio && req.files.audio.length > 0;
    const isCoreUpdate = title || (description !== undefined) || assigned_to || hasPhoto || hasAudio || remove_audio;

    if (hasResponse && isCoreUpdate) {
      return res.status(400).json({ error: "Cannot edit snag details because a response has already been generated. However, folder links can still be updated." });
    }

    if (title) snag.title = title.trim();
    if (description !== undefined) snag.description = description?.trim() || null;
    if (assigned_to) snag.assigned_to = Number(assigned_to);

    if (folder_ids !== undefined) {
      let parsedFolderIds: number[] = [];
      if (Array.isArray(folder_ids)) {
        parsedFolderIds = folder_ids.map(Number);
      } else if (typeof folder_ids === 'string') {
        if (folder_ids.trim() !== '') {
          parsedFolderIds = folder_ids.split(',').map((s: any) => Number(s.trim())).filter((n: any) => !isNaN(n));
        }
      }
      snag.folder_ids = parsedFolderIds;
      snag.changed('folder_ids', true);
    }

    const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
    const photoFile = files.photo?.[0];
    const audioFile = files.audio?.[0];

    if (audioFile && audioFile.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: "Voice note exceeds the maximum allowed duration of 5 minutes." });
    }

    if (photoFile) {
      const project = await projects.findByPk(snag.project_id);
      let fileBuffer = photoFile.buffer;
      let ext = photoFile.originalname.match(/\.[0-9a-z]+$/i)?.[0] || ".jpg";

      if (photoFile.mimetype.startsWith("image/")) {
        try {
          const senderName = authUser.name || "Someone";
          fileBuffer = await addWatermark(photoFile.buffer, project?.name || 'Apexis', senderName);
          ext = ".jpg";
        } catch (e) {
          console.error("Sharp error in snag edit", e);
        }
      }

      const key = `projects/${snag.project_id}/snags/${Date.now()}${ext}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          ContentType: photoFile.mimetype,
          Body: fileBuffer,
        }),
      );
      snag.photo_url = key;
    }

    if (remove_audio === 'true') {
      snag.audio_url = null;
    }

    if (audioFile) {
      const ext = audioFile.originalname.match(/\.[0-9a-z]+$/i)?.[0] || ".m4a";
      const key = `projects/${snag.project_id}/snags/audio/${Date.now()}${ext}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          ContentType: audioFile.mimetype,
          Body: audioFile.buffer,
        }),
      );
      snag.audio_url = key;
    }

    await snag.save();

    await logActivity({
      projectId: snag.project_id,
      userId: authUser.user_id,
      type: "edit",
      description: `Updated snag "${snag.title}"`,
      metadata: { snagId: snag.id, type: 'snags' },
      skipNotifications: true
    });

    const full = await snags.findByPk(id, {
      attributes: [
        "id", "project_id", "title", "description", "photo_url", 
        "audio_url",
        "assigned_to", "status", "response", "response_photos", 
        "created_by", "createdAt", "updatedAt", "folder_ids"
      ],
      include: [
        { model: users, as: "assignee", attributes: ["id", "name"] },
        { model: users, as: "creator", attributes: ["id", "name"] },
      ],
    });

    res.json({ snag: await withPresignedUrl(full!) });
  } catch (err) {
    console.error("updateSnag error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /snags/folder/:folder_id
export const getFolderSnags = async (req: Request, res: Response) => {
  try {
    const { folder_id } = req.params;
    if (!folder_id) return res.status(400).json({ error: "folder_id is required" });

    const list = await snags.findAll({
      where: sequelize.literal(`"snags"."folder_ids"::jsonb @> '[${Number(folder_id)}]'`),
      attributes: [
        "id", "project_id", "title", "description", "photo_url", "audio_url",
        "assigned_to", "status", "response", "response_photos",
        "created_by", "createdAt", "updatedAt", "seen_at", "folder_ids"
      ],
      include: [
        { model: users, as: "assignee", attributes: ["id", "name", "email"] },
        { model: users, as: "creator", attributes: ["id", "name"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    const populated = await Promise.all(
      list.map((s: any) => withPresignedUrl(s))
    );

    res.json({ snags: populated });
  } catch (err) {
    console.error("getFolderSnags error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

