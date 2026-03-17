import type { Request, Response } from 'express';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Op } from 'sequelize';
import sharp from 'sharp';
import { snags, users, project_members, activities } from '../models/index.ts';
import { sendNotification } from '../utils/notificationUtils.ts';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});
const BUCKET = process.env.S3_BUCKET_NAME || 'apexis-bucket';

// Helper: generate presigned URL for a snag photo
const withPresignedUrl = async (snag: any) => {
    const json = snag.toJSON ? snag.toJSON() : { ...snag };
    if (json.photo_url) {
        try {
            const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: json.photo_url });
            json.photoDownloadUrl = await getSignedUrl(s3Client, cmd, { expiresIn: 3600 });
        } catch { json.photoDownloadUrl = null; }
    }
    return json;
};

// GET /snags?project_id=X  — list snags for a project
export const getSnags = async (req: Request, res: Response) => {
    try {
        const { project_id } = req.query;
        if (!project_id) return res.status(400).json({ error: 'project_id is required' });

        const data = await snags.findAll({
            where: { project_id: Number(project_id) },
            include: [
                { model: users, as: 'assignee', attributes: ['id', 'name', 'email'] },
                { model: users, as: 'creator', attributes: ['id', 'name'] },
            ],
            order: [['createdAt', 'DESC']],
        });

        const result = await Promise.all(data.map(withPresignedUrl));
        res.json({ snags: result });
    } catch (err) {
        console.error('getSnags error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /snags  — create a snag (with optional photo upload)
export const createSnag = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

        const { project_id, title, description, assigned_to } = req.body;
        if (!project_id || !title) return res.status(400).json({ error: 'project_id and title are required' });
        if (!assigned_to) return res.status(400).json({ error: 'Assignee is required' });
        if (!(req as any).file) return res.status(400).json({ error: 'Photo is required' });

        let photo_url: string | null = null;
        if ((req as any).file) {
            let fileBuffer = (req as any).file.buffer;
            let ext = (req as any).file.originalname.match(/\.[0-9a-z]+$/i)?.[0] || '.jpg';

            if ((req as any).file.mimetype.startsWith('image/')) {
                const timestamp = new Date().toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short'
                });
                try {
                    const image = sharp((req as any).file.buffer);
                    const metadata = await image.metadata();
                    const originalWidth = metadata.width || 1280;
                    const finalWidth = Math.min(originalWidth, 1280);

                    // Dynamically adjust font size to width
                    const fontSize = Math.max(14, Math.min(36, Math.round(finalWidth * 0.035)));
                    const svgWidth = finalWidth;
                    const svgHeight = Math.round(fontSize * 2.5);
                    const yPos = Math.round(fontSize * 1.5);

                    const svgOverlay = `<svg width="${svgWidth}" height="${svgHeight}"><style>.title { fill: #e98b06; font-size: ${fontSize}px; font-family: sans-serif; font-weight: bold; }</style><text x="15" y="${yPos}" class="title" stroke="black" stroke-width="${fontSize < 20 ? 0.3 : 0.6}">${timestamp}</text></svg>`;

                    fileBuffer = await image
                        .resize({ width: 1280, withoutEnlargement: true })
                        .composite([{ input: Buffer.from(svgOverlay), gravity: 'southwest' }])
                        .jpeg({ quality: 60 })
                        .toBuffer();
                    ext = '.jpg';
                } catch (e) {
                    console.error('Sharp error in snag', e);
                }
            }

            const key = `projects/${project_id}/snags/${Date.now()}${ext}`;
            await s3Client.send(new PutObjectCommand({
                Bucket: BUCKET, Key: key,
                ContentType: (req as any).file.mimetype, Body: fileBuffer,
            }));
            photo_url = key;
        }

        const snag = await snags.create({
            project_id: Number(project_id),
            title: title.trim(),
            description: description?.trim() || null,
            photo_url,
            assigned_to: assigned_to ? Number(assigned_to) : null,
            status: 'amber',
            created_by: authUser.user_id,
        });

        await activities.create({
            project_id: Number(project_id),
            user_id: authUser.user_id,
            type: 'edit',
            description: `Added snag "${title.trim()}"`
        });

        // Notify assignee
        if (assigned_to) {
            await sendNotification({
                userId: Number(assigned_to),
                title: 'New Snag Assigned',
                body: `${authUser.name} assigned a new snag to you: ${title}`,
                type: 'snag_assigned',
                data: { snagId: String(snag.id), projectId: String(project_id) }
            });
        }

        // Notify Admins in the organization (except creator and assignee)
        try {
            const admins = await users.findAll({
                where: {
                    organization_id: authUser.organization_id,
                    role: 'admin',
                    id: { [Op.notIn]: [authUser.user_id, Number(assigned_to)].filter(Boolean) }
                }
            });

            for (const adminUser of admins) {
                await sendNotification({
                    userId: adminUser.id,
                    title: 'New Snag Created',
                    body: `${authUser.name} created a new snag: ${title}`,
                    type: 'snag_creation_admin',
                    data: { snagId: String(snag.id), projectId: String(project_id) }
                });
            }
        } catch (err) {
            console.error('Error notifying admins of new snag:', err);
        }

        const full = await snags.findByPk((snag as any).id, {
            include: [
                { model: users, as: 'assignee', attributes: ['id', 'name'] },
                { model: users, as: 'creator', attributes: ['id', 'name'] },
            ],
        });
        res.status(201).json({ snag: await withPresignedUrl(full!) });
    } catch (err) {
        console.error('createSnag error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// PATCH /snags/:id/status  — cycle status
export const updateSnagStatus = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { id } = req.params;
        const { status } = req.body;
        const valid = ['amber', 'green', 'red'];
        if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

        const snag = await snags.findByPk(id);
        if (!snag) return res.status(404).json({ error: 'Snag not found' });

        (snag as any).status = status;
        await snag.save();

        if (authUser) {
            await activities.create({
                project_id: (snag as any).project_id,
                user_id: authUser.user_id,
                type: 'edit',
                description: `Updated status for snag "${(snag as any).title}"`
            });
        }
        res.json({ snag });

        // Notify assignee and creator if status changed by someone else
        const notifyIds = new Set<number>();
        if (snag.assigned_to && snag.assigned_to !== authUser.user_id) notifyIds.add(snag.assigned_to);
        if (snag.created_by && snag.created_by !== authUser.user_id) notifyIds.add(snag.created_by);

        for (const uid of notifyIds) {
            await sendNotification({
                userId: uid,
                title: 'Snag Status Updated',
                body: `${authUser.name} updated status to ${status} for snag: ${snag.title}`,
                type: 'snag_status_update',
                data: { snagId: String(snag.id), projectId: String(snag.project_id) }
            });
        }
    } catch (err) {
        console.error('updateSnagStatus error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// DELETE /snags/:id
export const deleteSnag = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { id } = req.params;
        const snag = await snags.findByPk(id);
        if (!snag) return res.status(404).json({ error: 'Snag not found' });

        if (authUser.role !== 'admin' && authUser.role !== 'superadmin' && (snag as any).created_by !== authUser.user_id)
            return res.status(403).json({ error: 'Forbidden' });

        await snag.destroy();
        res.json({ message: 'Deleted' });
    } catch (err) {
        console.error('deleteSnag error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// GET /snags/assignees?project_id=X  — non-client project members
export const getAssignees = async (req: Request, res: Response) => {
    try {
        const { project_id } = req.query;
        if (!project_id) return res.status(400).json({ error: 'project_id is required' });

        const members = await project_members.findAll({
            where: { project_id: Number(project_id) },
            include: [
                {
                    model: users,
                    attributes: ['id', 'name', 'email', 'role'],
                    where: { role: { [Op.ne]: 'client' } },
                    required: true,
                },
            ],
            attributes: [],
        });

        const assignees = members.map((m: any) => {
            const u = m.user ?? m.dataValues?.user;
            return u?.toJSON ? u.toJSON() : u;
        });

        res.json({ assignees });
    } catch (err) {
        console.error('getAssignees error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
