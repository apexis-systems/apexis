import type { Request, Response } from 'express';
import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { rfis, users, activities, projects, project_members, folders, sequelize, file_rfi_links, files, project_member_folders } from '../models/index.ts';
import { sendNotification } from '../utils/notificationUtils.ts';
import { logActivity } from "../utils/activityUtils.ts";
import { addWatermark } from '../utils/watermark.ts';
import { Op } from 'sequelize';
import { getIO } from '../socket.ts';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});
const BUCKET = process.env.S3_BUCKET_NAME || 'apexis-bucket';

const isAudioMime = (mime?: string) => !!mime && mime.startsWith('audio/');
const isImageMime = (mime?: string) => !!mime && mime.startsWith('image/');

const validateRfiAttachmentBatch = (files: any[], imageLimit: number) => {
    const imageCount = files.filter(file => isImageMime(file.mimetype)).length;
    const audioCount = files.filter(file => isAudioMime(file.mimetype)).length;

    if (imageCount > imageLimit || audioCount > 1) {
        return `RFI supports up to ${imageLimit} image${imageLimit === 1 ? '' : 's'} and 1 voice note.`;
    }

    return null;
};

// Helper: generate presigned URLs for RFI photos
const withPresignedUrls = async (rfi: any, role?: string) => {
    const json = rfi.toJSON ? rfi.toJSON() : { ...rfi };
    if (json.photos && Array.isArray(json.photos)) {
        try {
            json.photoDownloadUrls = await Promise.all(
                json.photos.map(async (key: string) => {
                    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
                    return await getSignedUrl(s3Client, cmd, { expiresIn: 3600 });
                })
            );
        } catch { json.photoDownloadUrls = []; }
    } else {
        json.photoDownloadUrls = [];
    }

    if (json.response_photos && Array.isArray(json.response_photos)) {
        try {
            json.responsePhotoUrls = await Promise.all(
                json.response_photos.map(async (key: string) => {
                    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
                    return await getSignedUrl(s3Client, cmd, { expiresIn: 3600 });
                })
            );
        } catch { json.responsePhotoUrls = []; }
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
        } catch { json.linked_folders = []; }
    } else {
        json.linked_folders = [];
    }

    if (json.file_rfi_links && Array.isArray(json.file_rfi_links)) {
        try {
            await Promise.all(
                json.file_rfi_links.map(async (link: any) => {
                    const fileObj = link.file || link.files;
                    if (fileObj && fileObj.file_url) {
                        try {
                            const rawKey = fileObj.file_url;
                            const key = rawKey.startsWith('/') ? rawKey.substring(1) : rawKey;
                            const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
                            fileObj.downloadUrl = await getSignedUrl(s3Client, cmd, { expiresIn: 3600 });
                        } catch (err) {
                            console.error("Presign file url error:", err);
                            fileObj.downloadUrl = null;
                        }
                    }
                })
            );
        } catch (err) {
            console.error("Error processing file_rfi_links presigning:", err);
        }
    }

    return json;
};

// GET /rfis?project_id=X
export const getRFIs = async (req: Request, res: Response) => {
    try {
        const { project_id } = req.query;
        const authUser = (req as any).user;
        if (!project_id) return res.status(400).json({ error: 'project_id is required' });

        const where: any = { project_id: Number(project_id) };

        // Access Control: Clients only see RFIs where is_client_visible is true
        if (authUser.role === 'client') {
            where.is_client_visible = true;
        }

        const data = await rfis.findAll({
            where,
            include: [
                { model: users, as: 'assignee', attributes: ['id', 'name', 'role'] },
                { model: users, as: 'creator', attributes: ['id', 'name', 'role'] },
                {
                    model: file_rfi_links,
                    include: [{ model: files }]
                }
            ],
            order: [['createdAt', 'DESC']],
        });

        const result = await Promise.all(data.map((r: any) => withPresignedUrls(r, authUser?.role)));

        let finalResult = result;
        if (authUser && (authUser.role === 'consultant' || authUser.role === 'vendor')) {
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

        res.json({ rfis: finalResult });
    } catch (err) {
        console.error('getRFIs error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /rfis
export const createRFI = async (req: Request | any, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

        const { project_id, title, description, assigned_to, expiry_date, folder_ids, photo_key, source_file_id } = req.body;
        if (!project_id || !title || !assigned_to) {
            return res.status(400).json({ error: 'project_id, title and assigned_to are required' });
        }
        const project = await projects.findByPk(project_id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const assigneeId = Number(assigned_to);
        if (!Number.isFinite(assigneeId)) {
            return res.status(400).json({ error: 'assigned_to must be a valid user id' });
        }

        const assignee = await users.findByPk(assigneeId);
        if (!assignee) {
            return res.status(404).json({ error: 'Assignee not found' });
        }

        const validAssignee = await project_members.findOne({
            where: { project_id: Number(project_id), user_id: assigneeId }
        });
        const isProjectAdmin = assignee.role === 'admin' && assignee.organization_id === project.organization_id;
        const isSuperAdmin = assignee.role === 'superadmin';
        if (!validAssignee && !isProjectAdmin && !isSuperAdmin) {
            return res.status(400).json({ error: 'Assignee must belong to the project or organization' });
        }

        // Photo Upload Logic
        const uploadedPhotos: string[] = [];
        if (photo_key) {
            const ext = photo_key.match(/\.[0-9a-z]+$/i)?.[0] || '.jpg';
            const key = `projects/${project_id}/rfis/${Date.now()}_${Math.random().toString(36).substr(2, 5)}${ext}`;
            try {
                const sourceKey = photo_key.startsWith('/') ? photo_key.substring(1) : photo_key;
                await s3Client.send(new CopyObjectCommand({
                    Bucket: BUCKET,
                    CopySource: `/${BUCKET}/${encodeURIComponent(sourceKey)}`,
                    Key: key
                }));
                uploadedPhotos.push(key);
            } catch (err) {
                console.error("S3 CopyObject for RFI error:", err);
                uploadedPhotos.push(photo_key); // Fallback
            }
        }

        if (req.files && Array.isArray(req.files)) {
            const validationError = validateRfiAttachmentBatch(req.files, 4);
            if (validationError) {
                return res.status(400).json({ error: validationError });
            }

            for (const file of req.files) {
                // Approx 10MB limit for 5 minutes of high-quality audio
                if (isAudioMime(file.mimetype) && file.size > 10 * 1024 * 1024) {
                    return res.status(400).json({ error: "Voice note exceeds the maximum allowed duration of 5 minutes." });
                }

                let fileBuffer = file.buffer;
                if (isImageMime(file.mimetype)) {
                    try {
                        const senderName = authUser.name || 'Someone';
                        fileBuffer = await addWatermark(file.buffer, project.name, senderName);
                    } catch (err) {
                        console.error('Watermarking failed for RFI photo:', err);
                    }
                }

                const ext = file.originalname.match(/\.[0-9a-z]+$/i)?.[0] || '.jpg';
                const key = `projects/${project_id}/rfis/${Date.now()}_${Math.random().toString(36).substr(2, 5)}${ext}`;
                await s3Client.send(new PutObjectCommand({
                    Bucket: BUCKET,
                    Key: key,
                    ContentType: file.mimetype,
                    Body: fileBuffer,
                }));
                uploadedPhotos.push(key);
            }
        }

        // Logic for client visibility
        let is_client_visible = false;
        if (authUser.role === 'client') {
            is_client_visible = true;
        } else if (assignee.role === 'client') {
            is_client_visible = true;
        }

        const rfi = await rfis.create({
            project_id: Number(project_id),
            title: title.trim(),
            description: description?.trim() || null,
            assigned_to: assigneeId,
            created_by: authUser.user_id,
            status: 'open',
            is_client_visible,
            photos: uploadedPhotos,
            expiry_date: expiry_date ? new Date(expiry_date) : null,
            folder_ids: folder_ids ? (Array.isArray(folder_ids) ? folder_ids.map(Number) : folder_ids.split(',').map((s: any) => Number(s.trim())).filter((n:any) => !isNaN(n))) : [],
        });

        if (source_file_id) {
            await file_rfi_links.create({
                file_id: Number(source_file_id),
                rfi_id: rfi.id
            });
        }

        await logActivity({
            projectId: Number(project_id),
            userId: authUser.user_id,
            type: 'edit',
            description: `Created RFI "${title.trim()}"`,
            metadata: { rfiId: rfi.id, type: 'rfi' },
            skipNotifications: true
        });

        // Notification Logic
        if (authUser.role === 'client') {
            // Notify all admins in the project's organization and contributors in the project.
            const admins = await users.findAll({
                where: { organization_id: project.organization_id, role: 'admin' }
            });
            const projectContributors = await project_members.findAll({
                where: { project_id: Number(project_id), role: 'contributor' },
                include: [{
                    model: users,
                    as: 'user',
                    attributes: ['id']
                }]
            });

            const notifyUserIds = new Set<number>();
            admins.forEach((addr: any) => notifyUserIds.add(addr.id));
            projectContributors.forEach((c: any) => {
                const uid = c.user_id || c.user?.id || c.dataValues?.user?.id;
                if (uid) notifyUserIds.add(uid);
            });
            notifyUserIds.delete(authUser.user_id);

            const sender = await users.findByPk(authUser.user_id);
            const senderName = sender?.name || 'Someone';

            for (const uid of notifyUserIds) {
                await sendNotification({
                    userId: uid,
                    title: 'New RFI from Client',
                    body: `${senderName} created a new RFI: ${title}`,
                    type: 'rfi_created',
                    data: { rfiId: String(rfi.id), projectId: String(project_id), type: 'rfi' }
                });
            }
        } else {
            // Admin/Contributor created it
            const senderName = authUser.name || 'Someone';
            await sendNotification({
                userId: assigneeId,
                title: 'New RFI Assigned',
                body: `${senderName} assigned an RFI to you: ${title}`,
                type: 'rfi_assigned',
                data: { rfiId: String(rfi.id), projectId: String(project_id), type: 'rfi' }
            });
        }

        const full = await rfis.findByPk((rfi as any).id, {
            include: [
                { model: users, as: 'assignee', attributes: ['id', 'name', 'role', 'profile_pic'] },
                { model: users, as: 'creator', attributes: ['id', 'name', 'role', 'profile_pic'] },
                {
                    model: file_rfi_links,
                    include: [{ model: files }]
                }
            ],
        });

        const rfiWithUrls = await withPresignedUrls(full!, authUser?.role);

        try {
            getIO().to(`project-${project_id}`).emit('rfi-updated', { rfi: rfiWithUrls });
        } catch (e) {
            console.error('Socket emit error (createRFI):', e);
        }

        res.status(201).json({ rfi: rfiWithUrls });
    } catch (err) {
        console.error('createRFI error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// PATCH /rfis/:id/status
export const updateRFIStatus = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { id } = req.params;
        const { status } = req.body;
        const valid = ['open', 'closed', 'overdue'];
        if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

        const rfi = await rfis.findByPk(id);
        if (!rfi) return res.status(404).json({ error: 'RFI not found' });

        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
        if (
            Number(rfi.assigned_to) !== Number(authUser.user_id) &&
            Number(rfi.created_by) !== Number(authUser.user_id)
        ) {
            return res.status(403).json({ error: 'Only the assignee or creator can update RFI status' });
        }

        (rfi as any).status = status;
        await rfi.save();

        if (authUser) {
            await logActivity({
                projectId: (rfi as any).project_id,
                userId: authUser.user_id,
                type: 'edit',
                description: `Updated status for RFI "${(rfi as any).title}" to ${status}`,
                metadata: { rfiId: rfi.id, type: 'rfi' },
                skipNotifications: true
            });
        }

        const full = await rfis.findByPk(id, {
            include: [
                { model: users, as: 'assignee', attributes: ['id', 'name', 'role', 'profile_pic'] },
                { model: users, as: 'creator', attributes: ['id', 'name', 'role', 'profile_pic'] },
                {
                    model: file_rfi_links,
                    include: [{ model: files }]
                }
            ],
        });

        const rfiWithUrls = await withPresignedUrls(full!, authUser?.role);

        res.json({ rfi: rfiWithUrls });

        try {
            getIO().to(`project-${(rfi as any).project_id}`).emit('rfi-updated', { rfi: rfiWithUrls });
        } catch (e) {
            console.error('Socket emit error (updateRFIStatus):', e);
        }

        // Notify creator and assignee if someone else changed it
        const notifyIds = new Set<number>();
        if (rfi.assigned_to && rfi.assigned_to !== authUser.user_id) notifyIds.add(rfi.assigned_to);
        if (rfi.created_by && rfi.created_by !== authUser.user_id) notifyIds.add(rfi.created_by);

        if (notifyIds.size > 0) {
            const validRecipients = await project_members.findAll({
                where: {
                    project_id: Number(rfi.project_id),
                    user_id: { [Op.in]: Array.from(notifyIds) }
                },
                attributes: ['user_id']
            });

            const senderName = authUser.name || 'Someone';
            const statusLabels: Record<string, string> = {
                open: 'Open',
                closed: 'Closed',
                overdue: 'Overdue'
            };
            const friendlyStatus = statusLabels[(status as string)] || status;

            for (const recipient of validRecipients) {
                await sendNotification({
                    userId: Number((recipient as any).user_id),
                    title: 'RFI Status Updated',
                    body: `${senderName} updated RFI status to ${friendlyStatus}: ${rfi.title}`,
                    type: 'rfi_status_update',
                    data: { rfiId: String(rfi.id), projectId: String(rfi.project_id), type: 'rfi' }
                });
            }
        }
    } catch (err) {
        console.error('updateRFIStatus error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// GET /rfis/:id
export const getRFIById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const authUser = (req as any).user;

        const rfi = await rfis.findByPk(id, {
            include: [
                { model: users, as: 'assignee', attributes: ['id', 'name', 'role', 'profile_pic'] },
                { model: users, as: 'creator', attributes: ['id', 'name', 'role', 'profile_pic'] },
                {
                    model: file_rfi_links,
                    include: [{ model: files }]
                }
            ],
        });

        if (!rfi) return res.status(404).json({ error: 'RFI not found' });

        // Access Control
        if (authUser.role === 'client' && !(rfi as any).is_client_visible) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        res.json({ rfi: await withPresignedUrls(rfi, authUser?.role) });
    } catch (err) {
        console.error('getRFIById error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// PATCH /rfis/:id/seen — mark RFI as seen by the assignee
export const markRFISeen = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { id } = req.params;

        const rfi = await rfis.findByPk(id);
        if (!rfi) return res.status(404).json({ error: 'RFI not found' });

        // Only the assignee can mark as seen
        if (Number(rfi.assigned_to) !== Number(authUser.user_id)) {
            return res.status(403).json({ error: 'Only the assignee can mark as seen' });
        }

        // Only mark seen once (first open)
        if (!(rfi as any).seen_at) {
            (rfi as any).seen_at = new Date();
            await rfi.save();

            // Emit real-time event to the project room
            try {
                getIO().to(`project-${(rfi as any).project_id}`).emit('rfi-seen', {
                    rfiId: Number(id),
                    seen_at: (rfi as any).seen_at,
                    project_id: (rfi as any).project_id,
                });
            } catch (e) {
                console.error('Socket emit error (markRFISeen):', e);
            }
        }

        res.json({ seen_at: (rfi as any).seen_at });
    } catch (err) {
        console.error('markRFISeen error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// GET /rfis/assignees?project_id=X  — project members plus project admins
export const getRFIAssignees = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { project_id } = req.query;
        if (!authUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!project_id) return res.status(400).json({ error: 'project_id is required' });

        const project = await projects.findByPk(Number(project_id));
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const projectAssigneeIds = await project_members.findAll({
            where: { project_id: Number(project_id) },
            attributes: ['user_id']
        });
        const projectAdminIds = await users.findAll({
            where: { organization_id: project.organization_id, role: 'admin' },
            attributes: ['id']
        });
        const allowedUserIds = [
            ...new Set([
                ...projectAssigneeIds.map((member: any) => Number(member.user_id)),
                ...projectAdminIds.map((admin: any) => Number(admin.id))
            ])
        ];

        const assignees = await users.findAll({
            where: { id: { [Op.in]: allowedUserIds } },
            attributes: ['id', 'name', 'email', 'role', 'profile_pic'],
            order: [['name', 'ASC']],
        });

        res.json({ assignees });
    } catch (err) {
        console.error('getRFIAssignees error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// PATCH /rfis/:id/response
export const updateRFIResponse = async (req: Request | any, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { id } = req.params;
        const { response, status } = req.body;

        const rfi = await rfis.findByPk(id);
        if (!rfi) return res.status(404).json({ error: 'RFI not found' });
        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

        if (
            Number(rfi.assigned_to) !== Number(authUser.user_id) &&
            Number(rfi.created_by) !== Number(authUser.user_id)
        ) {
            return res.status(403).json({ error: 'Only the assignee or creator can update the response' });
        }

        // Handle response photo uploads: Smart Replace (one image, one audio)
        const { removedPhotos } = req.body;
        let currentResponsePhotos: string[] = rfi.response_photos || [];

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
            const validationError = validateRfiAttachmentBatch(req.files, 1);
            if (validationError) {
                return res.status(400).json({ error: validationError });
            }

            const hasNewAudio = req.files.some((f:any) => isAudioMime(f.mimetype));
            const hasNewImage = req.files.some((f:any) => isImageMime(f.mimetype));

            // If new audio is being uploaded, remove existing audio from the response (maintaining "one audio" rule)
            if (hasNewAudio) {
                currentResponsePhotos = currentResponsePhotos.filter((p:any) => {
                    const isAudio = p.match(/\.(m4a|webm|mp3|wav|aac|ogg)(\?.*)?$/i);
                    return !isAudio;
                });
            }

            // If new image is being uploaded, remove existing images from the response (maintaining "one image" rule)
            if (hasNewImage) {
                currentResponsePhotos = currentResponsePhotos.filter(p => {
                    const isImage = p.match(/\.(jpg|jpeg|png|gif|webp|heic)(\?.*)?$/i);
                    return !isImage;
                });
            }

            const project = await projects.findByPk(rfi.project_id);
            for (const file of req.files) {
                if (isAudioMime(file.mimetype) && file.size > 10 * 1024 * 1024) {
                    return res.status(400).json({ error: "Voice note exceeds the maximum allowed duration of 5 minutes." });
                }

                let fileBuffer = file.buffer;
                if (isImageMime(file.mimetype)) {
                    try {
                        const senderName = authUser.name || 'Someone';
                        fileBuffer = await addWatermark(file.buffer, project?.name || 'Apexis', senderName);
                    } catch (err) {
                        console.error('Watermarking failed for RFI response photo:', err);
                    }
                }

                const ext = file.originalname.match(/\.[0-9a-z]+$/i)?.[0] || '.jpg';
                const key = `projects/${rfi.project_id}/rfis/responses/${Date.now()}_${Math.random().toString(36).substr(2, 5)}${ext}`;
                await s3Client.send(new PutObjectCommand({
                    Bucket: BUCKET,
                    Key: key,
                    ContentType: file.mimetype,
                    Body: fileBuffer,
                }));
                currentResponsePhotos.push(key);
            }
        }

        if (response !== undefined) (rfi as any).response = response;
        if (status && ['open', 'closed', 'overdue'].includes(status)) (rfi as any).status = status;
        
        rfi.response_photos = currentResponsePhotos;
        rfi.changed('response_photos', true);
        await rfi.save();

        await logActivity({
            projectId: (rfi as any).project_id,
            userId: authUser.user_id,
            type: 'edit',
            description: `Updated response for RFI "${(rfi as any).title}"`,
            metadata: { rfiId: rfi.id, type: 'rfi' },
            skipNotifications: true
        });

        // Notify creator if assignee responded
        if (authUser.user_id === rfi.assigned_to && rfi.created_by) {
            const sender = await users.findByPk(authUser.user_id);
            await sendNotification({
                userId: rfi.created_by,
                title: 'RFI Response Received',
                body: `${sender?.name || 'Assignee'} responded to your RFI: ${rfi.title}`,
                type: 'rfi_comment',
                data: { rfiId: String(rfi.id), projectId: String(rfi.project_id), type: 'rfi' }
            });
        }

        const full = await rfis.findByPk(id, {
            include: [
                { model: users, as: 'assignee', attributes: ['id', 'name', 'role', 'profile_pic'] },
                { model: users, as: 'creator', attributes: ['id', 'name', 'role', 'profile_pic'] },
                {
                    model: file_rfi_links,
                    include: [{ model: files }]
                }
            ],
        });

        const rfiWithUrls = await withPresignedUrls(full!, authUser?.role);

        try {
            getIO().to(`project-${(rfi as any).project_id}`).emit('rfi-updated', { rfi: rfiWithUrls });
        } catch (e) {
            console.error('Socket emit error (updateRFIResponse):', e);
        }

        res.json({ rfi: rfiWithUrls });
    } catch (err) {
        console.error('updateRFIResponse error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// DELETE /rfis/:id
export const deleteRFI = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { id } = req.params;

        const rfi = await rfis.findByPk(id);
        if (!rfi) return res.status(404).json({ error: 'RFI not found' });

        // Only creator can delete
        if (Number(rfi.created_by) !== Number(authUser.user_id)) {
            return res.status(403).json({ error: 'Only the creator can delete this RFI' });
        }

        // Cannot delete if there is a response (text or attachments)
        if (rfi.response || (rfi.response_photos && rfi.response_photos.length > 0)) {
            return res.status(400).json({ error: 'Cannot delete RFI because a response has already been generated' });
        }

        await file_rfi_links.destroy({
            where: { rfi_id: id }
        });

        await rfi.destroy();

        await logActivity({
            projectId: rfi.project_id,
            userId: authUser.user_id,
            type: 'edit',
            description: `Moved RFI "${rfi.title}" to trash`,
            metadata: { rfiId: id, type: 'rfi' },
            skipNotifications: true
        });

        try {
            getIO().to(`project-${rfi.project_id}`).emit('rfi-deleted', { rfiId: Number(id), project_id: rfi.project_id });
        } catch (e) {
            console.error('Socket emit error (deleteRFI):', e);
        }

        res.json({ message: 'RFI moved to trash successfully' });
    } catch (err) {
        console.error('deleteRFI error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// PATCH /rfis/:id
export const updateRFI = async (req: Request | any, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { id } = req.params;
        const { title, description, assigned_to, expiry_date, removedPhotos, folder_ids } = req.body;


        const rfi = await rfis.findByPk(id);
        if (!rfi) return res.status(404).json({ error: 'RFI not found' });

        const isCreator = Number(rfi.created_by) === Number(authUser.user_id);
        const isAssignee = Number(rfi.assigned_to) === Number(authUser.user_id);

        if (!isCreator && !isAssignee) {
            return res.status(403).json({ error: 'Only the creator or assignee can edit this RFI' });
        }

        const isCoreUpdate = title || (description !== undefined) || assigned_to || expiry_date || (req.files && req.files.length > 0) || removedPhotos;

        // If they are only the assignee (not creator), they can only update folder links
        if (isAssignee && !isCreator && isCoreUpdate) {
            return res.status(403).json({ error: 'Assignee can only update folder links' });
        }
        const hasResponse = rfi.response || (rfi.response_photos && rfi.response_photos.length > 0);
        if (hasResponse && isCoreUpdate) {
            return res.status(400).json({ error: 'Cannot edit RFI details because a response has already been generated. However, folder links can still be updated.' });
        }

        if (title) rfi.title = title.trim();
        if (description !== undefined) rfi.description = description?.trim() || null;
        if (assigned_to) rfi.assigned_to = Number(assigned_to);
        if (expiry_date !== undefined) rfi.expiry_date = expiry_date ? new Date(expiry_date) : null;

        let currentPhotos: string[] = rfi.photos || [];
        if (removedPhotos) {
            let toRemove: string[] = [];
            if (Array.isArray(removedPhotos)) {
                toRemove = removedPhotos;
            } else if (typeof removedPhotos === 'string') {
                // Handle comma separated or single string
                if (removedPhotos.startsWith('[') && removedPhotos.endsWith(']')) {
                    try { toRemove = JSON.parse(removedPhotos); } catch (e) { toRemove = [removedPhotos]; }
                } else {
                    toRemove = removedPhotos.split(',').map(s => s.trim());
                }
            }

            console.log('RFI Update - Photos to remove (parsed):', toRemove);
            currentPhotos = currentPhotos.filter(p => !toRemove.includes(p));
        }
        if (req.files && Array.isArray(req.files)) {
            const validationError = validateRfiAttachmentBatch(req.files, 4);
            if (validationError) {
                return res.status(400).json({ error: validationError });
            }

            for (const file of req.files) {
                // Approx 10MB limit for 5 minutes of high-quality audio
                if (isAudioMime(file.mimetype) && file.size > 10 * 1024 * 1024) {
                    return res.status(400).json({ error: "Voice note exceeds the maximum allowed duration of 5 minutes." });
                }
            }

            const project = await projects.findByPk(rfi.project_id);
            for (const file of req.files) {
                let fileBuffer = file.buffer;
                if (isImageMime(file.mimetype)) {
                    try {
                        const senderName = authUser.name || 'Someone';
                        fileBuffer = await addWatermark(file.buffer, project?.name || 'Apexis', senderName);
                    } catch (err) {
                        console.error('Watermarking failed for edited RFI photo:', err);
                    }
                }

                const ext = file.originalname.match(/\.[0-9a-z]+$/i)?.[0] || '.jpg';
                const key = `projects/${rfi.project_id}/rfis/${Date.now()}_${Math.random().toString(36).substr(2, 5)}${ext}`;
                await s3Client.send(new PutObjectCommand({
                    Bucket: BUCKET,
                    Key: key,
                    ContentType: file.mimetype,
                    Body: fileBuffer,
                }));
                currentPhotos.push(key);
            }
        }

        rfi.photos = currentPhotos;
        if (folder_ids !== undefined) {
            rfi.folder_ids = Array.isArray(folder_ids) ? folder_ids.map(Number) : folder_ids.split(',').map((s:any) => Number(s.trim())).filter((n:any) => !isNaN(n));
        }
        rfi.changed('photos', true);
        rfi.changed('folder_ids', true);
        await rfi.save();

        await logActivity({
            projectId: rfi.project_id,
            userId: authUser.user_id,
            type: 'edit',
            description: `Updated RFI "${rfi.title}"`,
            metadata: { rfiId: rfi.id, type: 'rfi' },
            skipNotifications: true
        });

        const full = await rfis.findByPk(id, {
            include: [
                { model: users, as: 'assignee', attributes: ['id', 'name', 'role', 'profile_pic'] },
                { model: users, as: 'creator', attributes: ['id', 'name', 'role', 'profile_pic'] },
                {
                    model: file_rfi_links,
                    include: [{ model: files }]
                }
            ],
        });

        const rfiWithUrls = await withPresignedUrls(full!, authUser?.role);

        try {
            getIO().to(`project-${rfi.project_id}`).emit('rfi-updated', { rfi: rfiWithUrls });
        } catch (e) {
            console.error('Socket emit error (updateRFI):', e);
        }

        res.json({ rfi: rfiWithUrls });
    } catch (err) {
        console.error('updateRFI error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// GET /rfis/folder/:folder_id
export const getFolderRFIs = async (req: Request, res: Response) => {
    const { folder_id } = req.params;
    const fid = Number(folder_id);

    try {
        const folder = await folders.findByPk(folder_id);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });

        const authUser = (req as any).user;
        if (folder.name && folder.name.toLowerCase() === 'confidential') {
            if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'superadmin')) {
                return res.status(403).json({ error: 'Forbidden: Only Admins can view RFIs in a confidential folder' });
            }
        }
        if (authUser && (authUser.role === 'consultant' || authUser.role === 'vendor')) {
            const member = await project_members.findOne({
                where: { user_id: authUser.user_id, project_id: folder.project_id }
            });
            if (!member) return res.status(403).json({ error: 'Forbidden: No access to this project' });

            const isAllowed = await project_member_folders.findOne({
                where: { project_member_id: member.id, folder_id: Number(folder_id) }
            });
            if (!isAllowed) return res.status(403).json({ error: 'Forbidden: You do not have access to this folder' });
        }

        // PostgreSQL JSONB containment: folder_ids::jsonb @> '[fid]'
        const data = await rfis.findAll({
            where: sequelize.literal(`"rfis"."folder_ids"::jsonb @> '[${fid}]'`),
            include: [
                { model: users, as: 'assignee', attributes: ['id', 'name', 'role'] },
                { model: users, as: 'creator', attributes: ['id', 'name', 'role'] },
                {
                    model: file_rfi_links,
                    include: [{ model: files }]
                }
            ],
            order: [['createdAt', 'DESC']],
        });

        const result = await Promise.all(data.map((r: any) => withPresignedUrls(r, authUser?.role)));
        res.json({ rfis: result });
    } catch (err) {
        console.error('getFolderRFIs error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /rfis/:id/link
export const linkRfiFile = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { fileId } = req.body;

    try {
        if (!fileId) {
            return res.status(400).json({ error: "fileId is required" });
        }

        const rfiRecord = await rfis.findByPk(id);
        const fileRecord = await files.findByPk(fileId);

        if (!rfiRecord || !fileRecord) {
            return res.status(404).json({ error: "RFI or File not found" });
        }

        const authUser = (req as any).user;
        if (fileRecord.folder_id) {
            const folder = await folders.findByPk(fileRecord.folder_id);
            if (folder && folder.name.toLowerCase() === 'confidential') {
                if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'superadmin')) {
                    return res.status(403).json({ error: "Forbidden: Cannot link a confidential file to an RFI" });
                }
            }
        }

        const existing = await file_rfi_links.findOne({
            where: { rfi_id: id, file_id: fileId }
        });

        if (existing) {
            return res.status(200).json({ message: "File is already linked to this RFI", link: existing });
        }

        const link = await file_rfi_links.create({
            rfi_id: id,
            file_id: fileId
        });

        res.status(201).json({ message: "File linked to RFI successfully", link });
    } catch (error) {
        console.error("linkRfiFile error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// DELETE /rfis/:id/link/:fileId
export const deleteRfiLink = async (req: Request, res: Response) => {
    const { id, fileId } = req.params;

    try {
        const deleted = await file_rfi_links.destroy({
            where: { rfi_id: id, file_id: fileId }
        });

        if (!deleted) {
            return res.status(404).json({ error: "Link not found" });
        }

        res.status(200).json({ message: "Link removed successfully" });
    } catch (error) {
        console.error("deleteRfiLink error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
