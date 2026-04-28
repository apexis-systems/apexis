import type { Request, Response } from 'express';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { rfis, users, activities, projects, project_members } from '../models/index.ts';
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

// Helper: generate presigned URLs for RFI photos
const withPresignedUrls = async (rfi: any) => {
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
            ],
            order: [['createdAt', 'DESC']],
        });

        const result = await Promise.all(data.map(withPresignedUrls));
        res.json({ rfis: result });
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

        const { project_id, title, description, assigned_to, expiry_date } = req.body;
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
        if (req.files && Array.isArray(req.files)) {
            for (const file of req.files) {
                let fileBuffer = file.buffer;
                if (file.mimetype.startsWith('image/')) {
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
        });

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
            ],
        });

        const rfiWithUrls = await withPresignedUrls(full!);

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
        if (Number(rfi.assigned_to) !== Number(authUser.user_id)) {
            return res.status(403).json({ error: 'Only the assignee can update RFI status' });
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

        res.json({ rfi });

        try {
            getIO().to(`project-${(rfi as any).project_id}`).emit('rfi-updated', { rfi });
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
            ],
        });

        if (!rfi) return res.status(404).json({ error: 'RFI not found' });

        // Access Control
        if (authUser.role === 'client' && !(rfi as any).is_client_visible) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        res.json({ rfi: await withPresignedUrls(rfi) });
    } catch (err) {
        console.error('getRFIById error:', err);
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

        if (Number(rfi.assigned_to) !== Number(authUser.user_id)) {
            return res.status(403).json({ error: 'Only the assignee can update the response' });
        }

        // Handle response photo uploads: Replace existing if new ones provided
        let uploadedResponsePhotos: string[] = [];
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            const project = await projects.findByPk(rfi.project_id);
            for (const file of req.files) {
                let fileBuffer = file.buffer;
                if (file.mimetype.startsWith('image/')) {
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
                uploadedResponsePhotos.push(key);
            }
        } else {
            uploadedResponsePhotos = rfi.response_photos || [];
        }

        if (response !== undefined) (rfi as any).response = response;
        if (status && ['open', 'closed', 'overdue'].includes(status)) (rfi as any).status = status;
        (rfi as any).response_photos = uploadedResponsePhotos;
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

        const rfiWithUrls = await withPresignedUrls(rfi);

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

        // Cannot delete if there is a response
        if (rfi.response) {
            return res.status(400).json({ error: 'Cannot delete RFI because a response has already been generated' });
        }

        await rfi.destroy();

        await logActivity({
            projectId: rfi.project_id,
            userId: authUser.user_id,
            type: 'edit',
            description: `Deleted RFI "${rfi.title}"`,
            metadata: { rfiId: id, type: 'rfi' },
            skipNotifications: true
        });

        res.json({ message: 'RFI deleted successfully' });
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
        const { title, description, assigned_to, expiry_date, removedPhotos } = req.body;

        const rfi = await rfis.findByPk(id);
        if (!rfi) return res.status(404).json({ error: 'RFI not found' });

        // Only creator can edit
        if (Number(rfi.created_by) !== Number(authUser.user_id)) {
            return res.status(403).json({ error: 'Only the creator can edit this RFI' });
        }

        // Cannot edit if there is a response
        if (rfi.response) {
            return res.status(400).json({ error: 'Cannot edit RFI because a response has already been generated' });
        }

        if (title) rfi.title = title.trim();
        if (description !== undefined) rfi.description = description?.trim() || null;
        if (assigned_to) rfi.assigned_to = Number(assigned_to);
        if (expiry_date !== undefined) rfi.expiry_date = expiry_date ? new Date(expiry_date) : null;

        let currentPhotos: string[] = rfi.photos || [];
        if (req.files && Array.isArray(req.files) && (req.files as any[]).length > 0) {
            currentPhotos = [];
        } else if (removedPhotos) {
            const toRemove = Array.isArray(removedPhotos) ? removedPhotos : [removedPhotos];
            currentPhotos = currentPhotos.filter(p => !toRemove.includes(p));
        }
        if (req.files && Array.isArray(req.files)) {
            const project = await projects.findByPk(rfi.project_id);
            for (const file of req.files) {
                let fileBuffer = file.buffer;
                if (file.mimetype.startsWith('image/')) {
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
        rfi.changed('photos', true);
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
            ],
        });

        const rfiWithUrls = await withPresignedUrls(full!);

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
