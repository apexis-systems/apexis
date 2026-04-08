import type { Request, Response } from 'express';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { manuals, users, organizations } from '../models/index.ts';

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});
const BUCKET = process.env.S3_BUCKET_NAME || 'apexis-bucket';

const presign = async (item: any) => {
    const json = item.toJSON ? item.toJSON() : { ...item };
    if (json.file_url) {
        try {
            const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: json.file_url });
            json.downloadUrl = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
        } catch { json.downloadUrl = null; }
    }
    return json;
};

// GET /manuals?project_id=X
export const getManuals = async (req: Request, res: Response) => {
    try {
        const { project_id } = req.query;
        if (!project_id) return res.status(400).json({ error: 'project_id required' });

        const data = await manuals.findAll({
            where: { project_id: Number(project_id) },
            include: [{ model: users, as: 'uploader', attributes: ['id', 'name'] }],
            order: [['createdAt', 'DESC']],
        });

        const result = await Promise.all(data.map(presign));
        res.json({ manuals: result });
    } catch (err) {
        console.error('getManuals:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /manuals  (multipart: file + project_id + type)
export const uploadManual = async (req: Request | any, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
        if (!['admin', 'superadmin'].includes(authUser.role))
            return res.status(403).json({ error: 'Only admins can upload manuals/SOPs' });

        const { project_id, type } = req.body;
        if (!project_id || !req.file) return res.status(400).json({ error: 'project_id and file required' });

        const ext = req.file.originalname.match(/\.[0-9a-z]+$/i)?.[0] || '.pdf';
        const key = `projects/${project_id}/manuals/${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET, Key: key,
            ContentType: req.file.mimetype, Body: req.file.buffer,
        }));

        const file_size_mb = parseFloat((req.file.size / (1024 * 1024)).toFixed(2));
        const record = await manuals.create({
            project_id: Number(project_id),
            file_name: req.file.originalname,
            file_url: key,
            file_size_mb,
            type: type || 'manual',
            uploaded_by: authUser.user_id,
        });

        await organizations.increment(
            { storage_used_mb: file_size_mb },
            { where: { id: authUser.organization_id } }
        );

        const full = await manuals.findByPk((record as any).id, {
            include: [{ model: users, as: 'uploader', attributes: ['id', 'name'] }],
        });
        res.status(201).json({ manual: await presign(full!) });
    } catch (err) {
        console.error('uploadManual:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// DELETE /manuals/:id
export const deleteManual = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { id } = req.params;
        const record = await manuals.findByPk(id);
        if (!record) return res.status(404).json({ error: 'Not found' });

        if (!['admin', 'superadmin'].includes(authUser.role) && (record as any).uploaded_by !== authUser.user_id)
            return res.status(403).json({ error: 'Forbidden' });

        const sizeToFree = Number((record as any).file_size_mb || 0);
        await record.destroy();

        if (sizeToFree > 0) {
            const org = await organizations.findByPk(authUser.organization_id);
            if (org) {
                const current = Number((org as any).storage_used_mb || 0);
                await org.update({ storage_used_mb: Math.max(0, current - sizeToFree) });
            }
        }

        res.json({ message: 'Deleted' });
    } catch (err) {
        console.error('deleteManual:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
