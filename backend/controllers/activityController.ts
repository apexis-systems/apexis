import type { Request, Response } from "express";
import { activities, users, projects } from '../models/index.ts';

export const getActivities = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.user_id;
        const orgId = req.user.organization_id; // Current user's organization

        // Fetch activities only for projects within this user's organization
        const feed = await activities.findAll({
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
                    where: {
                        organization_id: orgId
                    }
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
