import type { Request, Response } from "express";
import { activities, users, projects } from '../models/index.ts';

export const getActivities = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.user_id;

        // Fetch activities, sorted by newest first
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
                    attributes: ['id', 'name']
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
