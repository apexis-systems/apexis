"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { mockActivities } from '@/data/mock';
import { Upload, Edit, Trash2, Share2, Clock } from 'lucide-react';

const iconMap = {
    upload: Upload,
    edit: Edit,
    delete: Trash2,
    share: Share2,
};

const colorMap = {
    upload: 'bg-accent/10 text-accent',
    edit: 'bg-blue-500/10 text-blue-500',
    delete: 'bg-destructive/10 text-destructive',
    share: 'bg-green-500/10 text-green-500',
};

const Activity = () => {
    const { user } = useAuth();
    const { t } = useLanguage();

    if (!user) return null;

    return (
        <div className="max-w-4xl p-8 mx-auto">
            <div className="mb-6">
                <h1 className="text-xl font-bold text-foreground">{t('activity')}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Updates from your projects</p>
            </div>

            <div className="space-y-2">
                {mockActivities.map((activity) => {
                    const Icon = iconMap[activity.type];
                    const colorClass = colorMap[activity.type];
                    return (
                        <div key={activity.id} className="flex items-start gap-3 rounded-xl bg-card border border-border p-3.5">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colorClass} shrink-0`}>
                                <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{activity.description}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{activity.projectName}</p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{activity.timestamp}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {mockActivities.length === 0 && (
                <div className="mt-12 text-center">
                    <Clock className="mx-auto h-8 w-8 text-muted-foreground/30" />
                    <p className="mt-2 text-xs text-muted-foreground">No recent activity</p>
                </div>
            )}
        </div>
    );
};

export default Activity;
