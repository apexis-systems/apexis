"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Upload, FileText, Camera, Clock, Loader2, ChevronDown } from 'lucide-react';
import { getActivities } from '@/services/activityService';
import { getOrganizations } from '@/services/superadminService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActivityItem as GlobalActivityItem } from '@/types';

interface ActivityItem extends GlobalActivityItem {
    userName?: string;
}

const Activity = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.role === 'superadmin') {
            getOrganizations().then(setOrganizations).catch(console.error);
        }
    }, [user]);

    useEffect(() => {
        const load = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const orgId = (selectedOrgId && selectedOrgId !== 'all') ? selectedOrgId : undefined;
                const feed = await getActivities(orgId);

                // Format timestamps locally
                const formatted = feed.map((act: any) => ({
                    ...act,
                    timestamp: new Date(act.timestamp).toLocaleString('en-IN', {
                        dateStyle: 'medium', timeStyle: 'short'
                    })
                }));

                setActivities(formatted);
            } catch (error) {
                console.error("Activity load error", error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user, selectedOrgId]);

    if (!user) return null;

    return (
        <div className="max-w-4xl p-8 mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-foreground">{t('activity')}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Updates from your projects</p>
                </div>
                {user.role === 'superadmin' && (
                    <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                        <SelectTrigger className="w-48 text-xs">
                            <SelectValue placeholder="All Organizations" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Organizations</SelectItem>
                            {organizations.map(org => (
                                <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
            ) : (
                <div className="space-y-2">
                    {activities.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3 rounded-xl bg-card border border-border p-3.5">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${activity.type === 'upload_photo' ? 'bg-blue-500/10' : 'bg-accent/10'} shrink-0`}>
                                {activity.type === 'upload_photo' ? <Camera className="h-4 w-4 text-blue-500" /> : <FileText className="h-4 w-4 text-accent" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{activity.description}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    <span className="font-semibold text-foreground">{activity.userName}</span>
                                    {activity.projectName && (
                                        <>
                                            <span className="mx-1">•</span>
                                            {activity.projectName}
                                        </>
                                    )}
                                </p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{activity.timestamp}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && activities.length === 0 && (
                <div className="mt-12 text-center">
                    <Clock className="mx-auto h-8 w-8 text-muted-foreground/30" />
                    <p className="mt-2 text-xs text-muted-foreground">No recent activity</p>
                </div>
            )}
        </div>
    );
};

export default Activity;
