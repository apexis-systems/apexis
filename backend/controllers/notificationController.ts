import type { Request, Response } from 'express';
import { notifications, projects, Sequelize, Sequelize as SequelizeType } from '../models/index.ts';
import { Op } from 'sequelize';
/**
 * List all notifications for the current user
 * GET /api/notifications
 */
export const listNotifications = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

        const { project_id, type } = req.query;
        let where: any = { user_id: authUser.user_id };
        
        if (project_id && project_id !== 'all') where.project_id = project_id;
        
        if (type && type !== 'all') {
            const categories: Record<string, string[]> = {
                chat: ['chat'],
                file: ['file_upload', 'file_upload_admin', 'file_visibility'],
                photo: ['photo_upload', 'photo_comment'],
                snag: ['snag_assigned', 'snag_creation_admin', 'snag_status_update'],
                rfi: ['rfi_created', 'rfi_assigned', 'rfi_status_update', 'rfi_comment'],
            };

            if (categories[type as string]) {
                where.type = { [Op.in]: categories[type as string] };
            } else {
                where.type = type;
            }
        }

        const data = await notifications.findAll({
            where,
            include: [{
                model: projects,
                attributes: ['id', 'name']
            }],
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        res.status(200).json({ notifications: data });
    } catch (error) {
        console.error('List Notifications Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Mark a single notification as read
 * PATCH /api/notifications/:id/read
 */
export const markAsRead = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { id } = req.params;

        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

        const notif = await notifications.findOne({
            where: { id, user_id: authUser.user_id }
        });

        if (!notif) return res.status(404).json({ error: 'Notification not found' });

        await notif.update({ is_read: true });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Mark Read Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Mark all notifications as read for current user
 * PATCH /api/notifications/read-all
 */
export const markAllRead = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

        await notifications.update(
            { is_read: true },
            { where: { user_id: authUser.user_id, is_read: false } }
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Mark All Read Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
