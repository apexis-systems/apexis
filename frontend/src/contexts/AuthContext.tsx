"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole } from '@/types';
import Cookies from 'js-cookie';
import { getMe, revokeQrSession } from '@/services/authService';
import { io, Socket } from 'socket.io-client';

interface AuthContextType {
    user: User | null;
    secondaryUser: User | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    login: (token: string, type?: 'project' | 'superadmin') => Promise<User | undefined>;
    logout: (type?: 'all' | 'project' | 'superadmin') => void;
    switchAccount: (type: 'project' | 'superadmin') => Promise<void>;
    switchRole: (role: UserRole) => void;
    setUser: (user: User | null) => void;
    hasProjectSession: boolean;
    hasSuperadminSession: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    secondaryUser: null,
    isLoggedIn: false,
    isLoading: true,
    login: async () => undefined,
    logout: () => { },
    switchAccount: async () => { },
    switchRole: () => { },
    setUser: () => { },
    hasProjectSession: false,
    hasSuperadminSession: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [secondaryUser, setSecondaryUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasProjectSession, setHasProjectSession] = useState(false);
    const [hasSuperadminSession, setHasSuperadminSession] = useState(false);
    const isLoggedIn = !!user;

    const logout = useCallback(async (type: 'all' | 'project' | 'superadmin' = 'all') => {
        if (typeof window !== 'undefined') {
            const qrSessionId = localStorage.getItem('qrSessionId');
            if (qrSessionId && (type === 'all' || type === 'project')) {
                try {
                    await revokeQrSession(qrSessionId).catch(err => console.warn("Failed to notify backend of QR logout:", err));
                } catch (e) { }
                localStorage.removeItem('qrSessionId');
            }
        }

        if (type === 'all' || type === 'project') {
            Cookies.remove('token_project');
            setHasProjectSession(false);
        }
        if (type === 'all' || type === 'superadmin') {
            Cookies.remove('token_superadmin');
            setHasSuperadminSession(false);
        }

        if (type === 'all') {
            setUser(null);
            setSecondaryUser(null);
            Cookies.remove('token');
        } else {
            const currentToken = Cookies.get('token');
            const projectToken = Cookies.get('token_project');
            const superadminToken = Cookies.get('token_superadmin');

            if (type === 'project' && currentToken === projectToken) {
                if (superadminToken) {
                    Cookies.set('token', superadminToken, { expires: 30 });
                    window.location.reload();
                } else {
                    setUser(null);
                    Cookies.remove('token');
                    window.location.href = '/login';
                }
            } else if (type === 'superadmin' && currentToken === superadminToken) {
                if (projectToken) {
                    Cookies.set('token', projectToken, { expires: 30 });
                    window.location.reload();
                } else {
                    setUser(null);
                    Cookies.remove('token');
                    window.location.href = '/auth/login';
                }
            }
        }
    }, []);

    const fetchUser = useCallback(async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        try {
            const token = Cookies.get('token');
            const projectToken = Cookies.get('token_project');
            const superadminToken = Cookies.get('token_superadmin');

            setHasProjectSession(!!projectToken);
            setHasSuperadminSession(!!superadminToken);

            if (!token) {
                if (showLoading) setIsLoading(false);
                return;
            }

            const res = await getMe();
            if (res?.user) {
                const activeUser = { ...res.user, organization: res.organization, project_id: res.project_id };
                setUser(activeUser);
            }
        } catch (e) {
            console.error("Failed to fetch user context", e);
            logout();
        } finally {
            if (showLoading) setIsLoading(false);
        }
    }, [logout]);

    const switchAccount = useCallback(async (type: 'project' | 'superadmin') => {
        const targetToken = type === 'project' ? Cookies.get('token_project') : Cookies.get('token_superadmin');
        if (!targetToken) {
            throw new Error(`No session found for ${type}`);
        }

        Cookies.set('token', targetToken, { expires: 30 });
        window.location.href = type === 'superadmin' ? '/superadmin/dashboard' : '/admin/dashboard';
    }, []);

    const login = useCallback(async (token: string, type?: 'project' | 'superadmin') => {
        Cookies.set('token', token, { expires: 30 });

        if (type === 'project') {
            Cookies.set('token_project', token, { expires: 30 });
            setHasProjectSession(true);
        } else if (type === 'superadmin') {
            Cookies.set('token_superadmin', token, { expires: 30 });
            setHasSuperadminSession(true);
        }

        try {
            const res = await getMe();
            if (res?.user) {
                const fullUser = { ...res.user, organization: res.organization, project_id: res.project_id };
                setUser(fullUser);

                if (!type) {
                    if (fullUser.role === 'superadmin') {
                        Cookies.set('token_superadmin', token, { expires: 30 });
                        setHasSuperadminSession(true);
                    } else {
                        Cookies.set('token_project', token, { expires: 30 });
                        setHasProjectSession(true);
                    }
                }

                return fullUser as User;
            }
        } catch (e) {
            console.error("Failed to login", e);
            logout();
            throw e;
        }
    }, [logout]);

    const switchRole = useCallback((role: UserRole) => {
        if (user) {
            setUser({
                ...user,
                role
            })
        }
    }, [user])

    useEffect(() => {
        fetchUser(true);
    }, [fetchUser]);

    useEffect(() => {
        let socket: Socket | null = null;
        if (isLoggedIn && typeof window !== 'undefined') {
            const qrSessionId = localStorage.getItem('qrSessionId');
            if (qrSessionId) {
                const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5002';
                socket = io(socketUrl);

                socket.on('connect', () => {
                    socket?.emit('join-qr-room', qrSessionId);
                });

                socket.on('qr-revoked', () => {
                    logout('project');
                    window.location.href = '/login';
                });
            }
        }

        return () => {
            if (socket) socket.disconnect();
        }
    }, [isLoggedIn, logout]);

    return (
        <AuthContext.Provider value={{
            user,
            secondaryUser,
            isLoggedIn: !!user,
            isLoading,
            login,
            logout,
            switchAccount,
            switchRole,
            setUser,
            hasProjectSession,
            hasSuperadminSession
        }}>
            {children}
        </AuthContext.Provider>
    );
};
