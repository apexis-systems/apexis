"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, UserRole } from '@/types';
import { mockUsers } from '@/data/mock';
import Cookies from 'js-cookie';
interface AuthContextType {
    user: User | null;
    isLoggedIn: boolean;
    login: (role: UserRole) => void;
    logout: () => void;
    switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoggedIn: false,
    login: () => { },
    logout: () => { },
    switchRole: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);

    // Load user from cookie on mount
    React.useEffect(() => {
        const savedUser = Cookies.get('user');
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (e) {
                console.error("Failed to parse user cookie", e);
            }
        }
    }, []);

    const login = useCallback((role: UserRole) => {
        const u = mockUsers[role];
        setUser(u);
        Cookies.set('user', JSON.stringify(u), { expires: 7 });
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        Cookies.remove('user');
    }, []);

    const switchRole = useCallback((role: UserRole) => {
        const u = mockUsers[role];
        setUser(u);
        Cookies.set('user', JSON.stringify(u), { expires: 7 });
    }, []);

    return (
        <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, logout, switchRole }}>
            {children}
        </AuthContext.Provider>
    );
};
