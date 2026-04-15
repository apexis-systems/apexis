"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Bell, Clock, Loader2, Filter, CheckCircle, History } from 'lucide-react';
import { PrivateAxios } from '@/helpers/PrivateAxios';
import { getOrganizations } from '@/services/superadminService';
import { getProjects } from '@/services/projectService';
import { getOrgUsers } from '@/services/userService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
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
    const [usersList, setUsersList] = useState<any[]>([]);

    const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
    // Multi-select: empty array = "all"
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<string>('all');
    const [showHistory, setShowHistory] = useState(false);

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
        const fetchFilters = async () => {
            try {
                const orgId = selectedOrgId !== 'all' ? selectedOrgId : undefined;
                const [projectsData, usersData] = await Promise.all([
                    getProjects(orgId),
                    getOrgUsers(),
                ]);
                setProjectsList(projectsData.projects || []);
                setUsersList(usersData || []);
            } catch (error) {
                console.error("Error fetching filters", error);
            }
        };
        fetchFilters();
    }, [selectedOrgId]);

    const fetchNotifications = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (showHistory) params.append('hours', '48');
            if (selectedProjectIds.length === 1) params.append('project_id', selectedProjectIds[0]);
            else if (selectedProjectIds.length > 1) params.append('project_ids', selectedProjectIds.join(','));
            if (selectedType !== 'all') params.append('type', selectedType);

            const res = await PrivateAxios.get(`/notifications?${params.toString()}`);
            const all = res.data.notifications || [];

            // Default view shows unread only; history shows all notifications in the last 48 hours.
            let filtered = showHistory ? all : all.filter((n: any) => !n.is_read);
            filtered = filtered.filter((n: any) => matchesTypeFilter(n, selectedType));

            // Filter by user if multi-select is active
            if (selectedUserIds.length > 0) {
                filtered = filtered.filter((n: any) =>
                    selectedUserIds.includes(String(n.sender_id ?? n.userId ?? n.user_id ?? ''))
                );
            }

            setNotifications(filtered);
            
            // Sync unread count globally if viewing the default unread inbox.
            if (!showHistory && selectedProjectIds.length === 0 && selectedType === 'all' && selectedUserIds.length === 0) {
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
    }, [user, selectedProjectIds, selectedUserIds, selectedType, showHistory]);

    const markReadAndNavigate = async (notif: any) => {
        try {
            await PrivateAxios.patch(`/notifications/${notif.id}/read`);
            // Remove from unread inbox; keep history visible but mark it read.
            setNotifications(prev => showHistory
                ? prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
                : prev.filter(n => n.id !== notif.id)
            );
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

    const projectOptions = projectsList.map(p => ({ label: p.name, value: String(p.id) }));
    const userOptions = usersList.map(u => ({ label: u.name, value: String(u.id) }));
    const historyButton = (
        <button
            onClick={() => setShowHistory(prev => !prev)}
            className="mx-auto mt-5 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-secondary/40 transition-colors"
        >
            <History className="h-3.5 w-3.5 text-accent" />
            {showHistory ? 'Back to unread' : 'History'}
        </button>
    );

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
                        <Select value={selectedOrgId} onValueChange={(val) => { setSelectedOrgId(val); setSelectedProjectIds([]); setSelectedUserIds([]); }}>
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

                    <MultiSelect
                        options={projectOptions}
                        selected={selectedProjectIds}
                        onChange={setSelectedProjectIds}
                        placeholder="All Projects"
                    />

                    <MultiSelect
                        options={userOptions}
                        selected={selectedUserIds}
                        onChange={setSelectedUserIds}
                        placeholder="All Users"
                    />

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
                                    {notif.organizationName && (
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                            <span className="px-1 py-0.5 bg-muted rounded text-[7px] font-bold uppercase">{notif.organizationName}</span>
                                        </div>
                                    )}
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
                    <p className="mt-2 text-sm text-muted-foreground">
                        {showHistory ? 'No notifications in the last 48 hours' : 'No new notifications'}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">You're all caught up!</p>
                    {historyButton}
                </div>
            )}

            {!loading && notifications.length > 0 && historyButton}
        </div>
    );
};

export default NotificationsPage;
