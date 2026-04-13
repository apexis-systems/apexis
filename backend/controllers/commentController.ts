import type { Request, Response } from 'express';
import { comments, users, files, activities, project_members } from '../models/index.ts';
import { sendNotification } from '../utils/notificationUtils.ts';
import { logActivity } from "../utils/activityUtils.ts";

export const getComments = async (req: Request, res: Response) => {
    try {
        const { file_id } = req.query;
        if (!file_id) return res.status(400).json({ error: 'file_id is required' });

        const all = await comments.findAll({
            where: { file_id: Number(file_id) },
            include: [{ model: users, as: 'user', attributes: ['id', 'name', 'email'] }],
            order: [['createdAt', 'ASC']],
        });

        const raw = all.map((c: any) => c.toJSON());
        const topLevel = raw.filter((c: any) => !c.parent_id);
        const threaded = topLevel.map((c: any) => ({
            ...c,
            replies: raw.filter((r: any) => r.parent_id === c.id),
        }));

        res.json({ comments: threaded });
    } catch (error) {
        console.error('getComments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const addComment = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

        const { file_id, text, parent_id } = req.body;
        if (!file_id || !text?.trim()) return res.status(400).json({ error: 'file_id and text are required' });

        const file = await files.findByPk(file_id);
        if (!file) return res.status(404).json({ error: 'File not found' });

        const comment = await comments.create({
            file_id: Number(file_id),
            user_id: authUser.user_id,
            text: text.trim(),
            parent_id: parent_id ? Number(parent_id) : null,
        });

        const withUser = await comments.findByPk((comment as any).id, {
            include: [{ model: users, as: 'user', attributes: ['id', 'name', 'email'] }],
        });

        res.status(201).json({ comment: withUser });
        
        // --- ASYNC: Notifications and Activities ---
        // (Don't await these to keep response time fast)
        (async () => {
            try {
                const isImage = file.file_type?.startsWith('image/');
                const activityCategory = isImage ? 'photos' : 'documents';

                // 1. Log Activity
                await logActivity({
                    projectId: file.project_id,
                    userId: authUser.user_id,
                    type: isImage ? 'photo_comment' : 'comment',
                    description: `${authUser.name} commented on ${isImage ? 'photo' : 'file'}: ${file.file_name}`,
                    metadata: { folderId: file.folder_id, type: activityCategory }
                });

                // 2. Send Notification to File Uploader
                // Only if uploader is NOT the commenter
                if (file.created_by !== authUser.user_id) {
                    const uploaderMembership = await project_members.findOne({
                        where: { project_id: file.project_id, user_id: file.created_by }
                    });
                    if (uploaderMembership) {
                        await sendNotification({
                            userId: file.created_by,
                            title: isImage ? 'New Photo Comment' : 'New File Comment',
                            body: `${authUser.name} commented on your ${isImage ? 'photo' : 'file'}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
                            type: isImage ? 'photo_comment' : 'comment',
                            data: {
                                fileId: String(file.id),
                                projectId: String(file.project_id),
                                folderId: String(file.folder_id),
                                type: activityCategory,
                                commentId: String(comment.id)
                            }
                        });
                    }
                }
            } catch (err) {
                console.error('Comment notification/activity error:', err);
            }
        })();

    } catch (error) {
        console.error('addComment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteComment = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { id } = req.params;

        const comment = await comments.findByPk(id);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        const c = comment as any;
        if (c.user_id !== authUser.user_id && authUser.role !== 'admin' && authUser.role !== 'superadmin') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await comment.destroy();
        res.json({ message: 'Comment deleted' });
    } catch (error) {
        console.error('deleteComment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
