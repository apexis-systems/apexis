"use client";

import React from 'react';
import { useUsage } from '@/contexts/UsageContext';
import { AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const UsageAlert: React.FC = () => {
    const { usageData } = useUsage();

    if (!usageData || !usageData.alert) return null;

    const { alert } = usageData;
    const isError = alert.severity === 'error';

    return (
        <div className={cn(
            "w-full px-4 py-2 flex items-center justify-between transition-all animate-in fade-in slide-in-from-top-2",
            isError ? "bg-red-600 text-white" : "bg-orange-500 text-white"
        )}>
            <div className="flex items-center gap-3">
                {isError ? (
                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                ) : (
                    <Info className="h-5 w-5 flex-shrink-0" />
                )}
                <p className="text-sm font-medium">
                    {alert.message}
                </p>
            </div>
            
            <div className="flex items-center gap-2">
                <Link href="/Role/Billing">
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 bg-white/20 hover:bg-white/30 text-white border-none text-xs font-bold"
                    >
                        Upgrade Plan
                    </Button>
                </Link>
                <button className="p-1 hover:bg-white/10 rounded-full transition-colors">
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};
