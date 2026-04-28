"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileText, Camera, ArrowRight, Loader2, Trash2, RotateCcw, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getProjects, deleteProject, restoreProject } from '@/services/projectService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Trash() {
    const { user } = useAuth() || {};
    const router = useRouter();
    const { t } = useLanguage();

    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRestoring, setIsRestoring] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            fetchTrashProjects();
        }
    }, [user]);

    const fetchTrashProjects = async () => {
        setLoading(true);
        try {
            const data = await getProjects(undefined, true);
            setProjects(data.projects || []);
        } catch (e) {
            console.error("Failed to fetch trash projects", e);
            toast.error("Failed to load trash");
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (projectId: string) => {
        try {
            setIsRestoring(projectId);
            await restoreProject(projectId);
            toast.success('Project restored successfully');
            fetchTrashProjects();
        } catch (e) {
            console.error("Failed to restore project", e);
            toast.error('Failed to restore project');
        } finally {
            setIsRestoring(null);
        }
    };

    const handlePermanentDelete = async (projectId: string) => {
        if (!window.confirm("Are you sure? This will permanently delete ALL project data. This cannot be undone.")) {
            return;
        }

        try {
            setIsSubmitting(true);
            await deleteProject(projectId, true);
            toast.success('Project permanently deleted');
            fetchTrashProjects();
        } catch (e) {
            console.error("Failed to permanently delete project", e);
            toast.error('Failed to delete project');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) return null;

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <button 
                    onClick={() => router.back()}
                    className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
                >
                    <ChevronLeft className="h-6 w-6" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Trash</h1>
                    <p className="text-sm text-muted-foreground">Manage and restore deleted projects</p>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    <p className="text-muted-foreground">Loading trash...</p>
                </div>
            ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-secondary/10 rounded-3xl border-2 border-dashed border-border">
                    <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                        <Trash2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Trash is Empty</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mt-1">Deleted projects will appear here for 30 days before being permanently removed.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projects.map((project) => (
                        <div
                            key={project.id}
                            className="rounded-2xl bg-card border border-border p-5 flex flex-col items-start w-full transition-colors relative"
                        >
                            <div className="flex items-center justify-between w-full mb-3">
                                <h3 className="font-bold text-foreground text-lg truncate pr-2">
                                    {project.name}
                                </h3>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <div className="text-[9px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full uppercase tracking-widest">
                                        CONT: {project.contributor_code}
                                    </div>
                                    <div className="text-[9px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full uppercase tracking-widest">
                                        CLNT: {project.client_code}
                                    </div>
                                </div>
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
                                {project.description || 'No description available'}
                            </p>

                            <div className="flex items-center gap-4 w-full pt-4 border-t border-border mt-auto">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <FileText className="h-3.5 w-3.5" />
                                    <span className="font-medium text-foreground">{project.totalDocs || 0}</span> {t('docs').toLowerCase()}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Camera className="h-3.5 w-3.5" />
                                    <span className="font-medium text-foreground">{project.totalPhotos || 0}</span> {t('photos').toLowerCase()}
                                </div>
                            </div>

                            {(user.role === 'admin' || user.role === 'superadmin') && (
                                <div className="flex items-center gap-2 mt-5 w-full">
                                    <button 
                                        onClick={() => handleRestore(project.id)}
                                        disabled={isRestoring === project.id}
                                        className="flex-1 bg-accent/10 hover:bg-accent text-accent hover:text-white text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isRestoring === project.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                        Restore
                                    </button>
                                    <button 
                                        onClick={() => handlePermanentDelete(project.id)}
                                        disabled={isSubmitting}
                                        className="flex-1 bg-destructive/10 hover:bg-destructive text-destructive hover:text-white text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                        Delete Forever
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
