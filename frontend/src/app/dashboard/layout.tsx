"use client";

import { ReactNode } from 'react';
import MainSidebar from '@/components/Navigation/MainSidebar/MainSidebar';
import SiteHeader from '@/components/Navigation/SiteHeader/SiteHeader';

interface DesktopLayoutProps {
    children: ReactNode;
}

const DesktopLayout = ({ children }: DesktopLayoutProps) => {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <SiteHeader />
            <div className="flex flex-1">
                <MainSidebar />
                <main className="flex-1 overflow-auto">{children}</main>
            </div>
        </div>
    );
};

export default DesktopLayout;
