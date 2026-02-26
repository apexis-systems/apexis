import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, UserRole } from '@/types';
import { mockUsers } from '@/data/mock';

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

    const login = useCallback((role: UserRole) => {
        setUser(mockUsers[role]);
    }, []);

    const logout = useCallback(() => {
        setUser(null);
    }, []);

    const switchRole = useCallback((role: UserRole) => {
        setUser(mockUsers[role]);
    }, []);

    return (
        <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, logout, switchRole }}>
            {children}
        </AuthContext.Provider>
    );
};
