import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import Constants from 'expo-constants';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Audio } from 'expo-av';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    unreadNotificationCount: number;
    unreadChatCount: number;
    setUnreadNotificationCount: React.Dispatch<React.SetStateAction<number>>;
    setUnreadChatCount: React.Dispatch<React.SetStateAction<number>>;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    unreadNotificationCount: 0,
    unreadChatCount: 0,
    setUnreadNotificationCount: () => { },
    setUnreadChatCount: () => { },
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoggedIn, user } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const [unreadChatCount, setUnreadChatCount] = useState(0);

    const playAlertSound = async () => {
        try {
            const { sound } = await Audio.Sound.createAsync(
                { uri: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3' }
            );
            await sound.playAsync();
            // Automatically unload after playing
            sound.setOnPlaybackStatusUpdate(status => {
                if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync();
                }
            });
        } catch (error) {
            console.error('Failed to play alert sound:', error);
        }
    };

    const fetchInitialCounts = async () => {
        try {
            const token = await SecureStore.getItemAsync('token');
            if (!token) return;

            // Notifications
            const notifRes = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUnreadNotificationCount((notifRes.data.notifications || []).filter((n: any) => !n.is_read).length);

            // Chats
            const chatRes = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/chats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const unreadChats = (chatRes.data.rooms || []).filter((r: any) => r.unread_count > 0).length;
            setUnreadChatCount(unreadChats);
        } catch (error) {
            console.error('Failed to fetch initial counts:', error);
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
            const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';
            const socketUrl = backendUrl.replace('/api', '');

            newSocket = io(socketUrl, {
                transports: ['websocket'],
            });

            newSocket.on('connect', () => {
                setIsConnected(true);
            });

            newSocket.on('new-notification', () => {
                setUnreadNotificationCount(prev => prev + 1);
                playAlertSound();
            });

            newSocket.on('new-message-global', (data: any) => {
                setUnreadChatCount(prev => prev + 1);
                playAlertSound();
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
            unreadNotificationCount,
            unreadChatCount,
            setUnreadNotificationCount,
            setUnreadChatCount
        }}>
            {children}
        </SocketContext.Provider>
    );
};
