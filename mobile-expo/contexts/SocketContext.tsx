import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import Constants from 'expo-constants';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Audio } from 'expo-av';
import { AppState, AppStateStatus } from 'react-native';

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
    const socketRef = useRef<Socket | null>(null);

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
            const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL || (__DEV__ ? 'http://localhost:5002' : '');

            if (__DEV__) {
                console.log('[Dev] Socket URL:', socketUrl);
            } else {
                console.log('[Prod] Socket URL:', socketUrl);
            }

            newSocket = io(socketUrl, {
                transports: ['polling', 'websocket'],
                forceNew: true,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 2000,
            });

            newSocket.on('connect', () => {
                setIsConnected(true);
            });

            newSocket.on('new-notification', (notif: any) => {
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

            socketRef.current = newSocket;
            setSocket(newSocket);
        }

        return () => {
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, [isLoggedIn]);

    // Reconnect on foreground (critical for iOS)
    useEffect(() => {
        const handleAppStateChange = (nextState: AppStateStatus) => {
            const s = socketRef.current;
            if (!s || !isLoggedIn) return;
            if (nextState === 'active') {
                if (!s.connected) {
                    s.connect();
                }
                if (user?.id) {
                    s.emit('join-user-room', user.id);
                }
            }
        };
        const sub = AppState.addEventListener('change', handleAppStateChange);
        return () => sub.remove();
    }, [isLoggedIn, user?.id]);

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
