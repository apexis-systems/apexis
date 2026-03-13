import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import Constants from 'expo-constants';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoggedIn, user } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        let newSocket: Socket | null = null;

        if (isLoggedIn) {
            // Using EXPO_PUBLIC_API_URL from .env
            const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';
            const socketUrl = backendUrl.replace('/api', '');

            newSocket = io(socketUrl, {
                transports: ['websocket'],
            });

            newSocket.on('connect', () => {
                setIsConnected(true);
                console.log('[SOCKET] Mobile connected:', newSocket?.id);
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
            console.log('Emitting join-user-room for user:', user.id);
            socket.emit('join-user-room', user.id);
        }
    }, [socket, isConnected, user?.id]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
