import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: SocketIOServer;

// userId -> Set of socket IDs
const onlineUsers = new Map<number | string, Set<string>>();

export const initIO = (httpServer: HTTPServer) => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: "*", // Adjust in production to explicitly match web domain
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Web client joins a room based on its unique generated UUID
        socket.on('join-qr-room', (uuid: string) => {
            if (uuid) {
                socket.join(uuid);
                console.log(`Socket ${socket.id} joined room for QR UUID: ${uuid}`);
            }
        });

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
            // Remove from online mapping
            for (const [userId, sockets] of onlineUsers.entries()) {
                if (sockets.has(socket.id)) {
                    sockets.delete(socket.id);
                    if (sockets.size === 0) {
                        onlineUsers.delete(userId);
                        io.emit('user-status-changed', { userId, status: 'offline' });
                    }
                    break;
                }
            }
        });

        // --- Chat Messaging Events ---
        socket.on('join-user-room', (rawUserId: string | number) => {
            const userId = String(rawUserId);
            socket.join(`user-${userId}`);

            // Track online status
            if (!onlineUsers.has(userId)) {
                onlineUsers.set(userId, new Set());
                io.emit('user-status-changed', { userId, status: 'online' });
            }
            onlineUsers.get(userId)?.add(socket.id);

            console.log(`Socket ${socket.id} joined user-${userId} (Online: ${onlineUsers.size} users)`);
        });

        socket.on('check-user-status', (rawUserId: string | number) => {
            const userId = String(rawUserId);
            const isOnline = onlineUsers.has(userId);
            socket.emit('user-status-response', { userId, status: isOnline ? 'online' : 'offline' });
        });

        socket.on('join-room', (roomId: string | number) => {
            const roomName = `room-${String(roomId)}`;
            socket.join(roomName);
            console.log(`[SOCKET] ${socket.id} joined ${roomName}`);
        });

        socket.on('join-project', (projectId: string | number) => {
            const projectName = `project-${String(projectId)}`;
            socket.join(projectName);
            console.log(`[SOCKET] ${socket.id} joined ${projectName}`);
        });

        socket.on('send-message', (data: { roomId: string | number; text: string; senderId: number; senderName: string; createdAt: Date }) => {
            const roomName = `room-${String(data.roomId)}`;
            console.log(`[SOCKET] Message in ${roomName} from ${data.senderId}`);
            io.to(roomName).emit('new-message', data);
        });

        socket.on('typing', (data: { roomId: string | number; userName: string }) => {
            const roomName = `room-${String(data.roomId)}`;
            // Broadcast to others in the room
            socket.to(roomName).emit('user-typing', data);
            // console.log(`[SOCKET] User ${data.userName} typing in ${roomName}`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

export const isUserOnline = (userId: number | string) => {
    return onlineUsers.has(String(userId));
};
