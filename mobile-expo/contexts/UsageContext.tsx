import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getUsage } from '@/services/subscriptionService';
import { useAuth } from './AuthContext';

export interface UsageData {
    plan: {
        name: string;
        startDate: string;
        endDate: string;
        daysRemaining: number;
        limits: any;
    };
    usage: {
        projects: number;
        contributors: number;
        clients: number;
        snags: number;
        rfis: number;
        storage_mb: number;
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
    const [usageData, setUsageData] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(false);

    const refreshUsage = useCallback(async () => {
        if (!user || user.role === 'superadmin') return;
        setLoading(true);
        try {
            const data = await getUsage();
            setUsageData(data);
        } catch (error) {
            console.error("Failed to fetch usage data mobile:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user && user.role !== 'superadmin') {
            refreshUsage();
        } else {
            setUsageData(null);
        }
    }, [user, refreshUsage]);

    const checkLimit = (type: any): boolean => {
        if (!usageData) return true;
        
        const { usage, plan } = usageData;
        const limits = plan.limits;

        switch (type) {
            case 'projects':
                return usage.projects < limits.project_limit;
            case 'contributors':
                return usage.contributors < limits.contributor_limit;
            case 'clients':
                return usage.clients < limits.client_limit;
            case 'snags':
                return usage.snags < limits.max_snags;
            case 'rfis':
                return usage.rfis < limits.max_rfis;
            case 'storage':
                return usage.storage_percent < 100;
            default:
                return true;
        }
    };

    return (
        <UsageContext.Provider value={{ usageData, loading, refreshUsage, checkLimit }}>
            {children}
        </UsageContext.Provider>
    );
};

export const useUsage = () => {
    const context = useContext(UsageContext);
    if (context === undefined) {
        throw new Error('useUsage must be used within a UsageProvider');
    }
    return context;
};
