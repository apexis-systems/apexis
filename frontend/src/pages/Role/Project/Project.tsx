"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSocket } from '@/contexts/SocketContext';
import { getProjectById } from '@/services/projectService';
import ProjectOverview from '@/pages/Role/Project/ProjectDetails/ProjectOverview';
import ProjectDocuments from '@/pages/Role/Project/ProjectDetails/ProjectDocuments';
import ProjectPhotos from '@/pages/Role/Project/ProjectDetails/ProjectPhotos';
import ProjectReports from '@/pages/Role/Project/ProjectDetails/ProjectReports';

import ProjectSnagList from '@/pages/Role/Project/ProjectDetails/ProjectSnagList';

import ProjectManuals from '@/pages/Role/Project/ProjectDetails/ProjectManuals';
import ProjectRFI from '@/pages/Role/Project/ProjectDetails/ProjectRFI';
import { getRFIs } from '@/services/rfiService';
import EditProjectModal from "@/components/Project/EditProjectModal";
import { cn } from '@/lib/utils';
import { ArrowLeft, LayoutDashboard, FileText, Camera, ClipboardList, BarChart3, AlertTriangle, BookOpen, HelpCircle, Calendar, Pencil, MapPin } from 'lucide-react';



type TabKey = 'overview' | 'documents' | 'photos' | 'reports' | 'snags' | 'manuals' | 'rfi';



interface ProjectProps {
    id: string;
}

export default function Project({ id }: ProjectProps) {
    const { user } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();

    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [hasPendingRFI, setHasPendingRFI] = useState(false);

    const isClient = user?.role === 'client';
    const searchParams = useSearchParams();
    const urlTab = searchParams?.get('tab') as TabKey | null;
    const [activeTab, setActiveTab] = useState<TabKey>(urlTab || (isClient ? 'documents' : 'overview'));
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editModalFocus, setEditModalFocus] = useState<'start_date' | 'end_date' | null>(null);



    // When tab changes, update the URL so back navigation restores it
    const setTab = (tab: TabKey) => {
        setActiveTab(tab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        url.searchParams.delete('folder'); // Clear folder when switching tabs
        window.history.replaceState(null, '', url.toString());
    };

    // Sync from URL if it changes (e.g. on back navigation)
    useEffect(() => {
        if (urlTab && urlTab !== activeTab) setActiveTab(urlTab);
    }, [urlTab]);

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const data = await getProjectById(id);
                setProject(data);
            } catch (error) {
                console.error("Failed to fetch project:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProject();
    }, [id]);

    const checkRFIs = useCallback(async () => {
        if (!id || !user?.id) return;
        try {
            const rfis = await getRFIs(id);
            const pending = rfis.some(r => 
                (r.status === 'open' || r.status === 'overdue') && 
                String(r.assigned_to) === String(user.id)
            );
            setHasPendingRFI(pending);
        } catch (error) {
            console.error("Failed to check RFIs:", error);
        }
    }, [id, user?.id]);

    const { socket, isConnected } = useSocket();

    useEffect(() => {
        checkRFIs();
        const interval = setInterval(checkRFIs, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [checkRFIs]);

    // Socket listeners for real-time red dot updates
    useEffect(() => {
        if (socket && isConnected && id) {
            socket.emit('join-project', id);

            const handleRfiUpdate = () => {
                console.log('[SOCKET] RFI update received, refreshing red dot');
                checkRFIs();
            };

            socket.on('rfi-updated', handleRfiUpdate);
            socket.on('new-notification', (notif: any) => {
                // If the notification is RFI related, refresh the check
                if (notif.type?.startsWith('rfi_')) {
                    handleRfiUpdate();
                }
            });

            return () => {
                socket.off('rfi-updated', handleRfiUpdate);
                socket.off('new-notification', handleRfiUpdate); // Using same handler to refresh
            };
        }
    }, [socket, isConnected, id, checkRFIs]);

    if (!user || loading) return null;

    if (!project) {
        return (
            <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground mb-4">{t('project_not_found')}</p>
                <button onClick={() => router.push(`/${user.role}/dashboard`)} className="flex items-center gap-2 text-sm text-accent hover:underline">
                    <ArrowLeft className="h-4 w-4" /> {t('back_to_dashboard')}
                </button>
            </div>
        );
    }

    const navItems = [
        { key: 'overview' as TabKey, label: t('project_overview'), icon: LayoutDashboard, adminOnly: true },
        { key: 'documents' as TabKey, label: t('documents'), icon: FileText },
        { key: 'photos' as TabKey, label: t('photos'), icon: Camera },
        { key: 'reports' as TabKey, label: 'Reports', icon: ClipboardList, adminOnly: true },

        { key: 'snags' as TabKey, label: t('snag_list'), icon: AlertTriangle, adminOnly: true },

        { key: 'rfi' as TabKey, label: 'RFI', icon: HelpCircle },
        { key: 'manuals' as TabKey, label: t('manuals'), icon: BookOpen, adminOnly: true },
    ];

    const visibleNav = navItems.filter((item) => !(item.adminOnly && isClient));

    return (
        <div className="flex flex-1 min-h-[calc(100vh-3.5rem)]">
            <div className="w-56 shrink-0 border-r border-border bg-card p-4 flex flex-col">
                <button onClick={() => router.push(`/${user.role}/dashboard`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
                    <ArrowLeft className="h-4 w-4" /> {t('back_to_projects')}
                </button>
                <div className="mb-6">
                    <div className="h-2 w-10 rounded-full mb-3" style={{ backgroundColor: project.color }} />
                    <h2 className="text-sm font-bold text-foreground">{project.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{project.location}</p>
                </div>
                <nav className="space-y-1 flex-1">
                    {visibleNav.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.key;
                        return (
                            <button key={item.key} onClick={() => setTab(item.key)}
                                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors relative',
                                    isActive ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                )}>
                                <Icon className="h-4 w-4" />
                                {item.label}
                                {item.key === 'rfi' && hasPendingRFI && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(249,116,22,0.5)]" />
                                )}
                            </button>
                        );
                    })}
                </nav>
            </div>
            <div className="flex-1 p-8 overflow-y-auto max-w-5xl">
                <div className="mb-6">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
                        {user.role === 'admin' && (
                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="p-1 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-accent"
                                title="Edit Project"
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    {project.description && (
                        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                            {project.description}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-between mb-6">

                    <h2 className="text-lg font-bold text-foreground">
                        {visibleNav.find((n) => n.key === activeTab)?.label}
                    </h2>
                </div>

                {activeTab === 'overview' && !isClient && (
                    <ProjectOverview
                        project={project}
                        userRole={user.role}
                        onProjectUpdate={(updated) => setProject(updated)}
                        onTabChange={setTab as any}
                        onEditClick={(field?: 'start_date' | 'end_date') => {
                            setEditModalFocus(field || null);
                            setIsEditModalOpen(true);
                        }}
                    />
                )}
                {activeTab === 'documents' && <ProjectDocuments project={project} user={user} />}
                {activeTab === 'photos' && <ProjectPhotos project={project} user={user} />}
                {activeTab === 'reports' && !isClient && <ProjectReports project={project} userRole={user.role} />}

                {activeTab === 'snags' && <ProjectSnagList project={project} />}

                {activeTab === 'rfi' && <ProjectRFI project={project} onUpdate={checkRFIs} />}
                {activeTab === 'manuals' && <ProjectManuals project={project} />}
            </div>

            <EditProjectModal
                isOpen={isEditModalOpen}
                onClose={() => { setIsEditModalOpen(false); setEditModalFocus(null); }}
                project={project}
                onUpdate={(updated) => {
                    setProject(updated);
                }}
                initialFocus={editModalFocus}
            />
        </div>
    );
}

