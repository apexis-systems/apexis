"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileText, Camera, Loader2, Trash2, RotateCcw, ChevronLeft, Folder, HelpCircle, AlertTriangle, BookOpen, Briefcase, ChevronDown, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { deleteTrashItemPermanently, getTrashItems, restoreTrashItem } from '@/services/trashService';

const CATEGORY_ORDER = ['project', 'folder', 'document', 'photo', 'rfi', 'snag', 'manual'];

const getItemIcon = (itemType: string) => {
    if (itemType === 'project') return Briefcase;
    if (itemType === 'photo') return Camera;
    if (itemType === 'folder') return Folder;
    if (itemType === 'rfi') return HelpCircle;
    if (itemType === 'snag') return AlertTriangle;
    if (itemType === 'manual') return BookOpen;
    return FileText;
};

const getItemLabel = (itemType: string) => {
    if (itemType === 'project') return 'Projects';
    if (itemType === 'document') return 'Documents';
    if (itemType === 'photo') return 'Photos';
    if (itemType === 'folder') return 'Folders';
    if (itemType === 'rfi') return 'RFIs';
    if (itemType === 'snag') return 'Snags';
    if (itemType === 'manual') return 'Manuals';
    return 'Items';
};

interface NestedTrashItem {
    id: string | number;
    itemType: string;
    name: string;
    deletedAt: string;
}

interface TrashItem {
    id: string | number;
    itemType: string;
    name: string;
    description?: string | null;
    deletedAt: string;
    daysRemaining: number;
    projectName: string;
    itemSubType?: string | null;
    totalDocs?: number;
    totalPhotos?: number;
    canRestore?: boolean;
    canDeleteForever?: boolean;
    nestedItems?: NestedTrashItem[];
    nestedItemsCount?: number;
}

export default function Trash() {
    const { user } = useAuth() || {};
    const router = useRouter();
    const { t } = useLanguage();

    const [items, setItems] = useState<TrashItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
    const [isRestoring, setIsRestoring] = useState<string | null>(null);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
    const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

    const fetchTrashItems = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getTrashItems(user?.organization?.id);
            setItems(data.items || []);
        } catch (e) {
            console.error("Failed to fetch trash items", e);
            toast.error(t('load_trash_error'));
        } finally {
            setLoading(false);
        }
    }, [t, user?.organization?.id]);

    useEffect(() => {
        if (user) {
            fetchTrashItems();
        }
    }, [fetchTrashItems, user]);

    useEffect(() => {
        setOpenSections((prev) => {
            const nextSections: Record<string, boolean> = {};
            CATEGORY_ORDER.forEach((category, index) => {
                if (items.some((item) => item.itemType === category)) {
                    nextSections[category] = prev[category] ?? index < 2;
                }
            });
            return nextSections;
        });
    }, [items]);

    const groupedItems = useMemo(() => {
        const groups = new Map<string, TrashItem[]>();
        items.forEach((item) => {
            const existing = groups.get(item.itemType) || [];
            existing.push(item);
            groups.set(item.itemType, existing);
        });

        return CATEGORY_ORDER
            .map((category) => ({
                category,
                label: getItemLabel(category),
                items: groups.get(category) || [],
            }))
            .filter((group) => group.items.length > 0);
    }, [items]);

    const handleRestore = async (item: TrashItem) => {
        try {
            setIsRestoring(`${item.itemType}-${item.id}`);
            await restoreTrashItem(item.itemType, item.id);
            toast.success(t('restore_success'));
            fetchTrashItems();
        } catch (e) {
            console.error("Failed to restore trash item", e);
            toast.error(t('restore_error'));
        } finally {
            setIsRestoring(null);
        }
    };

    const handlePermanentDelete = async (item: TrashItem) => {
        if (!window.confirm(t('permanent_delete_confirm'))) {
            return;
        }

        try {
            setIsSubmitting(`${item.itemType}-${item.id}`);
            await deleteTrashItemPermanently(item.itemType, item.id);
            toast.success(t('permanent_delete_success'));
            fetchTrashItems();
        } catch (e) {
            console.error("Failed to permanently delete trash item", e);
            toast.error(t('permanent_delete_error'));
        } finally {
            setIsSubmitting(null);
        }
    };

    if (!user) return null;

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => router.push(`/${user.role}/profile`)}
                    className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
                >
                    <ChevronLeft className="h-6 w-6" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('trash_title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('trash_subtitle')}</p>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    <p className="text-muted-foreground">{t('loading_trash')}</p>
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-secondary/10 rounded-3xl border-2 border-dashed border-border">
                    <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                        <Trash2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{t('trash_empty')}</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mt-1">{t('trash_empty_desc')}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {groupedItems.map((group) => {
                        const isOpen = openSections[group.category];
                        const GroupIcon = getItemIcon(group.category);

                        return (
                            <section key={group.category} className="rounded-3xl border border-border bg-card overflow-hidden">
                                <button
                                    onClick={() => setOpenSections((prev) => ({ ...prev, [group.category]: !prev[group.category] }))}
                                    className="w-full px-5 py-4 flex items-center justify-between bg-secondary/30 hover:bg-secondary/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-11 w-11 rounded-2xl bg-background flex items-center justify-center">
                                            <GroupIcon className="h-5 w-5 text-foreground" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-foreground">{group.label}</div>
                                            <div className="text-xs text-muted-foreground">{group.items.length} items in recovery</div>
                                        </div>
                                    </div>
                                    {isOpen ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                                </button>

                                {isOpen && (
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {group.items.map((item) => {
                                            const Icon = getItemIcon(item.itemType);
                                            const actionKey = `${item.itemType}-${item.id}`;
                                            const folderKey = `folder-${item.id}`;
                                            const folderOpen = !!openFolders[folderKey];

                                            return (
                                                <div key={actionKey} className="rounded-2xl border border-border bg-background p-4 relative">
                                                    <div className={cn(
                                                        "absolute -top-2 -right-2 px-3 py-1 rounded-full text-[10px] font-bold border shadow-sm z-10",
                                                        item.daysRemaining <= 5
                                                            ? "bg-destructive text-destructive-foreground border-destructive"
                                                            : "bg-orange-500 text-white border-orange-600"
                                                    )}>
                                                        {item.daysRemaining} {item.daysRemaining === 1 ? t('day_left') : t('days_left')}
                                                    </div>

                                                    <div className="flex items-start gap-3 mb-3">
                                                        <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
                                                            <Icon className="h-4 w-4 text-foreground" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                                                {item.itemType === 'folder' && item.itemSubType === 'photo' ? 'PHOTO FOLDER' : item.itemType === 'folder' ? 'DOC FOLDER' : getItemLabel(item.itemType).slice(0, -1).toUpperCase()}
                                                            </div>
                                                            <h3 className="font-bold text-foreground truncate">{item.name}</h3>
                                                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                                                {item.description || t('no_description')}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="rounded-2xl bg-secondary/40 px-3 py-2 text-xs text-muted-foreground flex items-center justify-between gap-2">
                                                        <span className="truncate">{item.projectName}</span>
                                                        <span>{new Date(item.deletedAt).toLocaleDateString()}</span>
                                                    </div>

                                                    {item.itemType === 'project' && (
                                                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                                            <div className="flex items-center gap-1.5">
                                                                <FileText className="h-3.5 w-3.5" />
                                                                <span className="font-medium text-foreground">{item.totalDocs || 0}</span> {t('documents').toLowerCase()}
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <Camera className="h-3.5 w-3.5" />
                                                                <span className="font-medium text-foreground">{item.totalPhotos || 0}</span> {t('photos').toLowerCase()}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {item.itemType === 'folder' && (item.nestedItemsCount || 0) > 0 && (
                                                        <div className="mt-3 rounded-2xl border border-border bg-card">
                                                            <button
                                                                onClick={() => setOpenFolders((prev) => ({ ...prev, [folderKey]: !prev[folderKey] }))}
                                                                className="w-full px-3 py-2 flex items-center justify-between text-sm"
                                                            >
                                                                <span className="font-semibold text-foreground">Inside this folder</span>
                                                                <span className="text-muted-foreground">{item.nestedItemsCount} items</span>
                                                            </button>
                                                            {folderOpen && (
                                                                <div className="px-3 pb-3 space-y-2">
                                                                    {item.nestedItems?.map((nestedItem) => {
                                                                        const NestedIcon = getItemIcon(nestedItem.itemType);
                                                                        return (
                                                                            <div key={`${nestedItem.itemType}-${nestedItem.id}`} className="flex items-center gap-2 rounded-xl bg-secondary/40 px-3 py-2">
                                                                                <NestedIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                                                                <span className="text-sm text-foreground truncate">{nestedItem.name}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {(item.canRestore || item.canDeleteForever) && (
                                                        <div className="flex items-center gap-2 mt-4">
                                                            {item.canRestore && (
                                                                <button
                                                                    onClick={() => handleRestore(item)}
                                                                    disabled={isRestoring === actionKey}
                                                                    className="flex-1 bg-accent/10 hover:bg-accent text-accent hover:text-white text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                                                                >
                                                                    {isRestoring === actionKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                                                    {t('restore')}
                                                                </button>
                                                            )}
                                                            {item.canDeleteForever && (
                                                                <button
                                                                    onClick={() => handlePermanentDelete(item)}
                                                                    disabled={isSubmitting === actionKey}
                                                                    className="flex-1 bg-destructive/10 hover:bg-destructive text-destructive hover:text-white text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                                                                >
                                                                    {isSubmitting === actionKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                                    {t('delete_forever')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
