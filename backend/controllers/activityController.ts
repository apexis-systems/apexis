import type { Request, Response } from "express";
import { activities, users, projects } from '../models/index.ts';

export const getActivities = async (req: Request | any, res: Response) => {
    try {
        const authUser = req.user;
        const { organization_id, user_id, type, project_id } = req.query;
        let where: any = {};
        let projectWhere: any = {};

        if (authUser.role === 'superadmin') {
            if (organization_id) {
                projectWhere.organization_id = organization_id;
            }
        } else {
            projectWhere.organization_id = authUser.organization_id;
        }

        if (user_id) where.user_id = user_id;
        if (type) where.type = type;
        if (project_id) where.project_id = project_id;

        // Fetch activities only for projects within the determined organization(s)
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
                    where: projectWhere
                }
            ]
        });

        // Format for frontend
        const formattedFeed = feed.map((act: any) => ({
            id: act.id,
            type: act.type,
            description: act.description,
            projectName: act.project ? act.project.name : 'System',
            projectId: act.project_id,
            userName: act.user ? act.user.name : 'Unknown',
            timestamp: act.createdAt
        }));

        res.status(200).json({ activities: formattedFeed });
    } catch (error) {
        console.error('getActivities error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createActivity = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.user_id;
        const { project_id, type, description } = req.body;

        if (!project_id || !type || !description) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newActivity = await activities.create({
            project_id: parseInt(project_id, 10),
            user_id: userId,
            type,
            description
        });

        res.status(201).json({ message: 'Activity logged successfully', activity: newActivity });
    } catch (error) {
        console.error('createActivity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
