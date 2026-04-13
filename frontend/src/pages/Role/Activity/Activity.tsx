"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Upload, FileText, Camera, Clock, Loader2, ChevronDown } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { getActivities } from '@/services/activityService';
import { getOrganizations } from '@/services/superadminService';
import { getOrgUsers } from '@/services/userService';
import { getProjects } from '@/services/projectService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActivityItem as GlobalActivityItem } from '@/types';
import { useSocket } from '@/contexts/SocketContext';

interface ActivityItem extends GlobalActivityItem {
    userName?: string;
    organizationName?: string;
}

const actionTypes = [
    { label: 'All Actions', value: 'all' },
    { label: 'Upload', value: 'upload' },
    { label: 'Edit', value: 'edit' },
    { label: 'Delete', value: 'delete' },
    { label: 'Share', value: 'share' },
    { label: 'Photo Upload', value: 'upload_photo' },
];

const Activity = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { socket } = useSocket();
    const searchParams = useSearchParams();
    const initialType = searchParams?.get('type') || 'all';

    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [usersList, setUsersList] = useState<any[]>([]);
    const [projectsList, setProjectsList] = useState<any[]>([]);

    const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
    const [selectedUserId, setSelectedUserId] = useState<string>('all');
    const [selectedType, setSelectedType] = useState<string>(initialType);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.role === 'superadmin') {
            getOrganizations().then(setOrganizations).catch(console.error);
        }
    }, [user]);

    // Fetch users and projects when organization changes (or on mount for non-superadmin)
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const orgId = selectedOrgId !== 'all' ? selectedOrgId : undefined;

                // Users
                const usersData = await getOrgUsers(); // This currently doesn't take orgId, but backend handles it via JWT for non-superadmin
                setUsersList(usersData || []);

                // Projects
                const projectsData = await getProjects(orgId);
                setProjectsList(projectsData.projects || []);
            } catch (error) {
                console.error("Error fetching filters", error);
            }
        };
        fetchFilters();
    }, [user, selectedOrgId]);

    useEffect(() => {
        const load = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const filters = {
                    organization_id: selectedOrgId !== 'all' ? selectedOrgId : undefined,
                    user_id: selectedUserId !== 'all' ? selectedUserId : undefined,
                    type: selectedType !== 'all' ? selectedType : undefined,
                    project_id: selectedProjectId !== 'all' ? selectedProjectId : undefined,
                };
                const feed = await getActivities(filters);

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
    }, [user, selectedOrgId, selectedUserId, selectedType, selectedProjectId]);

    // Real-time Activity Listener
    useEffect(() => {
        if (!socket) return;

        const handleNewActivity = (newActivity: any) => {
            // Respect active filters
            if (selectedOrgId !== 'all' && String(newActivity.organizationId) !== selectedOrgId) return;
            if (selectedProjectId !== 'all' && String(newActivity.projectId) !== selectedProjectId) return;
            if (selectedUserId !== 'all' && String(newActivity.userId) !== selectedUserId) return;
            if (selectedType !== 'all' && newActivity.type !== selectedType) return;

            // Format for display
            const formatted = {
                ...newActivity,
                timestamp: new Date(newActivity.timestamp).toLocaleString('en-IN', {
                    dateStyle: 'medium', timeStyle: 'short'
                })
            };

            setActivities(prev => {
                if (prev.some(a => a.id === formatted.id)) return prev;
                return [formatted, ...prev];
            });
        };

        socket.on('new-activity', handleNewActivity);
        return () => {
            socket.off('new-activity', handleNewActivity);
        };
    }, [socket, selectedOrgId, selectedUserId, selectedType, selectedProjectId]);

    if (!user) return null;

    return (
        <div className="max-w-4xl p-8 mx-auto">
            <div className="flex flex-col gap-6 mb-8">
                <div>
                    <h1 className="text-xl font-bold text-foreground">{t('Activity')}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Updates from your projects</p>
                </div>

                <div className="flex flex-wrap gap-3">
                    {user.role === 'superadmin' && (
                        <Select value={selectedOrgId} onValueChange={(val) => { setSelectedOrgId(val); setSelectedUserId('all'); setSelectedProjectId('all'); }}>
                            <SelectTrigger className="w-40 text-xs">
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

                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                        <SelectTrigger className="w-40 text-xs">
                            <SelectValue placeholder="All Projects" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Projects</SelectItem>
                            {projectsList.map(proj => (
                                <SelectItem key={proj.id} value={String(proj.id)}>{proj.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger className="w-40 text-xs">
                            <SelectValue placeholder="All Users" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Users</SelectItem>
                            {usersList.map(u => (
                                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedType} onValueChange={setSelectedType}>
                        <SelectTrigger className="w-40 text-xs">
                            <SelectValue placeholder="All Actions" />
                        </SelectTrigger>
                        <SelectContent>
                            {actionTypes.map(type => (
                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
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
                                    {activity.organizationName && (
                                        <>
                                            <span className="mx-1">•</span>
                                            <span className="px-1 py-0.5 bg-muted rounded text-[9px] font-bold text-muted-foreground uppercase">{activity.organizationName}</span>
                                        </>
                                    )}
                                    {activity.projectName && (
                                        <>
                                            <span className="mx-1">•</span>
                                            <span className="truncate">{activity.projectName}</span>
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
