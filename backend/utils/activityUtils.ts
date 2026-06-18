import { activities, project_members, users, projects, project_member_folders } from '../models/index.ts';
import { getIO } from '../socket.ts';
import { Op } from 'sequelize';
import { sendNotification } from '../utils/notificationUtils.ts';

export const checkActivityAccess = async (
    userId: number,
    role: string,
    activity: any,
    allowedFolderIds: number[],
    memberId: number
): Promise<boolean> => {
    if (role === 'superadmin' || role === 'admin' || role === 'contributor') {
        return true;
    }

    if (role !== 'consultant' && role !== 'vendor') {
        return true;
    }

    const metadata = activity.metadata;
    const folderId = metadata?.folderId ? Number(metadata.folderId) : null;
    const type = activity.type;

    // 1. File/Folder actions
    const isFolderAction = folderId !== null || 
        ['upload', 'delete', 'upload_photo', 'uploaded'].includes(type);

    if (isFolderAction) {
        return folderId !== null && allowedFolderIds.includes(folderId);
    }

    // 2. RFI actions
    if (metadata?.rfiId) {
        const { rfis } = await import('../models/index.ts');
        const rfi = await rfis.findByPk(Number(metadata.rfiId));
        if (!rfi) return false;
        if (Number(rfi.assigned_to) === userId || Number(rfi.created_by) === userId) {
            return true;
        }
        const linkedFolderIds = Array.isArray(rfi.folder_ids) ? rfi.folder_ids.map(Number) : [];
        return linkedFolderIds.some((fid: number) => allowedFolderIds.includes(fid));
    }

    // 3. Snag actions
    if (metadata?.snagId) {
        const { snags } = await import('../models/index.ts');
        const snag = await snags.findByPk(Number(metadata.snagId));
        if (!snag) return false;
        if (Number(snag.assigned_to) === userId || Number(snag.created_by) === userId) {
            return true;
        }
        const linkedFolderIds = Array.isArray(snag.folder_ids) ? snag.folder_ids.map(Number) : [];
        return linkedFolderIds.some((fid: number) => allowedFolderIds.includes(fid));
    }

    // 4. Comment / Photo Comment actions
    if ((type === 'comment' || type === 'photo_comment') && metadata?.fileId) {
        const { files } = await import('../models/index.ts');
        const file = await files.findByPk(Number(metadata.fileId));
        if (!file || !file.folder_id) return false;
        return allowedFolderIds.includes(Number(file.folder_id));
    }

    return false;
};

export const logActivity = async ({
    projectId,
    userId,
    type,
    description,
    metadata,
    skipNotifications = false
}: {
    projectId: number;
    userId: number;
    type: string;
    description: string;
    metadata?: any;
    skipNotifications?: boolean;
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
            attributes: ['id', 'user_id', 'role']
        });

        const restrictedMembers = members.filter((m: any) => m.role === 'consultant' || m.role === 'vendor');
        const restrictedMemberIds = restrictedMembers.map((m: any) => m.id);

        const memberFolders = restrictedMemberIds.length > 0 ? await project_member_folders.findAll({
            where: { project_member_id: { [Op.in]: restrictedMemberIds } }
        }) : [];

        const recipientIds = new Set<number>();

        for (const member of members) {
            let hasAccess = true;
            if (member.role === 'consultant' || member.role === 'vendor') {
                const allowedFolders = memberFolders
                    .filter((mf: any) => mf.project_member_id === member.id)
                    .map((mf: any) => Number(mf.folder_id));
                hasAccess = await checkActivityAccess(member.user_id, member.role, newActivity, allowedFolders, member.id);
            }
            if (hasAccess) {
                recipientIds.add(member.user_id);
            }
        }

        // Admins of the organization
        const admins = await users.findAll({
            where: {
                organization_id: project.organization_id,
                role: 'admin'
            },
            attributes: ['id']
        });
        admins.forEach((a: any) => recipientIds.add(a.id));

        // 4. Emit via Socket & Push Notifications
        try {
            const io = getIO();

            // Broadcast to superadmins
            io.to('superadmin-room').emit('new-activity', formattedActivity);

            // Map activity type to notification type for deep-linking
            let notifType = 'activity';
            if (type === 'upload_photo') notifType = 'photo_upload';
            if (type === 'upload') notifType = 'file_upload';
            if (type === 'snag_update') notifType = 'snag_status_update';
            if (type === 'rfi_update') notifType = 'rfi_status_update';
            if (type === 'photo_comment') notifType = 'photo_comment';
            if (type === 'comment') notifType = 'comment';
            if (type === 'edit' && metadata.type === "snags") notifType = 'snag_created';
            if (type === 'edit' && metadata.type === "rfi") notifType = 'rfi_created';

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
                // Socket (always emit for real-time activity feed)
                io.to(`user-${id}`).emit('new-activity', formattedActivity);

                // Push Notification — skip if caller handles its own notifications
                if (!skipNotifications && id !== userId) {
                    const senderName = formattedActivity.userName || 'Someone';
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

