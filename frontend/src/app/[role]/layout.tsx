"use client";

import { ReactNode } from 'react';
import MainSidebar from '@/components/Navigation/MainSidebar/MainSidebar';
import SiteHeader from '@/components/Navigation/SiteHeader/SiteHeader';

interface RoleLayoutProps {
    children: ReactNode;
}

const RoleLayout = ({ children }: RoleLayoutProps) => {
    return (
        <div className="flex h-screen flex-col bg-background overflow-hidden">
            <SiteHeader />
            <div className="flex flex-1 overflow-hidden">
                <MainSidebar />
                <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
        </div>
    );
};

export default RoleLayout;
