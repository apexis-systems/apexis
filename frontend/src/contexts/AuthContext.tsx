"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole } from '@/types';
import Cookies from 'js-cookie';
import { getMe } from '@/services/authService';

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

    const logout = useCallback(() => {
        setUser(null);
        Cookies.remove('token');
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
