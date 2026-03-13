import type { Request, Response } from 'express';
import { messaging } from '../config/firebase.ts';
import { users, rooms, room_members, chat_messages, sequelize } from '../models/index.ts';
import { Op } from 'sequelize';
import { getIO } from '../socket.ts';

/**
 * List all chat rooms for the current user
 * GET /api/chats
 */
export const listRooms = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

        // Find all rooms where the user is a member using a subquery for filtering
        const userRooms = await rooms.findAll({
            where: {
                id: {
                    [Op.in]: sequelize.literal(`(SELECT room_id FROM room_members WHERE user_id = ${authUser.user_id})`)
                }
            },
            include: [
                {
                    model: room_members,
                    include: [{ model: users, attributes: ['id', 'name', 'role', 'profile_pic'] }]
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
        if (!membership) return res.status(403).json({ error: 'Forbidden' });

        const messages = await chat_messages.findAll({
            where: { room_id: roomId },
            include: [{ model: users, as: 'sender', attributes: ['id', 'name', 'role'] }],
            order: [['createdAt', 'ASC']]
        });

        res.status(200).json({ messages });
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
        const { roomId, text, recipientId } = req.body;
        const authUser = (req as any).user;

        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
        if (!roomId || !text) return res.status(400).json({ error: 'Missing required fields' });

        // 1. Save message to DB
        const newMessage = await chat_messages.create({
            room_id: roomId,
            sender_id: authUser.user_id,
            text,
            type: 'text',
            seen: false
        });

        // Update room updatedAt for sorting
        await rooms.update({ updatedAt: new Date() }, { where: { id: roomId } });

        // Re-fetch message with sender info for broadcast
        const messageWithSender = await chat_messages.findByPk(newMessage.id, {
            include: [{ model: users, as: 'sender', attributes: ['id', 'name', 'profile_pic'] }]
        });

        // 2. Trigger Push Notification to all room members except sender
        const members = await room_members.findAll({
            where: { room_id: roomId, user_id: { [Op.ne]: authUser.user_id } },
            include: [{ model: users, attributes: ['id', 'fcm_token'] }]
        });

        // ... notification loop remains same ...
        for (const member of members) {
            const recipient = (member as any).user;
            if (recipient?.fcm_token) {
                const payload = {
                    notification: {
                        title: authUser.name || 'New Message',
                        body: text,
                    },
                    data: {
                        roomId: String(roomId),
                        type: 'chat',
                        messageId: String(newMessage.id)
                    },
                    token: recipient.fcm_token
                };

                try {
                    await messaging.send(payload);
                } catch (err) {
                    console.error('FCM Send Error:', err);
                }
            }
        }

        // 3. Socket broadcast
        try {
            const io = getIO();
            const roomName = `room-${roomId}`;
            console.log(`[SOCKET] Broadcasting new-message to ${roomName}`);
            // To the room (for active chat windows)
            io.to(roomName).emit('new-message', messageWithSender);

            // Globally to each member (for list reordering/notifications)
            for (const member of members) {
                const userRoom = `user-${member.user_id}`;
                console.log(`[SOCKET] Broadcasting new-message-global to ${userRoom}`);
                io.to(userRoom).emit('new-message-global', {
                    room_id: roomId,
                    message: messageWithSender,
                    sender_name: authUser.name
                });
            }
        } catch (ioErr) {

            console.error('Socket broadcast error:', ioErr);
        }

        res.status(200).json({ success: true, message: messageWithSender });
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
 * Create a new chat room (Direct or Group)
 * POST /api/chats/create
 */
export const createRoom = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { type, name, memberIds, project_id, organization_id } = req.body;

        if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

        const actualOrgId = organization_id || authUser.organization_id;

        if (type === 'direct') {
            if (!memberIds || memberIds.length !== 1) {
                return res.status(400).json({ error: 'Direct chat requires exactly one recipient' });
            }

            const targetUserId = memberIds[0];

            // Check if direct room already exists
            const existingRoom = await rooms.findOne({
                where: { type: 'direct', organization_id: actualOrgId },
                include: [
                    {
                        model: room_members,
                        where: { user_id: authUser.user_id }
                    },
                    {
                        model: room_members,
                        where: { user_id: targetUserId }
                    }
                ]
            });

            if (existingRoom) {
                return res.status(200).json({ room: existingRoom });
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
            if (authUser.role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can create group chats' });
            }
            if (!name) return res.status(400).json({ error: 'Group name is required' });
            if (!memberIds || memberIds.length === 0) {
                return res.status(400).json({ error: 'Group chat requires at least one other member' });
            }

            const newRoom = await rooms.create({
                type: 'group',
                name: name,
                organization_id: actualOrgId,
                project_id: project_id || null
            });

            const allMemberIds = [...new Set([...memberIds, authUser.user_id])];
            await room_members.bulkCreate(
                allMemberIds.map(uid => ({ room_id: newRoom.id, user_id: uid }))
            );

            const roomWithMembers = await rooms.findByPk(newRoom.id, {
                include: [{ model: room_members, include: [{ model: users, attributes: ['id', 'name', 'role'] }] }]
            });

            return res.status(201).json({ room: roomWithMembers });
        }

        res.status(400).json({ error: 'Invalid room type' });
    } catch (error) {
        console.error('Create Room Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
