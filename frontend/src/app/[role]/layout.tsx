"use client";

import { ReactNode, useEffect } from 'react';
import MainSidebar from '@/components/Navigation/MainSidebar/MainSidebar';
import SiteHeader from '@/components/Navigation/SiteHeader/SiteHeader';
import { UsageAlert } from '@/components/shared/UsageAlert';
import { useAuth } from '@/contexts/AuthContext';
import { useUsage } from '@/contexts/UsageContext';
import { usePathname, useRouter } from 'next/navigation';

interface RoleLayoutProps {
    children: ReactNode;
}

const RoleLayout = ({ children }: RoleLayoutProps) => {
    const { user } = useAuth();
    const { usageData } = useUsage();
    const router = useRouter();
    const pathname = usePathname();

    const role = user?.role || 'admin';
    const billingPath = `/${role}/billing`;
    const isLockedFromProfile = !!user?.organization?.subscription_locked;
    const isLockedFromUsage = !!usageData?.plan?.access?.isLocked;
    const isSubscriptionLocked = isLockedFromProfile || isLockedFromUsage;

    useEffect(() => {
        if (isSubscriptionLocked && pathname !== billingPath) {
            router.replace(billingPath);
        }
    }, [isSubscriptionLocked, pathname, billingPath, router]);

    if (isSubscriptionLocked && pathname !== billingPath) {
        return null;
    }

    return (
        <div className="flex h-screen flex-col bg-background overflow-hidden">
            <UsageAlert />
            <SiteHeader />
            <div className="flex flex-1 overflow-hidden">
                <MainSidebar />
                <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
        </div>
    );
};

export default RoleLayout;
