import { activities, project_members, users, projects } from '../models/index.ts';
import { getIO } from '../socket.ts';
import { Op } from 'sequelize';

export const logActivity = async ({
    projectId,
    userId,
    type,
    description,
    metadata
}: {
    projectId: number;
    userId: number;
    type: string;
    description: string;
    metadata?: any;
}) => {
    try {
        // 1. Create activity in DB
        const newActivity = await activities.create({
            project_id: projectId,
            user_id: userId,
            type,
            description: description,
            metadata: metadata
        });

        // 2. Fetch full activity details (with user and project) for socket broadcast
        const fullActivity = await activities.findByPk(newActivity.id, {
            include: [
                {
                    model: users,
                    as: 'user',
                    attributes: ['id', 'name', 'email']
                },
                {
                    model: projects,
                    attributes: ['id', 'name', 'organization_id']
                }
            ]
        });

        if (!fullActivity) return newActivity;

        const formattedActivity = {
            id: fullActivity.id,
            type: fullActivity.type,
            description: fullActivity.description,
            metadata: fullActivity.metadata,
            projectName: fullActivity.project ? fullActivity.project.name : 'System',
            projectId: fullActivity.project_id,
            userName: fullActivity.user ? fullActivity.user.name : 'Unknown',
            timestamp: fullActivity.createdAt
        };

        // 3. Identify recipients
        const project = await projects.findByPk(projectId);
        if (!project) return newActivity;

        // Members of the project
        const members = await project_members.findAll({
            where: { project_id: projectId },
            attributes: ['user_id']
        });

        // Admins of the organization
        const admins = await users.findAll({
            where: {
                organization_id: project.organization_id,
                role: 'admin'
            },
            attributes: ['id']
        });

        const recipientIds = new Set<number>();
        members.forEach((m: any) => recipientIds.add(m.user_id));
        admins.forEach((a: any) => recipientIds.add(a.id));

        // 4. Emit via Socket
        try {
            const io = getIO();
            recipientIds.forEach(id => {
                io.to(`user-${id}`).emit('new-activity', formattedActivity);
            });
        } catch (socketErr) {
            console.error('Socket emission error in logActivity:', socketErr);
        }

        return newActivity;
    } catch (error) {
        console.error('logActivity error:', error);
        throw error;
    }
};
