"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import axios from 'axios';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    unreadChatCount: number;
    unreadNotificationCount: number;
    setUnreadChatCount: React.Dispatch<React.SetStateAction<number>>;
    setUnreadNotificationCount: React.Dispatch<React.SetStateAction<number>>;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    unreadChatCount: 0,
    unreadNotificationCount: 0,
    setUnreadChatCount: () => { },
    setUnreadNotificationCount: () => { },
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoggedIn, user } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

    const playAlertSound = () => {
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
            audio.play().catch(e => console.error("Sound play failed:", e));
        } catch (err) {
            console.error("Audio error:", err);
        }
    };

    const fetchInitialCounts = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            // Fetch notifications count
            const notifRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUnreadNotificationCount((notifRes.data.notifications || []).filter((n: any) => !n.is_read).length);

            // Fetch chats for unread count
            const chatRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/chats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const unreadChats = (chatRes.data.rooms || []).filter((r: any) => r.unread_count > 0).length;
            setUnreadChatCount(unreadChats);
        } catch (err) {
            console.error("Failed to fetch initial counts:", err);
        }
    };

    useEffect(() => {
        if (isLoggedIn) {
            fetchInitialCounts();
        }
    }, [isLoggedIn]);

    useEffect(() => {
        let newSocket: Socket | null = null;

        if (isLoggedIn) {
            const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5002';

            newSocket = io(socketUrl, {
                transports: ['polling', 'websocket'],
                reconnection: true,
            });

            newSocket.on('connect', () => {
                setIsConnected(true);
                console.log('[SOCKET] Web connected:', newSocket?.id);
            });

            newSocket.on('new-message-global', (data: any) => {
                // More robust check: are we on the specific room's page?
                const currentPath = window.location.pathname;
                const roomId = String(data.room_id);

                // Matches paths like /admin/chats/8 or /client/chats/8
                const isCurrentRoomPage = currentPath.includes(`/chats/${roomId}`);
                const isTabHidden = document.visibilityState === 'hidden';

                if (!isCurrentRoomPage || isTabHidden) {
                    playAlertSound();
                    toast.info(`New message from ${data.message.sender?.name || 'someone'}`, {
                        description: data.message.text,
                        action: {
                            label: 'View',
                            onClick: () => window.location.href = `/${user?.role || 'admin'}/chats/${data.room_id}`
                        }
                    });
                    setUnreadChatCount(prev => prev + 1);
                }
            });

            newSocket.on('new-room-created', () => {
                fetchInitialCounts(); // Refresh counts if a new room is created for the user
            });

            newSocket.on('new-notification', (notif: any) => {
                playAlertSound();
                toast.success(notif.title, {
                    description: notif.body,
                });
                setUnreadNotificationCount(prev => prev + 1);
            });

            newSocket.on('disconnect', () => {
                setIsConnected(false);
            });

            setSocket(newSocket);
        }

        return () => {
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, [isLoggedIn]);

    // Separate effect for joining user-specific room
    useEffect(() => {
        if (socket && isConnected && user?.id) {
            socket.emit('join-user-room', user.id);
        }
    }, [socket, isConnected, user?.id]);


    return (
        <SocketContext.Provider value={{
            socket,
            isConnected,
            unreadChatCount,
            unreadNotificationCount,
            setUnreadChatCount,
            setUnreadNotificationCount
        }}>
            {children}
        </SocketContext.Provider>
    );
};
