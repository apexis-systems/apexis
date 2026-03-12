import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole } from '@/types';
import * as SecureStore from 'expo-secure-store';
import { getMe } from '@/services/authService';

interface AuthContextType {
    user: User | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    login: (token: string) => Promise<User | undefined>;
    logout: () => void;
    switchRole: (role: UserRole) => void;
    updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoggedIn: false,
    isLoading: true,
    login: async () => undefined,
    logout: () => { },
    switchRole: () => { },
    updateUser: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const logout = useCallback(async () => {
        setUser(null);
        await SecureStore.deleteItemAsync('token');
    }, []);

    const fetchUser = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = await SecureStore.getItemAsync('token');
            if (!token) {
                setIsLoading(false);
                return;
            }
            const res = await getMe();
            if (res?.user) {
                setUser(res.user);
            }
        } catch (e: any) {
            if (e?.response?.status !== 401) {
                console.error("Failed to fetch user context", e?.response?.data || e.message);
            }
            logout();
        } finally {
            setIsLoading(false);
        }
    }, [logout]);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const login = useCallback(async (token: string) => {
        await SecureStore.setItemAsync('token', token);
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

    const switchRole = useCallback((role: UserRole) => {
        if (user) {
            setUser({ ...user, role });
        }
    }, [user]);

    const updateUser = useCallback((userData: Partial<User>) => {
        if (user) {
            setUser({ ...user, ...userData });
        }
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, isLoggedIn: !!user, isLoading, login, logout, switchRole, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};
