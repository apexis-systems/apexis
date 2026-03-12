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
            // Using a fallback for development; in production this should be your actual backend URL
            const backendUrl = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:5001';
            const socketUrl = backendUrl.replace('/api', '');

            newSocket = io(socketUrl, {
                transports: ['websocket'], // Often needed for React Native
            });

            newSocket.on('connect', () => {
                setIsConnected(true);
                console.log('Mobile Socket connected:', newSocket?.id);
                // Join user-specific room for global notifications and online tracking
                if (user?.id) {
                    newSocket?.emit('join-user-room', user.id);
                }
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

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
