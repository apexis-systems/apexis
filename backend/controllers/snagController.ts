import type { Request, Response } from "express";
import { getIO } from "../socket.ts";
import "multer";
import s3Client, { BUCKET_NAME } from "../config/s3Config.ts";
import { PutObjectCommand, GetObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
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
  file_snag_links,
  files
} from "../models/index.ts";
import { sendNotification } from "../utils/notificationUtils.ts";
import { logActivity } from "../utils/activityUtils.ts";

// Helper: generate presigned URL for a snag photo
const withPresignedUrl = async (snag: any, role?: string) => {
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
      const folderList = await folders.findAll({
        where: { id: json.folder_ids },
        attributes: ['id', 'name', 'folder_type']
      });
      if (role !== 'admin' && role !== 'superadmin') {
        json.linked_folders = folderList.filter((f: any) => f.name.toLowerCase() !== 'confidential');
      } else {
        json.linked_folders = folderList;
      }
    } catch {
      json.linked_folders = [];
    }
  } else {
    json.linked_folders = [];
  }

  if (json.file_snag_links && Array.isArray(json.file_snag_links)) {
    try {
      await Promise.all(
        json.file_snag_links.map(async (link: any) => {
          const fileObj = link.file || link.files;
          if (fileObj && fileObj.file_url) {
            try {
              const rawKey = fileObj.file_url;
              const key = rawKey.startsWith('/') ? rawKey.substring(1) : rawKey;
              const cmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
              fileObj.downloadUrl = await getSignedUrl(s3Client, cmd, { expiresIn: 3600 });
            } catch (err) {
              console.error("Presign file url error:", err);
              fileObj.downloadUrl = null;
            }
          }
        })
      );
    } catch (err) {
      console.error("Error processing file_snag_links presigning:", err);
    }
  }

  return json;
};

// GET /snags?project_id=X  — list snags for a project
export const getSnags = async (req: Request, res: Response) => {
  try {
    const { project_id } = req.query;
    if (!project_id)
      return res.status(400).json({ error: "project_id is required" });

    const authUser = (req as any).user;

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
        {
          model: file_snag_links,
          include: [{ model: files }]
        }
      ],
      order: [["createdAt", "DESC"]],
    });

    const result = await Promise.all(data.map((s: any) => withPresignedUrl(s, authUser?.role)));

    let finalResult = result;
    if (authUser && (authUser.role === 'consultant' || authUser.role === 'vendor')) {
      const { project_member_folders } = await import("../models/index.ts");
      const member = await project_members.findOne({
        where: { user_id: authUser.user_id, project_id: Number(project_id) }
      });
      if (!member) {
        finalResult = [];
      } else {
        const allowedFolders = await project_member_folders.findAll({
          where: { project_member_id: member.id },
          attributes: ['folder_id']
        });
        const allowedFolderIds = allowedFolders.map((af: any) => Number(af.folder_id));

        finalResult = result.filter((item: any) => {
          if (Number(item.assigned_to) === Number(authUser.user_id) || Number(item.created_by) === Number(authUser.user_id)) {
            return true;
          }
          const linkedFolderIds = Array.isArray(item.folder_ids) ? item.folder_ids.map(Number) : [];
          return linkedFolderIds.some((fid: number) => allowedFolderIds.includes(fid));
        });
      }
    }

    res.json({ snags: finalResult });
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

    const { project_id, title, description, assigned_to, folder_ids, photo_key, source_file_id } = req.body;
    if (!project_id || !title)
      return res
        .status(400)
        .json({ error: "project_id and title are required" });
    if (!assigned_to)
      return res.status(400).json({ error: "Assignee is required" });
    const files = ((req as any).files || {}) as Record<string, Express.Multer.File[]>;
    const photoFile = files.photo?.[0];
    const audioFile = files.audio?.[0];

    if (!photoFile && !photo_key)
      return res.status(400).json({ error: "Photo is required" });
    const project = await projects.findByPk(project_id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    let photo_url: string | null = null;
    let audio_url: string | null = null;

    if (audioFile && audioFile.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: "Voice note exceeds the maximum allowed duration of 5 minutes." });
    }

    if (photo_key) {
      const ext = photo_key.match(/\.[0-9a-z]+$/i)?.[0] || ".jpg";
      const key = `projects/${project_id}/snags/${Date.now()}${ext}`;
      try {
        const sourceKey = photo_key.startsWith('/') ? photo_key.substring(1) : photo_key;
        await s3Client.send(
          new CopyObjectCommand({
            Bucket: BUCKET_NAME,
            CopySource: `/${BUCKET_NAME}/${encodeURIComponent(sourceKey)}`,
            Key: key,
          })
        );
        photo_url = key;
      } catch (err) {
        console.error("S3 CopyObject error for Snag:", err);
        photo_url = photo_key; // Fallback
      }
    } else if (photoFile) {
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

    if (source_file_id) {
      await file_snag_links.create({
        file_id: Number(source_file_id),
        snag_id: snag.id
      });
    }

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
    const snagWithUrls = await withPresignedUrl(full!, authUser?.role);
    try {
      getIO().to(`project-${(snag as any).project_id}`).emit('snag-updated', { snag: snagWithUrls });
    } catch (e) {
      console.error('Socket emit error (createSnag):', e);
    }
    res.status(201).json({ snag: snagWithUrls });
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

    // Only the assigned user or creator can change the status
    if (
      Number(snag.assigned_to) !== Number(authUser.user_id) &&
      Number(snag.created_by) !== Number(authUser.user_id)
    ) {
      return res.status(403).json({ error: "Only the assignee or creator can update the status" });
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
      const hasNewAudio = req.files.some((f: any) => f.mimetype.startsWith('audio/'));
      const hasNewImage = req.files.some((f: any) => f.mimetype.startsWith('image/'));
      const imageCount = req.files.filter((f: any) => f.mimetype.startsWith('image/')).length;
      const audioCount = req.files.filter((f: any) => f.mimetype.startsWith('audio/')).length;

      if (imageCount > 1 || audioCount > 1) {
        return res.status(400).json({ error: 'Snag responses support only one image and one voice note.' });
      }

      // If new audio is being uploaded, remove existing audio from the response
      if (hasNewAudio) {
        currentResponsePhotos = currentResponsePhotos.filter((p: any) => {
          const isAudio = p.match(/\.(m4a|webm|mp3|wav|aac|ogg|3gp|caf)(\?.*)?$/i);
          return !isAudio;
        });
      }

      // If new image is being uploaded, remove existing images from the response
      if (hasNewImage) {
        currentResponsePhotos = currentResponsePhotos.filter((p: any) => {
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
    const snagWithUrls = await withPresignedUrl(full || snag, authUser?.role);
    try {
      getIO().to(`project-${(snag as any).project_id}`).emit('snag-updated', { snag: snagWithUrls });
    } catch (e) {
      console.error('Socket emit error (updateSnagStatus):', e);
    }
    res.json({ snag: snagWithUrls });

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

    await file_snag_links.destroy({
      where: { snag_id: id }
    });

    await snag.destroy();

    await logActivity({
      projectId: snag.project_id,
      userId: authUser.user_id,
      type: "edit",
      description: `Moved snag "${snag.title}" to trash`,
      metadata: { snagId: id, type: 'snags' },
      skipNotifications: true
    });

    try {
      getIO().to(`project-${snag.project_id}`).emit('snag-deleted', { snagId: Number(id) });
    } catch (e) {
      console.error('Socket emit error (deleteSnag):', e);
    }

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

    const isCreatorOrAdmin = authUser.role === "admin" || authUser.role === "superadmin" || Number(snag.created_by) === Number(authUser.user_id);
    const isAssignee = Number(snag.assigned_to) === Number(authUser.user_id);

    if (!isCreatorOrAdmin && !isAssignee) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const hasPhoto = req.files && req.files.photo && req.files.photo.length > 0;
    const hasAudio = req.files && req.files.audio && req.files.audio.length > 0;
    const isCoreUpdate = title || (description !== undefined) || assigned_to || hasPhoto || hasAudio || remove_audio;

    // If they are only the assignee (not creator/admin), they can only update folder links
    if (isAssignee && !isCreatorOrAdmin && isCoreUpdate) {
      return res.status(403).json({ error: "Forbidden: Assignee can only update folder links" });
    }

    const hasResponse = snag.response || (snag.response_photos && snag.response_photos.length > 0);
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

    const snagWithUrls = await withPresignedUrl(full!, authUser?.role);
    try {
      getIO().to(`project-${snag.project_id}`).emit('snag-updated', { snag: snagWithUrls });
    } catch (e) {
      console.error('Socket emit error (updateSnag):', e);
    }

    res.json({ snag: snagWithUrls });
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

    const authUser = (req as any).user;
    const folder = await folders.findByPk(Number(folder_id));
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    if (folder.name && folder.name.toLowerCase() === 'confidential') {
      if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'superadmin')) {
        return res.status(403).json({ error: "Forbidden: Only Admins can view Snags in a confidential folder" });
      }
    }

    if (authUser && (authUser.role === 'consultant' || authUser.role === 'vendor')) {
      const member = await project_members.findOne({
        where: { user_id: authUser.user_id, project_id: folder.project_id }
      });
      if (!member) return res.status(403).json({ error: "Forbidden: No access to this project" });

      const { project_member_folders } = await import("../models/index.ts");
      const isAllowed = await project_member_folders.findOne({
        where: { project_member_id: member.id, folder_id: Number(folder_id) }
      });
      if (!isAllowed) return res.status(403).json({ error: "Forbidden: You do not have access to this folder" });
    }

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
        {
          model: file_snag_links,
          include: [{ model: files }]
        }
      ],
      order: [["createdAt", "DESC"]],
    });

    const populated = await Promise.all(
      list.map((s: any) => withPresignedUrl(s, authUser?.role))
    );

    res.json({ snags: populated });
  } catch (err) {
    console.error("getFolderSnags error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// POST /snags/:id/link
export const linkSnagFile = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { fileId } = req.body;

    try {
        if (!fileId) {
            return res.status(400).json({ error: "fileId is required" });
        }

        const snagRecord = await snags.findByPk(id);
        const fileRecord = await files.findByPk(fileId);

        if (!snagRecord || !fileRecord) {
            return res.status(404).json({ error: "Snag or File not found" });
        }

        const authUser = (req as any).user;
        if (fileRecord.folder_id) {
            const folder = await folders.findByPk(fileRecord.folder_id);
            if (folder && folder.name.toLowerCase() === 'confidential') {
                if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'superadmin')) {
                    return res.status(403).json({ error: "Forbidden: Cannot link a confidential file to a Snag" });
                }
            }
        }

        const existing = await file_snag_links.findOne({
            where: { snag_id: id, file_id: fileId }
        });

        if (existing) {
            return res.status(200).json({ message: "File is already linked to this Snag", link: existing });
        }

        const link = await file_snag_links.create({
            snag_id: id,
            file_id: fileId
        });

        res.status(201).json({ message: "File linked to Snag successfully", link });
    } catch (error) {
        console.error("linkSnagFile error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// DELETE /snags/:id/link/:fileId
export const deleteSnagLink = async (req: Request, res: Response) => {
    const { id, fileId } = req.params;

    try {
        const deleted = await file_snag_links.destroy({
            where: { snag_id: id, file_id: fileId }
        });

        if (!deleted) {
            return res.status(404).json({ error: "Link not found" });
        }

        res.status(200).json({ message: "Link removed successfully" });
    } catch (error) {
        console.error("deleteSnagLink error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

