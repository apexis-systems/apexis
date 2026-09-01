"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    Archive,
    Download,
    RotateCcw,
    Trash2,
    Loader2,
    ChevronLeft,
    FileText,
    Camera,
    AlertTriangle,
    HelpCircle,
    Calendar,
    User,
    HardDrive,
    Search,
    ShieldAlert,
    CheckCircle2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
    getArchivedProjects,
    restoreProjectArchive,
    deleteArchivedProject,
    ArchivedProject,
} from '@/services/archiveService';
import { getApiErrorMessage } from '@/helpers/apiError';

export default function ArchivedProjects() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();

    const [archives, setArchives] = useState<ArchivedProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Restore Modal State
    const [restoreModalItem, setRestoreModalItem] = useState<ArchivedProject | null>(null);
    const [isRestoring, setIsRestoring] = useState(false);

    // Delete Modal State
    const [deleteModalItem, setDeleteModalItem] = useState<ArchivedProject | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadArchives = async () => {
        try {
            setLoading(true);
            const data = await getArchivedProjects();
            setArchives(data.archives || []);
        } catch (err: any) {
            console.error("Failed to load archived projects:", err);
            toast.error(getApiErrorMessage(err, "Failed to load archived projects"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadArchives();
    }, []);

    const filteredArchives = useMemo(() => {
        if (!search.trim()) return archives;
        const q = search.toLowerCase();
        return archives.filter(
            (a) =>
                a.name.toLowerCase().includes(q) ||
                a.description?.toLowerCase().includes(q) ||
                a.archiver?.name?.toLowerCase().includes(q)
        );
    }, [archives, search]);

    const handleRestoreConfirm = async () => {
        if (!restoreModalItem) return;
        try {
            setIsRestoring(true);
            const res = await restoreProjectArchive(restoreModalItem.id);
            toast.success("Project unzipped and restored successfully!");
            setRestoreModalItem(null);
            await loadArchives();
            if (res?.project?.id) {
                router.push(`/${user?.role || 'admin'}/project/${res.project.id}`);
            }
        } catch (err: any) {
            console.error("Restore error:", err);
            toast.error(getApiErrorMessage(err, "Failed to restore project"));
        } finally {
            setIsRestoring(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteModalItem) return;
        try {
            setIsDeleting(true);
            await deleteArchivedProject(deleteModalItem.id);
            toast.success("Archived project permanently deleted.");
            setDeleteModalItem(null);
            await loadArchives();
        } catch (err: any) {
            console.error("Delete archive error:", err);
            toast.error(getApiErrorMessage(err, "Failed to delete archive"));
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDownloadZip = (item: ArchivedProject) => {
        if (item.download_url) {
            window.open(item.download_url, '_blank');
        } else {
            toast.error("Download URL not available for this archive.");
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/${user?.role || 'admin'}/profile`)}
                    className="h-10 w-10 rounded-xl"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Archive className="h-5 w-5 text-primary" />
                        Archived Projects (Zipped Vault)
                    </h1>
                    <p className="text-xs text-muted-foreground">
                        Offline zipped backups stored in database. Unzip anytime to restore full workspace.
                    </p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search archived projects by name, description, or archiver..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-secondary/30 border-border/60"
                />
            </div>

            {/* Content List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground font-medium">Loading archived projects...</p>
                </div>
            ) : filteredArchives.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-secondary/10 rounded-2xl border border-dashed border-border/70 p-8 space-y-3">
                    <div className="h-14 w-14 rounded-2xl bg-secondary/50 flex items-center justify-center">
                        <Archive className="h-7 w-7 text-muted-foreground/60" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold">No Archived Projects</h3>
                        <p className="text-xs text-muted-foreground max-w-sm">
                            When a project is completed, admins can click "Archive & Zip Project" from Project Overview to offload and store it in this vault.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredArchives.map((archive) => {
                        const stats = archive.stats_summary || {};
                        const dateStr = archive.archived_at
                            ? new Date(archive.archived_at).toLocaleDateString('en-IN', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                              })
                            : '—';

                        return (
                            <div
                                key={archive.id}
                                className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-4"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-base font-bold text-foreground truncate">
                                                {archive.name}
                                            </h3>
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                Zipped & Stored
                                            </span>
                                        </div>
                                        {archive.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {archive.description}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap pt-1">
                                            <span className="flex items-center gap-1.5 font-medium">
                                                <Calendar className="h-3.5 w-3.5" />
                                                Archived {dateStr}
                                            </span>
                                            {archive.archiver?.name && (
                                                <span className="flex items-center gap-1.5 font-medium">
                                                    <User className="h-3.5 w-3.5" />
                                                    By {archive.archiver.name}
                                                </span>
                                            )}
                                            {stats.storage_mb !== undefined && (
                                                <span className="flex items-center gap-1.5 font-medium">
                                                    <HardDrive className="h-3.5 w-3.5" />
                                                    {stats.storage_mb} MB
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDownloadZip(archive)}
                                            className="h-9 px-3 text-xs font-semibold rounded-xl border-border hover:bg-secondary"
                                            title="Download complete offline .zip backup"
                                        >
                                            <Download className="h-3.5 w-3.5 mr-1.5 text-primary" />
                                            Download ZIP
                                        </Button>
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => setRestoreModalItem(archive)}
                                            className="h-9 px-3.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                                            title="Unzip & Restore back into active workspace"
                                        >
                                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                            Unzip & Restore
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDeleteModalItem(archive)}
                                            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                                            title="Permanently Delete Archive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Snapshot Stats Pills */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40">
                                    <div className="flex items-center gap-2 p-2 rounded-xl bg-secondary/30 text-xs">
                                        <FileText className="h-4 w-4 text-accent shrink-0" />
                                        <span className="text-muted-foreground">Documents:</span>
                                        <span className="font-bold text-foreground ml-auto">{stats.total_docs ?? 0}</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 rounded-xl bg-secondary/30 text-xs">
                                        <Camera className="h-4 w-4 text-accent shrink-0" />
                                        <span className="text-muted-foreground">Photos:</span>
                                        <span className="font-bold text-foreground ml-auto">{stats.total_photos ?? 0}</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 rounded-xl bg-secondary/30 text-xs">
                                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                                        <span className="text-muted-foreground">Snags:</span>
                                        <span className="font-bold text-foreground ml-auto">{stats.total_snags ?? 0}</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 rounded-xl bg-secondary/30 text-xs">
                                        <HelpCircle className="h-4 w-4 text-blue-500 shrink-0" />
                                        <span className="text-muted-foreground">RFIs:</span>
                                        <span className="font-bold text-foreground ml-auto">{stats.total_rfis ?? 0}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Unzip & Restore Confirmation Dialog */}
            <Dialog open={!!restoreModalItem} onOpenChange={(open) => !open && !isRestoring && setRestoreModalItem(null)}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                            <RotateCcw className="h-5 w-5 text-primary" />
                            Unzip & Restore Project
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Restoring <strong className="text-foreground">{restoreModalItem?.name}</strong> back into active workspace.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-4 bg-secondary/30 rounded-xl space-y-2.5 text-xs text-muted-foreground">
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>Restores all original folder hierarchies, documents, drawings, and photos.</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>Restores drawing pin links, snags, RFIs, comments, and member permissions.</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>Counts towards your active organization project quota.</span>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 mt-2">
                        <Button
                            variant="outline"
                            onClick={() => setRestoreModalItem(null)}
                            disabled={isRestoring}
                            className="rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRestoreConfirm}
                            disabled={isRestoring}
                            className="rounded-xl bg-primary text-primary-foreground font-bold"
                        >
                            {isRestoring ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Unzipping & Restoring...
                                </>
                            ) : (
                                "Confirm Restore"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Permanent Delete Confirmation Dialog */}
            <Dialog open={!!deleteModalItem} onOpenChange={(open) => !open && !isDeleting && setDeleteModalItem(null)}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold text-destructive">
                            <ShieldAlert className="h-5 w-5 text-destructive" />
                            Delete Archived Project Permanently
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Are you sure you want to permanently delete the archive for <strong className="text-foreground">{deleteModalItem?.name}</strong>? The stored `.zip` file and all database snapshot records will be purged forever.
                    </p>

                    <DialogFooter className="gap-2 sm:gap-0 mt-2">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteModalItem(null)}
                            disabled={isDeleting}
                            className="rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                            className="rounded-xl font-bold"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete Forever"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
