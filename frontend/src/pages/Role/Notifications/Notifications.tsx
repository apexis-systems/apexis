"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Bell, Clock, Loader2, Filter, CheckCircle } from 'lucide-react';
import { PrivateAxios } from '@/helpers/PrivateAxios';
import { getOrganizations } from '@/services/superadminService';
import { getProjects } from '@/services/projectService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { handleNotificationNavigation } from '@/helpers/notificationNavigation';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/contexts/SocketContext';

const NotificationsPage = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
    const { setUnreadNotificationCount } = useSocket();

    const [notifications, setNotifications] = useState<any[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [projectsList, setProjectsList] = useState<any[]>([]);

    const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
    const [selectedType, setSelectedType] = useState<string>('all');

    const [loading, setLoading] = useState(true);

    const actionTypes = [
        { label: 'All Actions', value: 'all' },
        { label: 'Chat', value: 'chat' },
        { label: 'Files', value: 'file' },
        { label: 'Photos', value: 'photo' },
        { label: 'Snags', value: 'snag' },
        { label: 'RFI', value: 'rfi' },
        { label: 'Members', value: 'member' },
    ];

    const matchesTypeFilter = (notif: any, type: string) => {
        if (type === 'all') return true;

        const categories: Record<string, string[]> = {
            chat: ['chat', 'group_creation'],
            file: ['file_upload', 'file_upload_admin', 'file_visibility', 'folder_visibility'],
            photo: ['photo_upload', 'photo_comment'],
            snag: ['snag_assigned', 'snag_creation_admin', 'snag_status_update'],
            rfi: ['rfi_created', 'rfi_assigned', 'rfi_status_update', 'rfi_comment'],
            member: ['member_joined'],
        };

        return (categories[type] || [type]).includes(notif.type);
    };

    useEffect(() => {
        if (user?.role === 'superadmin') {
            getOrganizations().then(setOrganizations).catch(console.error);
        }
    }, [user]);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const orgId = selectedOrgId !== 'all' ? selectedOrgId : undefined;
                const data = await getProjects(orgId);
                setProjectsList(data.projects || []);
            } catch (error) {
                console.error("Error fetching projects", error);
            }
        };
        fetchProjects();
    }, [selectedOrgId]);

    const fetchNotifications = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedProjectId !== 'all') params.append('project_id', selectedProjectId);
            if (selectedType !== 'all') params.append('type', selectedType);

            const res = await PrivateAxios.get(`/notifications?${params.toString()}`);
            // Only show unread notifications based on user request "delete the seen notification"
            // Actually, the backend still returns all. We filter here.
            const all = res.data.notifications || [];
            setNotifications(all.filter((n: any) => !n.is_read && matchesTypeFilter(n, selectedType)));
            
            // Sync unread count globally if we are viewing "all"
            if (selectedProjectId === 'all' && selectedType === 'all') {
                setUnreadNotificationCount(all.filter((n: any) => !n.is_read).length);
            }
        } catch (error) {
            console.error("Notification load error", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, [user, selectedProjectId, selectedType]);

    const markReadAndNavigate = async (notif: any) => {
        try {
            await PrivateAxios.patch(`/notifications/${notif.id}/read`);
            // Remove from local state immediately
            setNotifications(prev => prev.filter(n => n.id !== notif.id));
            setUnreadNotificationCount(prev => Math.max(0, prev - 1));
            
            // Navigate
            handleNotificationNavigation(notif.type, notif.data, user!.role, router);
        } catch (error) {
            console.error("Error marking read", error);
        }
    };

    const markAllRead = async () => {
        try {
            await PrivateAxios.patch('/notifications/read-all');
            setNotifications([]);
            setUnreadNotificationCount(0);
        } catch (error) {
            console.error("Error marking all read", error);
        }
    };

    if (!user) return null;

    return (
        <div className="max-w-4xl p-8 mx-auto">
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Notifications</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Stay updated with project changes</p>
                    </div>
                    {notifications.length > 0 && (
                        <button 
                            onClick={markAllRead}
                            className="text-xs text-accent hover:underline flex items-center gap-1.5 font-medium"
                        >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Mark all as read
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap gap-3">
                    {user.role === 'superadmin' && (
                        <Select value={selectedOrgId} onValueChange={(val) => { setSelectedOrgId(val); setSelectedProjectId('all'); }}>
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
                    {notifications.map((notif) => (
                        <div 
                            key={notif.id} 
                            onClick={() => markReadAndNavigate(notif)}
                            className="flex items-start gap-3 rounded-xl bg-card border border-border p-4 hover:border-accent/40 cursor-pointer transition-all group"
                        >
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/5 border border-accent/10 group-hover:bg-accent/10 shrink-0 transition-colors">
                                <Bell className="h-4 w-4 text-accent" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <p className="text-sm font-semibold text-foreground">{notif.title}</p>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-4">
                                        {new Date(notif.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notif.body}</p>
                                <div className="flex items-center gap-3 mt-2 font-medium">
                                    {notif.project && (
                                        <div className="flex items-center gap-1 text-[10px] text-accent/80">
                                            <Filter className="h-3 w-3" />
                                            <span>{notif.project.name}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        <span>{new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && notifications.length === 0 && (
                <div className="mt-12 text-center py-12 bg-secondary/20 rounded-2xl border border-dashed border-border">
                    <Bell className="mx-auto h-8 w-8 text-muted-foreground/20" />
                    <p className="mt-2 text-sm text-muted-foreground">No new notifications</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">You're all caught up!</p>
                </div>
            )}
        </div>
    );
};

export default NotificationsPage;
