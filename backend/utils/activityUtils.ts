import { activities, project_members, users, projects } from '../models/index.ts';
import { getIO } from '../socket.ts';
import { Op } from 'sequelize';
import { sendNotification } from '../utils/notificationUtils.ts';

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

        // 4. Emit via Socket & Push Notifications
        try {
            const io = getIO();
            
            // Map activity type to notification type for deep-linking
            let notifType = 'activity';
            if (type === 'upload_photo') notifType = 'photo_upload';
            if (type === 'upload') notifType = 'file_upload';
            if (type === 'snag_update') notifType = 'snag_status_update';
            if (type === 'rfi_update') notifType = 'rfi_status_update';

            // Extract extra data from metadata if available for deep-linking
            const extraData: any = { projectId: String(projectId) };
            if (metadata) {
                if (metadata.folderId) extraData.folderId = String(metadata.folderId);
                if (metadata.fileId) extraData.fileId = String(metadata.fileId);
                if (metadata.type) extraData.type = metadata.type;
                if (metadata.snagId) extraData.snagId = String(metadata.snagId);
                if (metadata.rfiId) extraData.rfiId = String(metadata.rfiId);
            }

            for (const id of recipientIds) {
                // Socket
                io.to(`user-${id}`).emit('new-activity', formattedActivity);
                
                // Push Notification (only for OTHERS)
                if (id !== userId) {
                    const senderName = formattedActivity.userName || 'Someone';
                    // Create a friendly body like "John uploaded 5 photos"
                    // If description starts with "Uploaded", lowercase it for better flow
                    const cleanDescription = description.startsWith('Uploaded') 
                        ? description.charAt(0).toLowerCase() + description.slice(1) 
                        : description;

                    await sendNotification({
                        userId: id,
                        title: project.name || 'New Activity',
                        body: `${senderName} ${cleanDescription}`,
                        type: notifType,
                        data: extraData
                    });
                }
            }
        } catch (notifErr) {
            console.error('Notification error in logActivity:', notifErr);
        }

        return newActivity;
    } catch (error) {
        console.error('logActivity error:', error);
        throw error;
    }
};
