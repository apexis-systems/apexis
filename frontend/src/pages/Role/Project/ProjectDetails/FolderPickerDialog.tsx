"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getFolders, createFolder } from '@/services/folderService';
import { Folder as FolderIcon, ChevronRight, Check, Loader2, FolderPlus, ArrowLeft, FolderMinus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FolderPickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: any;
    selectedFolderIds: (string | number)[];
    onSelect: (folderIds: (string | number)[]) => void;
    submitting?: boolean;
    onlyTopLevel?: boolean;
    hideCreate?: boolean;
    title?: string;
}

const FolderPickerDialog = ({
    open = false,
    onOpenChange = () => { },
    project = null,
    selectedFolderIds = [],
    onSelect = () => { },
    submitting = false,
    onlyTopLevel = false,
    hideCreate = false,
    title
}: FolderPickerDialogProps) => {
    const [folders, setFolders] = useState<any[]>([]);
    const [type, setType] = useState<'document' | 'photo'>('document');
    const [currentSelected, setCurrentSelected] = useState<(string | number)[]>(selectedFolderIds || []);
    const [currentParentId, setCurrentParentId] = useState<string | null>(null);

    // New folder creation states
    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [submittingFolder, setSubmittingFolder] = useState(false);

    useEffect(() => {
        if (open && project?.id) {
            fetchFolders();
        }
    }, [open, project?.id, type]);

    useEffect(() => {
        setCurrentSelected(selectedFolderIds);
    }, [selectedFolderIds]);

    const fetchFolders = async () => {
        try {
            const data = await getFolders(project.id, type);
            setFolders(data);
        } catch (e) {
            toast.error("Failed to load folders");
        }
    };

    const toggleFolder = (folderId: string | number) => {
        setCurrentSelected(prev => {
            if (prev.includes(folderId)) {
                return prev.filter(id => id !== folderId);
            } else {
                return [...prev, folderId];
            }
        });
    };

    const submitNewFolder = async () => {
        if (!newFolderName.trim() || !project?.id) return;
        setSubmittingFolder(true);
        try {
            const res = await createFolder({
                project_id: String(project.id),
                name: newFolderName.trim(),
                parent_id: currentParentId,
                folder_type: type
            });
            await fetchFolders();
            // Automatically select newly created folder
            if (res?.id) {
                setCurrentSelected(prev => [...prev, res.id]);
            }
            setShowNewFolderModal(false);
            setNewFolderName('');
        } catch (err) {
            toast.error("Failed to create folder");
        } finally {
            setSubmittingFolder(false);
        }
    };

    const getValidFolders = () => {
        return folders.filter(f => {
            const nameLower = f.name.toLowerCase();
            return nameLower !== 'archive' && nameLower !== 'confirmation' && nameLower !== 'confirmations';
        });
    };

    const getFoldersInCurrentLevel = () => {
        const valid = getValidFolders();
        return valid.filter(f => String(f.parent_id ?? 'null') === String(currentParentId ?? 'null'));
    };

    const getBreadcrumbs = () => {
        const label = type === 'document' ? 'Documents' : 'Photos';
        if (currentParentId === null) return label;
        const path: string[] = [];
        let current = folders.find(f => String(f.id) === String(currentParentId));
        while (current) {
            path.unshift(current.name);
            current = folders.find(f => String(f.id) === String(current.parent_id));
        }
        return label + " > " + path.join(" > ");
    };

    const goUp = () => {
        if (currentParentId === null) return;
        const currentFolderObj = folders.find(f => String(f.id) === String(currentParentId));
        const parentId = currentFolderObj ? (currentFolderObj.parent_id ?? null) : null;
        setCurrentParentId(parentId);
    };

    const handleTabChange = (newType: 'document' | 'photo') => {
        setType(newType);
        setCurrentParentId(null);
    };

    const isAnyDescendantSelected = (parentId: string | number | null): boolean => {
        if (parentId === null) return false;
        const descendants = new Set<string>();
        const queue = [String(parentId)];
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            folders.forEach(f => {
                if (f.parent_id && String(f.parent_id) === currentId) {
                    const childId = String(f.id);
                    if (!descendants.has(childId)) {
                        descendants.add(childId);
                        queue.push(childId);
                    }
                }
            });
        }
        return currentSelected.some(id => descendants.has(String(id)));
    };

    const shouldIncludeParent = currentParentId !== null && !isAnyDescendantSelected(currentParentId);

    const effectiveSelection = 
        shouldIncludeParent && !currentSelected.some(id => String(id) === String(currentParentId))
            ? [...currentSelected, currentParentId]
            : currentSelected;

    const hasChanges = 
        effectiveSelection.length !== selectedFolderIds.length || 
        !selectedFolderIds.every(id => effectiveSelection.some(tId => String(tId) === String(id)));

    const currentLevelFolders = getFoldersInCurrentLevel();
    const visibleFolderIds = currentLevelFolders.map(f => String(f.id));
    const isAnyVisibleSelected = currentLevelFolders.some(f => 
        effectiveSelection.some(id => String(id) === String(f.id))
    );

    const handleToggleAll = () => {
        if (isAnyVisibleSelected) {
            setCurrentSelected(prev => prev.filter(id => !visibleFolderIds.includes(String(id))));
        } else {
            setCurrentSelected(prev => {
                const newSelection = [...prev];
                currentLevelFolders.forEach(f => {
                    if (!newSelection.some(id => String(id) === String(f.id))) {
                        newSelection.push(f.id);
                    }
                });
                return newSelection;
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) {
                setCurrentParentId(null);
                setShowNewFolderModal(false);
                setNewFolderName('');
            }
        }}>
            <DialogContent className="sm:max-w-[450px] overflow-hidden">
                <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
                    <DialogTitle className="text-sm font-semibold">{title || "Link RFI or Snag to Folders"}</DialogTitle>
                </DialogHeader>
 
                {/* Tabs */}
                <div className="flex gap-2 p-1 bg-secondary/50 rounded-lg">
                    <button
                        onClick={() => handleTabChange('document')}
                        className={cn(
                            "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                            type === 'document' ? "bg-background shadow-sm text-accent" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Documents
                    </button>
                    <button
                        onClick={() => handleTabChange('photo')}
                        className={cn(
                            "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                            type === 'photo' ? "bg-background shadow-sm text-accent" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Photos
                    </button>
                </div>

                {/* Toggle All Button */}
                {currentLevelFolders.length > 0 && (
                    <div className="flex justify-end px-1.5 py-0.5">
                        <button
                            type="button"
                            onClick={handleToggleAll}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all duration-200",
                                isAnyVisibleSelected 
                                    ? "bg-accent/10 border-accent/30 text-accent hover:bg-accent/20" 
                                    : "bg-muted border-border text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
                            )}
                        >
                            {isAnyVisibleSelected ? (
                                <>
                                    <FolderMinus className="h-3 w-3" />
                                    <span>Unselect All</span>
                                </>
                            ) : (
                                <>
                                    <Check className="h-3 w-3 stroke-[3px]" />
                                    <span>Select All</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
 
                <div className="max-h-[320px] overflow-y-auto py-1 space-y-3 pr-1">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted rounded-lg text-[10px] text-muted-foreground font-semibold truncate">
                        <FolderIcon className="h-3 w-3" />
                        <span>{getBreadcrumbs()}</span>
                    </div>
 
                    <div className="grid grid-cols-4 gap-2.5">
                        {currentParentId !== null && (
                            <button
                                onClick={goUp}
                                className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-border hover:bg-muted transition-colors aspect-square text-center gap-1.5"
                            >
                                <ArrowLeft className="h-5 w-5 text-primary" />
                                <span className="text-[10px] font-semibold text-muted-foreground leading-tight">
                                    Go Up
                                </span>
                            </button>
                        )}
 
                        {getFoldersInCurrentLevel().map(folder => {
                            const isSelected = effectiveSelection.some(tId => String(tId) === String(folder.id));
                            return (
                                <div
                                    key={folder.id}
                                    className={cn(
                                        "relative flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors aspect-square text-center gap-1.5 group cursor-pointer",
                                        isSelected && "border-accent bg-accent/5"
                                    )}
                                    onClick={() => {
                                        if (onlyTopLevel) {
                                            toggleFolder(folder.id);
                                        } else {
                                            setCurrentParentId(folder.id);
                                        }
                                    }}
                                >
                                    {/* Corner checkbox overlay */}
                                    {onlyTopLevel ? (
                                        <div className="absolute top-1.5 right-1.5 p-0.5 z-10">
                                            {isSelected ? (
                                                <Check className="h-3.5 w-3.5 text-accent stroke-[3px]" />
                                            ) : (
                                                <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/40 group-hover:border-muted-foreground" />
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation(); // Avoid entering folder when toggling checkbox
                                                toggleFolder(folder.id);
                                            }}
                                            className="absolute top-1.5 right-1.5 p-0.5 rounded-full hover:bg-muted/80 z-10"
                                        >
                                            {isSelected ? (
                                                <Check className="h-3.5 w-3.5 text-accent stroke-[3px]" />
                                            ) : (
                                                <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/40 group-hover:border-muted-foreground" />
                                            )}
                                        </button>
                                    )}
 
                                    <FolderIcon className={cn("h-5 w-5 text-primary group-hover:scale-105 transition-transform", isSelected && "text-accent")} />
                                    <span className="text-[10px] font-semibold leading-tight max-h-[24px] overflow-hidden text-ellipsis line-clamp-2 px-1">
                                        {folder.name}
                                    </span>
                                </div>
                            );
                        })}
 
                        {!hideCreate && (
                            <button
                                onClick={() => setShowNewFolderModal(true)}
                                className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-border hover:bg-muted transition-colors aspect-square text-center gap-1.5"
                            >
                                <FolderPlus className="h-5 w-5 text-primary" />
                                <span className="text-[10px] font-semibold text-muted-foreground leading-tight">
                                    New Folder
                                </span>
                            </button>
                        )}
                    </div>
 
                    {getFoldersInCurrentLevel().length === 0 && currentParentId !== null && (
                        <div className="flex flex-col items-center justify-center py-6 gap-2">
                            <FolderMinus className="h-8 w-8 text-muted-foreground/30" />
                            <span className="text-[10px] font-semibold text-muted-foreground">
                                This folder is empty
                            </span>
                        </div>
                    )}
                </div>
 
                <div className="pt-2 border-t border-border flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground font-medium">
                        {effectiveSelection?.length || 0} folder(s) selected
                    </p>
                </div>
 
                <DialogFooter className="flex gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} size="sm" disabled={submitting} className="text-xs">Cancel</Button>
                    <Button
                        onClick={() => onSelect(effectiveSelection)}
                        size="sm"
                        disabled={submitting || !hasChanges}
                        className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs"
                    >
                        {submitting && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                        Done
                    </Button>
                </DialogFooter>

                {/* Create Folder Overlay */}
                {showNewFolderModal && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                        <div className="bg-card w-full border border-border rounded-xl p-4 shadow-lg space-y-4">
                            <h3 className="font-semibold text-sm">Create New Folder</h3>
                            <input
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Folder Name"
                                className="w-full text-xs p-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                autoFocus
                            />
                            <div className="flex gap-2.5">
                                <Button
                                    variant="outline"
                                    onClick={() => { setShowNewFolderModal(false); setNewFolderName(''); }}
                                    size="sm"
                                    className="flex-1 text-xs"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={submitNewFolder}
                                    disabled={submittingFolder || !newFolderName.trim()}
                                    size="sm"
                                    className="flex-1 text-xs"
                                >
                                    {submittingFolder ? 'Creating...' : 'Create'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default FolderPickerDialog;
