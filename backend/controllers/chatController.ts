import type { Request, Response } from 'express';
import { messaging } from '../config/firebase.ts';
import { users, rooms, room_members, chat_messages, sequelize, notifications, projects, project_members, organizations } from '../models/index.ts';
import { Op } from 'sequelize';
import { getIO, isUserOnline } from '../socket.ts';
import { sendNotification } from '../utils/notificationUtils.ts';
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const getProjectScopedChatContext = async (authUser: any, projectId?: number | null) => {
    if (!projectId) {
        return { actualOrgId: authUser.organization_id, project: null, allowedUserIds: null as Set<number> | null };
    }

    const project = await projects.findByPk(projectId);
    if (!project) {
        throw new Error('PROJECT_NOT_FOUND');
    }

    const isProjectMember = await project_members.findOne({
        where: { project_id: projectId, user_id: authUser.user_id }
    });
    const isProjectAdmin = authUser.role === 'admin' && authUser.organization_id === project.organization_id;
    const isSuperadmin = authUser.role === 'superadmin';

    if (!isProjectMember && !isProjectAdmin && !isSuperadmin) {
        throw new Error('PROJECT_ACCESS_DENIED');
    }

    const memberRows = await project_members.findAll({
        where: { project_id: projectId },
        attributes: ['user_id']
    });
    const adminRows = await users.findAll({
        where: {
            organization_id: project.organization_id,
            role: 'admin'
        },
        attributes: ['id']
    });

    const allowedUserIds = new Set<number>([
        ...memberRows.map((member: any) => Number(member.user_id)),
        ...adminRows.map((admin: any) => Number(admin.id))
    ]);

    return { actualOrgId: project.organization_id, project, allowedUserIds };
};

/**
 * List all chat rooms for the current user
 * GET /api/chats
 */
export const listRooms = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

        // Find all rooms where the user is a member
        const userRooms = await rooms.findAll({
            where: {
                id: {
                    [Op.in]: sequelize.literal(`(SELECT "room_id" FROM "room_members" WHERE "user_id" = ${authUser.user_id})`)
                }
            },
            attributes: {
                include: [
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM "chat_messages" AS cm
                            JOIN "room_members" AS rm ON cm."room_id" = rm."room_id"
                            WHERE cm."room_id" = "rooms"."id" 
                            AND rm."user_id" = ${authUser.user_id}
                            AND cm."createdAt" > rm."last_read_at"
                            AND cm."sender_id" != ${authUser.user_id}
                        )`),
                        'unread_count'
                    ]
                ]
            },
            include: [
                {
                    model: room_members,
                    include: [{
                        model: users,
                        attributes: ['id', 'name', 'role', 'profile_pic', 'organization_id'],
                        include: [{ model: organizations, attributes: ['name'] }]
                    }]
                },
                {
                    model: chat_messages,
                    limit: 1,
                    order: [['createdAt', 'DESC']],
                    include: [{ model: users, as: 'sender', attributes: ['id', 'name'] }]
                }
            ],
            order: [['updatedAt', 'DESC']]
        });

        res.status(200).json({ rooms: userRooms });
    } catch (error) {
        console.error('List Rooms Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Get message history for a room
 * GET /api/chats/:roomId/messages
 */
export const getRoomMessages = async (req: Request, res: Response) => {
    try {
        const { roomId } = req.params;
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

        // Check if user is member of room
        const membership = await room_members.findOne({
            where: { room_id: roomId, user_id: authUser.user_id }
        });
        if (!membership) {
            console.warn(`[CHAT] 403 Forbidden: User ${authUser.user_id} requested room ${roomId} messages but is not a member.`);
            return res.status(403).json({ error: 'Forbidden' });
        }

        const messages = await chat_messages.findAll({
            where: { room_id: roomId },
            include: [
                { model: users, as: 'sender', attributes: ['id', 'name', 'role'] },
                {
                    model: chat_messages,
                    as: 'parent',
                    include: [{ model: users, as: 'sender', attributes: ['id', 'name'] }]
                }
            ],
            order: [['createdAt', 'ASC']]
        });

        const s3Client = new S3Client({
            region: process.env.AWS_REGION || "ap-south-2",
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
            }
        });
        const BUCKET_NAME = process.env.S3_BUCKET_NAME || "apexis-bucket";

        // Generate signed URLs for attachments
        const serializedMessages = await Promise.all(messages.map(async (msg: any) => {
            const data = msg.toJSON();
            if (data.file_url) {
                const command = new GetObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: data.file_url
                });
                data.downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            }
            return data;
        }));

        // Mark as read
        await room_members.update(
            { last_read_at: new Date() },
            { where: { room_id: roomId, user_id: authUser.user_id } }
        );

        res.status(200).json({ messages: serializedMessages });
    } catch (error) {
        console.error('Get Messages Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Send a message and trigger FCM notification
 * POST /api/chats/send
 */
export const sendChatMessage = async (req: Request, res: Response) => {
    try {
        const { roomId, text, recipientId, type, file_url, file_name, file_type, file_size } = req.body;
        const authUser = (req as any).user;

        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
        if (!roomId || (!text && !file_url)) return res.status(400).json({ error: 'Missing required fields' });

        // 1. Save message to DB
        const newMessage = await chat_messages.create({
            room_id: roomId,
            sender_id: authUser.user_id,
            text: text || null,
            type: type || 'text',
            file_url: file_url || null,
            file_name: file_name || null,
            file_type: file_type || null,
            file_size: file_size || null,
            seen: false,
            parent_id: req.body.parent_id || null
        });

        // Update room updatedAt for sorting
        await rooms.update({ updatedAt: new Date() }, { where: { id: roomId } });

        // Re-fetch message with sender info and parent info for broadcast
        const messageWithSender = await chat_messages.findByPk(newMessage.id, {
            include: [
                { model: users, as: 'sender', attributes: ['id', 'name', 'profile_pic'] },
                {
                    model: chat_messages,
                    as: 'parent',
                    include: [{ model: users, as: 'sender', attributes: ['id', 'name'] }]
                }
            ]
        });

        // 2. Trigger Notifications
        const otherMembers = await room_members.findAll({
            where: { room_id: roomId, user_id: { [Op.ne]: authUser.user_id } },
            include: [{
                model: users,
                attributes: ['id', 'fcm_token']
            }]
        });

        const allMembers = await room_members.findAll({
            where: { room_id: roomId },
            include: [{ model: users, attributes: ['id', 'fcm_token'] }]
        });

        const notificationBody = text || (type === 'image' ? 'Sent an image' : type === 'file' ? 'Sent a file' : 'New message');

        for (const member of otherMembers) {
            await sendNotification({
                userId: member.user_id,
                title: authUser.name || 'New Message',
                body: notificationBody,
                type: 'chat',
                data: {
                    roomId: String(roomId),
                    messageId: String(newMessage.id)
                }
            });
        }

        const BUCKET_NAME = process.env.S3_BUCKET_NAME || "apexis-bucket";
        const messageJson = messageWithSender?.toJSON() as any;
        if (messageJson.file_url) {
            const s3Client = new S3Client({
                region: process.env.AWS_REGION || "ap-south-2",
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
                }
            });
            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: messageJson.file_url
            });
            messageJson.downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        }

        // 3. Socket broadcast
        try {
            const io = getIO();
            const roomName = `room-${roomId}`;
            console.log(`[SOCKET] Broadcasting new-message to ${roomName}`);
            // To the room (for active chat windows)
            io.to(roomName).emit('new-message', messageJson);

            // Globally to each member (for list reordering/notifications)
            for (const member of allMembers) {
                const userRoom = `user-${member.user_id}`;
                console.log(`[SOCKET] Broadcasting new-message-global to ${userRoom}`);
                io.to(userRoom).emit('new-message-global', {
                    room_id: roomId,
                    message: messageJson,
                    sender_name: authUser.name
                });
            }
        } catch (ioErr) {
            console.error('Socket broadcast error:', ioErr);
        }

        res.status(200).json({ success: true, message: messageJson });
    } catch (error) {
        console.error('Send Chat Message Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Mark message as seen
 * PATCH /api/chats/seen
 */
export const markMessageSeen = async (req: Request, res: Response) => {
    try {
        const { messageId } = req.body;
        const authUser = (req as any).user;

        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
        if (!messageId) return res.status(400).json({ error: 'MessageId is required' });

        const msg = await chat_messages.findByPk(messageId);
        if (msg) {
            await msg.update({ seen: true });
            try {
                const io = getIO();
                io.to(`room-${msg.room_id}`).emit('message-seen-update', { messageId });
            } catch (ioErr) {
                console.error('Socket broadcast error in markSeen:', ioErr);
            }
        }

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Mark all messages in a room as read
 * PATCH /api/chats/:roomId/read
 */
export const markRoomRead = async (req: Request, res: Response) => {
    try {
        const { roomId } = req.params;
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

        await room_members.update(
            { last_read_at: new Date() },
            { where: { room_id: roomId, user_id: authUser.user_id } }
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Mark Room Read Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Upload a file for chat
 * POST /api/chats/upload
 */
export const uploadChatFile = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        if (!(req as any).file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const file = (req as any).file;
        const file_name = file.originalname;
        const file_type = file.mimetype;
        const file_size = (file.size / 1024).toFixed(2) + " KB"; // Format size

        const s3Client = new S3Client({
            region: process.env.AWS_REGION || "ap-south-2",
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
            }
        });

        const BUCKET_NAME = process.env.S3_BUCKET_NAME || "apexis-bucket";
        const extMatch = file_name.match(/\.[0-9a-z]+$/i);
        const extension = extMatch ? extMatch[0] : '';
        const s3Key = `chats/${authUser.user_id}/${Date.now()}${extension}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            ContentType: file_type,
            Body: file.buffer
        });

        await s3Client.send(command);

        res.status(200).json({
            success: true,
            file_url: s3Key,
            file_name,
            file_type,
            file_size
        });
    } catch (error) {
        console.error("Upload Chat File Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const createRoom = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { type, name, memberIds, project_id, organization_id } = req.body;

        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

        let actualOrgId = authUser.organization_id;
        let allowedUserIds: Set<number> | null = null;

        try {
            const context = await getProjectScopedChatContext(authUser, project_id ? Number(project_id) : null);
            actualOrgId = context.actualOrgId;
            allowedUserIds = context.allowedUserIds;
        } catch (error: any) {
            if (error.message === 'PROJECT_NOT_FOUND') {
                return res.status(404).json({ error: 'Project not found' });
            }
            if (error.message === 'PROJECT_ACCESS_DENIED') {
                return res.status(403).json({ error: 'You do not have access to this project chat' });
            }
            throw error;
        }

        if (type === 'direct') {
            if (!memberIds || memberIds.length !== 1) {
                return res.status(400).json({ error: 'Direct chat requires exactly one recipient' });
            }

            const targetUserId = memberIds[0];

            const targetUser = allowedUserIds
                ? (allowedUserIds.has(Number(targetUserId)) ? await users.findByPk(targetUserId) : null)
                : await users.findOne({ where: { id: targetUserId, organization_id: actualOrgId } });
            if (!targetUser) {
                return res.status(404).json({ error: project_id ? 'User is not part of this project organization' : 'User not found in your organization' });
            }

            // Check if direct room already exists
            const existingRoom = await rooms.findOne({
                where: {
                    type: 'direct',
                    organization_id: actualOrgId
                },
                include: [
                    {
                        model: room_members,
                        where: { user_id: authUser.user_id }
                    }
                ]
            });

            // If found a room where we are a member, check if the other user is also a member of THAT room
            if (existingRoom) {
                const otherMembership = await room_members.findOne({
                    where: { room_id: existingRoom.id, user_id: targetUserId }
                });
                if (otherMembership) {
                    return res.status(200).json({ room: existingRoom });
                }
            }

            // Create new direct room
            const newRoom = await rooms.create({
                type: 'direct',
                organization_id: actualOrgId,
                project_id: project_id || null
            });

            await room_members.bulkCreate([
                { room_id: newRoom.id, user_id: authUser.user_id },
                { room_id: newRoom.id, user_id: targetUserId }
            ]);

            const roomWithMembers = await rooms.findByPk(newRoom.id, {
                include: [{ model: room_members, include: [{ model: users, attributes: ['id', 'name', 'role'] }] }]
            });

            return res.status(201).json({ room: roomWithMembers });
        } else if (type === 'group') {
            if (authUser.role !== 'admin' && authUser.role !== 'contributor') {
                return res.status(403).json({ error: 'Only admins and contributors can create group chats' });
            }
            if (!name) return res.status(400).json({ error: 'Group name is required' });
            const allMemberIds = [...new Set([...memberIds, authUser.user_id])];

            if (allowedUserIds) {
                const hasInvalidUser = allMemberIds.some(uid => !allowedUserIds?.has(Number(uid)));
                if (hasInvalidUser) {
                    return res.status(400).json({ error: 'Some selected users are not part of this project organization' });
                }
            } else {
                const validUsers = await users.findAll({
                    where: {
                        id: { [Op.in]: allMemberIds },
                        organization_id: actualOrgId
                    },
                    attributes: ['id']
                });

                if (validUsers.length !== allMemberIds.length) {
                    return res.status(400).json({ error: 'Some selected users do not belong to your organization' });
                }
            }

            const newRoom = await rooms.create({
                type: 'group',
                name: name,
                organization_id: actualOrgId,
                project_id: project_id || null
            });

            await room_members.bulkCreate(
                allMemberIds.map(uid => ({ room_id: newRoom.id, user_id: uid }))
            );

            const roomWithMembers = await rooms.findByPk(newRoom.id, {
                include: [{ model: room_members, include: [{ model: users, attributes: ['id', 'name', 'role'] }] }]
            });

            // Notify members about new group
            const otherMembers = allMemberIds.filter(uid => uid !== authUser.user_id);
            for (const uid of otherMembers) {
                try {
                    await sendNotification({
                        userId: uid,
                        title: 'New Group',
                        body: `${authUser.name || 'Someone'} added you to a group: ${name}`,
                        type: 'group_creation',
                        data: { roomId: String(newRoom.id) }
                    });

                    // Still need to broadcast room object for dynamic UI update
                    getIO().to(`user-${uid}`).emit('new-room-created', roomWithMembers);
                } catch (notifyErr) {
                    console.error(`Failed to notify user ${uid} of new group:`, notifyErr);
                }
            }

            return res.status(201).json({ room: roomWithMembers });
        }

        res.status(400).json({ error: 'Invalid room type' });
    } catch (error) {
        console.error('Create Room Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
