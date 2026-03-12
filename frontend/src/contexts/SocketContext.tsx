"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

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
            const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001';
            newSocket = io(backendUrl);

            newSocket.on('connect', () => {
                setIsConnected(true);
                console.log('Socket connected:', newSocket?.id);
                if (user?.id) {
                    newSocket?.emit('join-user-room', user.id);
                }
            });

            newSocket.on('new-message-global', (data: any) => {
                // If we are not on the chat page for this room, play sound
                // Using a simple check: if the URL doesn't contain the room ID
                if (!window.location.pathname.includes(`/chats/${data.room_id}`)) {
                    try {
                        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                        audio.play().catch(e => console.error("Global sound play failed:", e));
                        // You could also show a toast here if a toast library is available
                    } catch (err) {
                        console.error("Audio error:", err);
                    }
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
