import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: SocketIOServer;

export const initIO = (httpServer: HTTPServer) => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: "*", // Adjust in production to explicitly match web domain
            methods: ["GET", "POST"]
        }
    });

    // userId -> Set of socket IDs
    const onlineUsers = new Map<number | string, Set<string>>();

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

        socket.on('join-user-room', (userId: string | number) => {
            socket.join(`user-${userId}`);

            // Track online status
            if (!onlineUsers.has(userId)) {
                onlineUsers.set(userId, new Set());
                io.emit('user-status-changed', { userId, status: 'online' });
            }
            onlineUsers.get(userId)?.add(socket.id);

            console.log(`Socket ${socket.id} joined user-${userId} (Online: ${onlineUsers.size} users)`);
        });

        socket.on('check-user-status', (userId: string | number) => {
            const isOnline = onlineUsers.has(userId);
            socket.emit('user-status-response', { userId, status: isOnline ? 'online' : 'offline' });
        });

        socket.on('join-room', (roomId: string) => {
            socket.join(`room-${roomId}`);
            console.log(`Socket ${socket.id} joined room-${roomId}`);
        });

        socket.on('send-message', (data: { roomId: string; text: string; senderId: number; senderName: string; createdAt: Date }) => {
            io.to(`room-${data.roomId}`).emit('new-message', data);
        });

        socket.on('typing', (data: { roomId: string; userName: string }) => {
            socket.to(`room-${data.roomId}`).emit('user-typing', data);
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
