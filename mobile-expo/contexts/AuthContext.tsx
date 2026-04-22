import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole } from '@/types';
import * as SecureStore from 'expo-secure-store';
import { getMe, revokeAllWebSessions } from '@/services/authService';

interface AuthContextType {
    user: User | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    isPendingName: boolean;
    login: (token: string) => Promise<User | undefined>;
    logout: () => void;
    switchRole: (role: UserRole) => void;
    updateUser: (userData: Partial<User>) => void;
    isScreenCaptureProtected: boolean;
    setScreenCaptureProtection: (value: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoggedIn: false,
    isLoading: true,
    isPendingName: false,
    login: async () => undefined,
    logout: () => { },
    switchRole: () => { },
    updateUser: () => { },
    isScreenCaptureProtected: true,
    setScreenCaptureProtection: async () => { },
});

export const useAuth = () => useContext(AuthContext);

/**
 * Derived — computed from user object so it is ALWAYS atomically in sync
 * with isLoggedIn. This avoids any React batching race where isLoggedIn=true
 * but isPendingName is still the stale false value from the previous render.
 */
const isNamePending = (u: User | null): boolean =>
    !!u && (!u.name || u.name === 'Pending' || u.name.trim() === '');

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isScreenCaptureProtected, setIsScreenCaptureProtected] = useState(true);

    // Derived — no separate state, always in sync with user
    const isPendingName = isNamePending(user);

    const logout = useCallback(async () => {
        try {
            // Attempt to revoke all web sessions before clearing local state
            await revokeAllWebSessions().catch(err => console.warn("Failed to revoke web sessions on logout:", err));
        } catch (e) {
            // Silently fail if revocation fails, we still want to log out locally
        }
        setUser(null);
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('subscriptionLocked');
        await SecureStore.deleteItemAsync('is_screen_capture_protected_v2');
        setIsScreenCaptureProtected(true);
    }, []);

    const fetchUser = useCallback(async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        try {
            const token = await SecureStore.getItemAsync('token');
            if (!token) {
                if (showLoading) setIsLoading(false);
                return;
            }
            const res = await getMe();
            if (res?.user) {
                const isLocked = !!res?.organization?.subscription_locked;
                if (isLocked) {
                    await SecureStore.setItemAsync('subscriptionLocked', 'true');
                } else {
                    await SecureStore.deleteItemAsync('subscriptionLocked');
                }
                setUser({ ...res.user, organization: res.organization, project_id: res.project_id });
            }
        } catch (e: any) {
            if (e?.response?.status !== 401) {
                console.error("Failed to fetch user context", e?.response?.data || e.message);
            }
            logout();
        } finally {
            if (showLoading) setIsLoading(false);
        }
    }, [logout]);

    useEffect(() => {
        fetchUser(true);
    }, [fetchUser]);

    // Initialize screen capture protection
    useEffect(() => {
        const initScreenCapture = async () => {
            try {
                if (user) {
                    console.log('[AuthContext] Initializing screen capture protection for:', user.email);
                    const savedValue = await SecureStore.getItemAsync('is_screen_capture_protected_v2');
                    
                    if (savedValue === null) {
                        console.log('[AuthContext] No v2 setting found. Defaulting to ON.');
                        // Secure by default: set to true for everyone.
                        setIsScreenCaptureProtected(true);
                        await SecureStore.setItemAsync('is_screen_capture_protected_v2', 'true');
                    } else {
                        console.log('[AuthContext] Loaded v2 setting:', savedValue);
                        setIsScreenCaptureProtected(savedValue === 'true');
                    }
                }
            } catch (e) {
                console.warn('[AuthContext] Failed to init screen capture protection', e);
            }
        };

        if (user) {
            initScreenCapture();
        }
    }, [user]);

    const setScreenCaptureProtection = useCallback(async (value: boolean) => {
        setIsScreenCaptureProtected(value);
        console.log('[AuthContext] Persisting screen capture protection:', value);
        try {
            await SecureStore.setItemAsync('is_screen_capture_protected_v2', value ? 'true' : 'false');
        } catch (e) {
            console.error('Failed to save screen capture protection setting', e);
        }
    }, []);

    const login = useCallback(async (token: string) => {
        await SecureStore.setItemAsync('token', token);
        try {
            const res = await getMe();
            if (res?.user) {
                const isLocked = !!res?.organization?.subscription_locked;
                if (isLocked) {
                    await SecureStore.setItemAsync('subscriptionLocked', 'true');
                } else {
                    await SecureStore.deleteItemAsync('subscriptionLocked');
                }
                const fullUser = { ...res.user, organization: res.organization, project_id: res.project_id };
                setUser(fullUser);  // isPendingName derives from this automatically
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
            setUser({ ...user, role });
        }
    }, [user]);

    const updateUser = useCallback((userData: Partial<User>) => {
        if (user) {
            setUser({ ...user, ...userData });
            // isPendingName derives from user automatically — no extra setState needed
        }
    }, [user]);

    return (
        <AuthContext.Provider value={{
            user, isLoggedIn: !!user, isLoading, isPendingName,
            login, logout, switchRole, updateUser,
            isScreenCaptureProtected, setScreenCaptureProtection
        }}>
            {children}
        </AuthContext.Provider>
    );
};
