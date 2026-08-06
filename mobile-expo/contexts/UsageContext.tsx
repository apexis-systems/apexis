import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getUsage } from '@/services/subscriptionService';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

export interface UsageData {
    plan: {
        name: string;
        seats_purchased?: number;
        price_per_seat?: number;
        startDate: string;
        endDate: string;
        subscription_plan_end_date?: string;
        daysRemaining: number;
        auto_pay_enabled?: boolean;
        subscription_cycle?: string;
        razorpay_subscription_id?: string | null;
        limits: any;
        access?: {
            isExpired: boolean;
            isInGracePeriod: boolean;
            isLocked: boolean;
            graceEndDate: string | null;
            graceDaysRemaining: number;
        };
    };
    usage: {
        projects: number;
        plan_name?: string;
        seats_purchased?: number;
        seats_limit_total?: number;
        seats_used?: number;
        seats_remaining?: number;
        contributors: number;
        clients: number;
        snags: number;
        rfis: number;
        storage_mb: number;
        storage_limit_per_project_mb?: number;
        storage_limit_mb?: number;
        storage_percent: number;
    };
    alert: {
        type: 'expiry' | 'storage';
        severity: 'warning' | 'error';
        message: string;
    } | null;
}

interface UsageContextType {
    usageData: UsageData | null;
    loading: boolean;
    refreshUsage: () => Promise<void>;
    checkLimit: (type: keyof UsageData['usage'] | 'can_export_reports' | 'can_export_handover') => boolean;
}

const UsageContext = createContext<UsageContextType | undefined>(undefined);

export const UsageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth() as any;
    const { socket } = useSocket();
    const [usageData, setUsageData] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(false);

    const refreshUsage = useCallback(async () => {
        if (!user) {
            setUsageData(null);
            return;
        }

        try {
            setLoading(true);
            const data = await getUsage();
            setUsageData(data);
        } catch (error) {
            console.error("Failed to fetch subscription usage:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        refreshUsage();
    }, [refreshUsage]);

    useEffect(() => {
        if (!socket || !user) return;

        const handleSubscriptionUpdated = () => {
            refreshUsage();
        };

        socket.on("subscription-updated", handleSubscriptionUpdated);
        return () => {
            socket.off("subscription-updated", handleSubscriptionUpdated);
        };
    }, [socket, user, refreshUsage]);

    const checkLimit = (type: keyof UsageData['usage'] | 'can_export_reports' | 'can_export_handover'): boolean => {
        if (!usageData) return true;

        const { usage, plan } = usageData;
        const limits = plan.limits;

        if (type === 'projects') {
            return usage.projects < limits.project_limit;
        }
        if (type === 'contributors') {
            const seatsLimitTotal = usage.seats_limit_total ?? usage.seats_purchased ?? plan.seats_purchased ?? 1;
            const seatsUsed = usage.seats_used ?? usage.contributors;
            return seatsUsed < seatsLimitTotal;
        }
        if (type === 'clients') {
            return usage.clients < limits.client_limit;
        }
        if (type === 'snags') {
            return usage.snags < limits.max_snags;
        }
        if (type === 'rfis') {
            return usage.rfis < limits.max_rfis;
        }
        if (type === 'storage_mb') {
            const storageLimit = usage.storage_limit_mb ?? limits.storage_limit_mb ?? 100;
            return usage.storage_mb < storageLimit;
        }
        if (type === 'can_export_reports') {
            return !!limits.can_export_reports;
        }
        if (type === 'can_export_handover') {
            return !!limits.can_export_handover;
        }

        return true;
    };

    return (
        <UsageContext.Provider value={{ usageData, loading, refreshUsage, checkLimit }}>
            {children}
        </UsageContext.Provider>
    );
};

export const useUsage = () => {
    const context = useContext(UsageContext);
    if (!context) {
        throw new Error('useUsage must be used within a UsageProvider');
    }
    return context;
};
