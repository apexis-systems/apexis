"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getProjectById } from '@/services/projectService';
import ProjectOverview from '@/pages/Role/Project/ProjectDetails/ProjectOverview';
import ProjectDocuments from '@/pages/Role/Project/ProjectDetails/ProjectDocuments';
import ProjectPhotos from '@/pages/Role/Project/ProjectDetails/ProjectPhotos';
import ProjectDailyReports from '@/pages/Role/Project/ProjectDetails/ProjectDailyReports';
import ProjectWeeklyReports from '@/pages/Role/Project/ProjectDetails/ProjectWeeklyReports';
import ProjectSnagList from '@/pages/Role/Project/ProjectDetails/ProjectSnagList';
import ProjectManuals from '@/pages/Role/Project/ProjectDetails/ProjectManuals';
import { cn } from '@/lib/utils';
import { ArrowLeft, LayoutDashboard, FileText, Camera, ClipboardList, BarChart3, AlertTriangle, BookOpen } from 'lucide-react';

type TabKey = 'overview' | 'documents' | 'photos' | 'daily' | 'weekly' | 'snags' | 'manuals';

interface ProjectProps {
    id: string;
}

export default function Project({ id }: ProjectProps) {
    const { user } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();

    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const isClient = user?.role === 'client';
    const searchParams = useSearchParams();
    const urlTab = searchParams?.get('tab') as TabKey | null;
    const [activeTab, setActiveTab] = useState<TabKey>(urlTab || (isClient ? 'documents' : 'overview'));

    // When tab changes, update the URL so back navigation restores it
    const setTab = (tab: TabKey) => {
        setActiveTab(tab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
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
        { key: 'daily' as TabKey, label: t('daily_reports'), icon: ClipboardList, adminOnly: true },
        { key: 'weekly' as TabKey, label: t('weekly_reports'), icon: BarChart3, adminOnly: true },
        { key: 'snags' as TabKey, label: t('snag_list'), icon: AlertTriangle, adminOnly: true },
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
                                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                    isActive ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                )}>
                                <Icon className="h-4 w-4" />{item.label}
                            </button>
                        );
                    })}
                </nav>
            </div>
            <div className="flex-1 p-8 max-w-4xl">
                <h1 className="text-xl font-bold text-foreground mb-1">{visibleNav.find((n) => n.key === activeTab)?.label}</h1>
                <p className="text-sm text-muted-foreground mb-6">{project.name}</p>
                {activeTab === 'overview' && !isClient && (
                    <ProjectOverview
                        project={project}
                        userRole={user.role}
                        onProjectUpdate={(updated) => setProject(updated)}
                    />
                )}
                {activeTab === 'documents' && <ProjectDocuments project={project} user={user} />}
                {activeTab === 'photos' && <ProjectPhotos project={project} user={user} />}
                {activeTab === 'daily' && !isClient && <ProjectDailyReports project={project} userRole={user.role} />}
                {activeTab === 'weekly' && !isClient && <ProjectWeeklyReports project={project} userRole={user.role} />}
                {activeTab === 'snags' && <ProjectSnagList project={project} />}
                {activeTab === 'manuals' && <ProjectManuals project={project} />}
            </div>
        </div>
    );
}
