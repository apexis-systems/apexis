import type { Request, Response } from 'express';
import { notifications, projects, project_members, organizations, Sequelize, users } from '../models/index.ts';
import { Op } from 'sequelize';
/**
 * List all notifications for the current user
 * GET /api/notifications
 */
export const listNotifications = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

        const { project_id, project_ids, type } = req.query;
        const activeRole = authUser.role;

        const where: any = { user_id: authUser.user_id };

        // Parse multi-value project IDs (comma-separated)
        const requestedProjectIds: number[] = project_ids
            ? (project_ids as string).split(',').map(Number).filter(Boolean)
            : project_id && project_id !== 'all' ? [Number(project_id)] : [];

        // 1. Determine projects matching the active role or memberships
        let roleProjectIds: number[] = [];
        if (activeRole !== 'superadmin') {
            // Include projects where the user has an explicit membership record
            const memberships = await project_members.findAll({
                where: { user_id: authUser.user_id },
                attributes: ['project_id']
            });
            roleProjectIds = memberships.map((m: any) => m.project_id);

            // For admins, also include projects in their primary organization
            if (activeRole === 'admin') {
                const orgId = authUser.organization_id || (await users.findByPk(authUser.user_id))?.organization_id;
                if (orgId) {
                    const orgProjects = await projects.findAll({
                        where: { organization_id: orgId },
                        attributes: ['id']
                    });
                    const orgProjectIds = orgProjects.map((p: any) => p.id);
                    roleProjectIds = [...new Set([...roleProjectIds, ...orgProjectIds])];
                }
            }
        }

        if (activeRole !== 'superadmin') {
            if (requestedProjectIds.length > 0) {
                const allowed = requestedProjectIds.filter(id => roleProjectIds.includes(id));
                if (allowed.length === 0) return res.status(200).json({ notifications: [] });
                where.project_id = allowed.length === 1 ? allowed[0] : { [Op.in]: allowed };
            } else {
                where[Op.or] = [
                    { project_id: { [Op.in]: roleProjectIds } },
                    { project_id: null }
                ];
            }
        } else if (requestedProjectIds.length > 0) {
            where.project_id = requestedProjectIds.length === 1
                ? requestedProjectIds[0]
                : { [Op.in]: requestedProjectIds };
        }

        if (type && type !== 'all') {
            const categories: Record<string, string[]> = {
                chat: ['chat'],
                file: ['file_upload', 'file_upload_admin', 'file_visibility', 'folder_visibility'],
                photo: ['photo_upload', 'photo_comment'],
                snag: ['snag_assigned', 'snag_creation_admin', 'snag_status_update'],
                rfi: ['rfi_created', 'rfi_assigned', 'rfi_status_update', 'rfi_comment'],
                member: ['member_joined'],
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
                attributes: ['id', 'name', 'organization_id'],
                include: [{ model: organizations, as: 'organization', attributes: ['name'] }]
            }],
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        const formattedData = data.map((n: any) => {
            const json = n.toJSON();
            json.organizationName = json.project?.organization?.name || 'Apexis';
            return json;
        });

        res.status(200).json({ notifications: formattedData });
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
