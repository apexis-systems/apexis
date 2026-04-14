import type { Request, Response } from "express";
import { activities, users, projects, project_members, organizations } from '../models/index.ts';
import { Op } from "sequelize";
import { logActivity } from "../utils/activityUtils.ts";

export const getActivities = async (req: Request | any, res: Response) => {
    try {
        const authUser = req.user;
        const { organization_id, user_id, user_ids, type, project_id, project_ids } = req.query;
        let where: any = {};
        let projectWhere: any = {};

        // Parse multi-value params (comma-separated)
        const projectIdList: number[] = project_ids
            ? (project_ids as string).split(',').map(Number).filter(Boolean)
            : project_id ? [parseInt(project_id as string, 10)] : [];

        const userIdList: number[] = user_ids
            ? (user_ids as string).split(',').map(Number).filter(Boolean)
            : user_id ? [parseInt(user_id as string, 10)] : [];

        // Determine accessible projects for the user
        if (authUser.role !== 'superadmin' && authUser.role !== 'admin') {
            // Contributor or Client: Must be a member of the project to see its activities
            const userProjects = await project_members.findAll({
                where: { user_id: authUser.user_id },
                attributes: ['project_id']
            });
            const accessibleProjectIds = userProjects.map((p: any) => p.project_id);

            if (projectIdList.length > 0) {
                // Filter: only include project IDs the user has access to
                const allowed = projectIdList.filter(id => accessibleProjectIds.includes(id));
                if (allowed.length === 0) return res.status(200).json({ activities: [] });
                where.project_id = { [Op.in]: allowed };
            } else {
                where.project_id = { [Op.in]: accessibleProjectIds };
            }
        } else if (projectIdList.length > 0) {
            where.project_id = projectIdList.length === 1 ? projectIdList[0] : { [Op.in]: projectIdList };
        }

        // 1. Determine all organizations the user belongs to
        const myProjectOrgs = await project_members.findAll({
            where: { user_id: authUser.user_id },
            include: [{ model: projects, attributes: ['organization_id'] }]
        }).then((pms: any) => pms.map((pm: any) => pm.project?.organization_id).filter(Boolean));

        const myOrgs = [...new Set([authUser.organization_id, ...myProjectOrgs].filter(Boolean))];

        if (authUser.role === 'superadmin') {
            if (organization_id) {
                projectWhere.organization_id = organization_id;
            }
        } else {
            projectWhere.organization_id = { [Op.in]: myOrgs };
            if (organization_id) {
                projectWhere.organization_id = organization_id;
            }
        }

        // Apply user filter (multi or single)
        if (userIdList.length === 1) where.user_id = userIdList[0];
        else if (userIdList.length > 1) where.user_id = { [Op.in]: userIdList };

        if (type) where.type = type;

        // Fetch activities only for projects within the determined organization(s) and membership scope
        const feed = await activities.findAll({
            where,
            limit: 50,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: users,
                    as: 'user',
                    attributes: ['id', 'name', 'email']
                },
                {
                    model: projects,
                    attributes: ['id', 'name', 'organization_id'],
                    where: projectWhere,
                    include: [{ model: organizations, as: 'organization', attributes: ['name'] }]
                }
            ]
        });

        // Format for frontend
        const formattedFeed = feed.map((act: any) => {
            let desc = act.description;
            let metadata = act.metadata; // Prioritize new column
            
            // Extract metadata if exists (delimited by \u200B\u200B) - legacy fallback
            if (!metadata && desc && desc.includes('\u200B\u200B')) {
                const parts = desc.split('\u200B\u200B');
                if (parts.length >= 2) {
                    try {
                        metadata = JSON.parse(parts[1]);
                        desc = parts[0]; // Clean description for UI
                    } catch (e) {
                        console.error('Metadata parse error:', e);
                    }
                }
            }

            return {
                id: act.id,
                type: act.type,
                description: desc,
                metadata,
                projectName: act.project ? act.project.name : 'System',
                organizationName: act.project?.organization?.name || 'Apexis',
                projectId: act.project_id,
                userName: act.user ? act.user.name : 'Unknown',
                timestamp: act.createdAt
            };
        });

        res.status(200).json({ activities: formattedFeed });
    } catch (error) {
        console.error('getActivities error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createActivity = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.user_id;
        const { project_id, type, description, metadata } = req.body;

        if (!project_id || !type || !description) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Deduplication guard: prevent double-logging same type for same project+user within 10 seconds
        const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
        const recent = await activities.findOne({
            where: {
                project_id: parseInt(project_id, 10),
                user_id: userId,
                type,
                createdAt: { [Op.gte]: tenSecondsAgo }
            },
            order: [['createdAt', 'DESC']]
        });

        if (recent) {
            // Already logged this action recently — return the existing one instead of creating a duplicate
            return res.status(200).json({ message: 'Activity already logged', activity: recent, deduplicated: true });
        }

        // Parse metadata if it's a JSON string
        let parsedMetadata: any = undefined;
        if (metadata) {
            if (typeof metadata === 'string') {
                try { parsedMetadata = JSON.parse(metadata); } catch { parsedMetadata = undefined; }
            } else {
                parsedMetadata = metadata;
            }
        }

        const newActivity = await logActivity({
            projectId: parseInt(project_id, 10),
            userId,
            type,
            description,
            metadata: parsedMetadata
        });

        res.status(201).json({ message: 'Activity logged successfully', activity: newActivity });
    } catch (error) {
        console.error('createActivity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
