import type { Request, Response } from 'express';
import { notifications } from '../models/index.ts';

/**
 * List all notifications for the current user
 * GET /api/notifications
 */
export const listNotifications = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

        const data = await notifications.findAll({
            where: { user_id: authUser.user_id },
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
