"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole } from '@/types';
import Cookies from 'js-cookie';
import { getMe } from '@/services/authService';
import { io, Socket } from 'socket.io-client';

interface AuthContextType {
    user: User | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    login: (token: string) => Promise<User | undefined>;
    logout: () => void;
    switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoggedIn: false,
    isLoading: true,
    login: async () => undefined,
    logout: () => { },
    switchRole: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const isLoggedIn = !!user;

    const logout = useCallback(() => {
        setUser(null);
        Cookies.remove('token');
        if (typeof window !== 'undefined') {
            localStorage.removeItem('qrSessionId');
        }
    }, []);

    const switchRole = useCallback((role: UserRole) => {
        if (user) {
            setUser({
                ...user,
                role
            })
        }
    }, [user])

    const fetchUser = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get('token');
            if (!token) {
                setIsLoading(false);
                return;
            }
            const res = await getMe();
            if (res?.user) {
                setUser(res.user);
            }
        } catch (e) {
            console.error("Failed to fetch user context", e);
            logout();
        } finally {
            setIsLoading(false);
        }
    }, [logout]);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    useEffect(() => {
        let socket: Socket | null = null;
        if (isLoggedIn && typeof window !== 'undefined') {
            const qrSessionId = localStorage.getItem('qrSessionId');
            if (qrSessionId) {
                const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001';
                socket = io(backendUrl);

                socket.on('connect', () => {
                    socket?.emit('join-qr-room', qrSessionId);
                });

                socket.on('qr-revoked', () => {
                    logout();
                    // Let the proxy logic in _middleware or proxy.ts redirect to login, 
                    // or force window reload so it resets state entirely
                    window.location.href = '/login';
                });
            }
        }

        return () => {
            if (socket) socket.disconnect();
        }
    }, [isLoggedIn, logout]);

    const login = useCallback(async (token: string) => {
        Cookies.set('token', token, { expires: 1 });
        try {
            const res = await getMe();
            if (res?.user) {
                setUser(res.user);
                return res.user as User;
            }
        } catch (e) {
            console.error("Failed to login", e);
            logout();
            throw e;
        }
    }, [logout]);

    return (
        <AuthContext.Provider value={{ user, isLoggedIn: !!user, isLoading, login, logout, switchRole }}>
            {children}
        </AuthContext.Provider>
    );
};
