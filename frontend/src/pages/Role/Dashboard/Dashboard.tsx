"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileText, Camera, MapPin, CalendarDays, ArrowRight, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getProjects, createProject } from '@/services/projectService';
import { getOrgOverview } from '@/services/superadminService';

export default function Dashboard() {
    const { user } = useAuth() || {};
    const router = useRouter();
    const { t } = useLanguage();

    const [projects, setProjects] = useState<any[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newProject, setNewProject] = useState({ name: '', description: '', start_date: '', end_date: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [orgData, setOrgData] = useState<any>(null);

    useEffect(() => {
        if (user) {
            if (user.role === 'superadmin') {
                fetchOrgOverview();
            } else {
                fetchProjects();
            }
        }
    }, [user]);

    const fetchOrgOverview = async () => {
        try {
            const data = await getOrgOverview();
            setOrgData(data);
        } catch (e) {
            console.error("Failed to fetch org overview", e);
        }
    };

    const fetchProjects = async () => {
        try {
            const data = await getProjects();
            setProjects(data.projects || []);
        } catch (e) {
            console.error("Failed to fetch projects", e);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createProject(newProject);
            setIsCreating(false);
            setNewProject({ name: '', description: '', start_date: '', end_date: '' });
            fetchProjects();
        } catch (e) {
            console.error("Failed to create project", e);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) {
        return (
            <div className="p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground">Please log in to view the dashboard.</p>
            </div>
        );
    }

    const totalDocs = projects.reduce((sum, p) => sum + (p.totalDocs || 0), 0);
    const totalPhotos = projects.reduce((sum, p) => sum + (p.totalPhotos || 0), 0);

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Greeting with Logo */}
            <div className="mb-8 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                    <span className="text-[10px] text-muted-foreground">Logo</span>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        {t('welcome_back')}, {user.name?.split(' ')[0]} 👋
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {(user.role === 'admin' || user.role === 'superadmin') && t('manage_projects')}
                        {user.role === 'contributor' && t('assigned_projects')}
                        {user.role === 'client' && t('shared_projects')}
                    </p>
                </div>
            </div>

            {user.role === 'superadmin' && orgData ? (
                <div>
                    <div className="rounded-xl bg-card border border-border p-6 mb-8">
                        <h2 className="text-xl font-bold text-accent mb-2">{orgData.organization?.name}</h2>
                        <p className="text-sm text-muted-foreground">Super Admin Dashboard</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="rounded-xl bg-card border border-border p-5">
                            <div className="text-sm text-muted-foreground">Org Users</div>
                            <div className="mt-1 text-3xl font-bold text-foreground">{orgData.users?.length || 0}</div>
                        </div>
                        <div className="rounded-xl bg-card border border-border p-5">
                            <div className="text-sm text-muted-foreground">All Projects</div>
                            <div className="mt-1 text-3xl font-bold text-foreground">{orgData.projects?.length || 0}</div>
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-foreground mb-4">Organization Projects</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        {orgData.projects?.map((proj: any) => (
                            <div key={proj.id} className="rounded-xl bg-card border border-border p-5">
                                <h4 className="font-bold text-foreground">{proj.name}</h4>
                                <p className="text-sm text-muted-foreground mt-1">{proj.folders?.length || 0} top-level folders</p>
                            </div>
                        ))}
                    </div>

                    <h3 className="text-lg font-bold text-foreground mb-4">Registered Users</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {orgData.users?.map((u: any) => (
                            <div key={u.id} className="flex justify-between items-center rounded-xl bg-card border border-border p-4">
                                <span className="font-medium text-foreground">{u.name}</span>
                                <span className="text-xs font-bold px-2 py-1 bg-accent/10 border border-accent text-accent rounded uppercase">
                                    {u.role}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="rounded-xl bg-card border border-border p-5">
                            <div className="text-sm text-muted-foreground">{t('total_projects')}</div>
                            <div className="mt-1 text-3xl font-bold text-foreground">{projects.length}</div>
                        </div>
                        <div className="rounded-xl bg-card border border-border p-5">
                            <div className="text-sm text-muted-foreground">{t('documents')}</div>
                            <div className="mt-1 text-3xl font-bold text-foreground">{totalDocs}</div>
                        </div>
                        <div className="rounded-xl bg-card border border-border p-5">
                            <div className="text-sm text-muted-foreground">{t('photos')}</div>
                            <div className="mt-1 text-3xl font-bold text-foreground">{totalPhotos}</div>
                        </div>
                    </div>

                    {/* Projects Grid */}
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-foreground">{t('your_projects')}</h2>
                        {user.role === 'admin' && (
                            <button
                                onClick={() => setIsCreating(!isCreating)}
                                className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                <Plus className="h-4 w-4" /> Create Project
                            </button>
                        )}
                    </div>

                    {isCreating && (
                        <div className="rounded-xl bg-card border border-border p-6 mb-8">
                            <h3 className="text-lg font-bold text-foreground mb-4">Create New Project</h3>
                            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Project Name</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                                        value={newProject.name}
                                        onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-border/80"
                                        value={newProject.description}
                                        onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Start Date</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:border-accent"
                                        value={newProject.start_date}
                                        onChange={e => setNewProject({ ...newProject, start_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">End Date</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:border-accent"
                                        value={newProject.end_date}
                                        onChange={e => setNewProject({ ...newProject, end_date: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreating(false)}
                                        className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-4 py-2 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
                                    >
                                        {isSubmitting ? 'Creating...' : 'Submit'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projects.map((project) => (
                            <button
                                key={project.id}
                                onClick={() => router.push(`/${user.role}/project/${project.id}`)}
                                className="rounded-xl bg-card border border-border p-5 text-left hover:border-accent transition-colors group cursor-pointer"
                            >
                                {/* Color bar */}
                                <div
                                    className="h-2 w-12 rounded-full mb-4"
                                    style={{ backgroundColor: project.color || '#f97316' }}
                                />

                                <h3 className="text-sm font-bold text-foreground group-hover:text-accent transition-colors">
                                    {project.name}
                                </h3>

                                <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {project.description || 'No Description'}
                                </div>

                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                    <CalendarDays className="h-3 w-3" />
                                    {new Date(project.start_date).toLocaleDateString()} — {new Date(project.end_date).toLocaleDateString()}
                                </div>

                                {/* Admin Display Codes */}
                                {user.role === 'admin' && (
                                    <div className="mt-3 bg-secondary/50 rounded-md p-2 flex flex-col gap-1 border border-border text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground font-medium">Contributor:</span>
                                            <span className="font-mono text-foreground font-bold">{project.contributor_code}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground font-medium">Client:</span>
                                            <span className="font-mono text-foreground font-bold">{project.client_code}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Stats row */}
                                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <FileText className="h-3.5 w-3.5" />
                                        <span className="font-medium text-foreground">{project.totalDocs || 0}</span> {t('documents').toLowerCase()}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Camera className="h-3.5 w-3.5" />
                                        <span className="font-medium text-foreground">{project.totalPhotos || 0}</span> {t('photos').toLowerCase()}
                                    </div>
                                    <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground group-hover:text-accent transition-colors" />
                                </div>
                            </button>
                        ))}
                    </div>

                    {projects.length === 0 && (
                        <div className="mt-12 text-center">
                            <p className="text-muted-foreground">{t('no_projects')}</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
