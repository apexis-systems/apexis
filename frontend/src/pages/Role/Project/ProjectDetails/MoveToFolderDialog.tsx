"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getFolders, bulkUpdateFolders, createFolder } from '@/services/folderService';
import { bulkUpdateFiles } from '@/services/fileService';
import { Folder as FolderIcon, ChevronRight, FolderPlus, ArrowLeft, FolderMinus } from 'lucide-react';
import { toast } from 'sonner';

interface MoveToFolderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: any;
    item?: { type: 'file' | 'folder', id: string | number } | null;
    selectedItems?: { folders: (string | number)[], files: (string | number)[] };
    onMoveComplete: () => void;
    type?: 'photo' | 'document';
}

const MoveToFolderDialog = ({
    open,
    onOpenChange,
    project,
    item,
    selectedItems,
    onMoveComplete,
    type
}: MoveToFolderDialogProps) => {
    const [folders, setFolders] = useState<any[]>([]);
    const [targetFolder, setTargetFolder] = useState<string | null>(null);
    const [currentParentId, setCurrentParentId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // New folder creation states
    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [submittingFolder, setSubmittingFolder] = useState(false);

    useEffect(() => {
        if (open && project?.id) {
            fetchFolders();
            setTargetFolder(null); // Default to Root folder
            setCurrentParentId(null);
        }
    }, [open, project?.id]);

    const fetchFolders = async () => {
        try {
            const data = await getFolders(project.id, type);
            setFolders(data);
        } catch (e) {
            toast.error("Failed to load folders");
        }
    };

    const handleMove = async () => {
        setLoading(true);
        try {
            const promises = [];

            if (item) {
                // Single item move
                if (item.type === 'folder') {
                    promises.push(bulkUpdateFolders({ ids: [item.id], parent_id: targetFolder }));
                } else {
                    promises.push(bulkUpdateFiles({ ids: [item.id], folder_id: targetFolder }));
                }
            } else if (selectedItems) {
                // Bulk move
                if (selectedItems.folders.length > 0) {
                    promises.push(bulkUpdateFolders({ ids: selectedItems.folders, parent_id: targetFolder }));
                }
                if (selectedItems.files.length > 0) {
                    promises.push(bulkUpdateFiles({ ids: selectedItems.files, folder_id: targetFolder }));
                }
            }

            await Promise.all(promises);
            toast.success("Items moved successfully");
            onMoveComplete();
            onOpenChange(false);
        } catch (e) {
            toast.error("Failed to move items");
        } finally {
            setLoading(false);
        }
    };

    const submitNewFolder = async () => {
        if (!newFolderName.trim() || !project?.id) return;
        setSubmittingFolder(true);
        try {
            const res = await createFolder({
                project_id: String(project.id),
                name: newFolderName.trim(),
                parent_id: currentParentId,
                folder_type: type || 'photo'
            });
            await fetchFolders();
            if (res?.id) {
                setTargetFolder(res.id);
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
        const invalidSet = new Set<string>();
        
        const isDirectlyInvalid = (folder: any) => {
            const folderNameLower = folder.name.toLowerCase();
            if (folderNameLower === 'archive' || folderNameLower === 'confirmation' || folderNameLower === 'confirmations') {
                return true;
            }
            if (item?.type === 'folder' && String(item.id) === String(folder.id)) {
                return true;
            }
            if (selectedItems?.folders.some(id => String(id) === String(folder.id))) {
                return true;
            }
            return false;
        };

        folders.forEach(folder => {
            if (isDirectlyInvalid(folder)) {
                invalidSet.add(String(folder.id));
            }
        });

        let added = true;
        while (added) {
            added = false;
            folders.forEach(folder => {
                if (folder.parent_id && !invalidSet.has(String(folder.id))) {
                    if (invalidSet.has(String(folder.parent_id))) {
                        invalidSet.add(String(folder.id));
                        added = true;
                    }
                }
            });
        }

        return folders.filter(folder => !invalidSet.has(String(folder.id)));
    };

    const getFoldersInCurrentLevel = () => {
        const valid = getValidFolders();
        return valid.filter(f => String(f.parent_id ?? 'null') === String(currentParentId ?? 'null'));
    };

    const getBreadcrumbs = () => {
        if (currentParentId === null) return "Root Folder";
        const path: string[] = [];
        let current = folders.find(f => String(f.id) === String(currentParentId));
        while (current) {
            path.unshift(current.name);
            current = folders.find(f => String(f.id) === String(current.parent_id));
        }
        return "Root > " + path.join(" > ");
    };

    const goUp = () => {
        if (currentParentId === null) return;
        const currentFolderObj = folders.find(f => String(f.id) === String(currentParentId));
        const parentId = currentFolderObj ? (currentFolderObj.parent_id ?? null) : null;
        setCurrentParentId(parentId);
        setTargetFolder(parentId);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) {
                setCurrentParentId(null);
                setTargetFolder(null);
                setShowNewFolderModal(false);
                setNewFolderName('');
            }
        }}>
            <DialogContent className="sm:max-w-[400px] overflow-hidden">
                <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
                    <DialogTitle className="text-sm font-semibold">Move to Folder</DialogTitle>
                </DialogHeader>

                <div className="max-h-[350px] overflow-y-auto py-3 space-y-3">
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
                            return (
                                <button
                                    key={folder.id}
                                    onClick={() => {
                                        setCurrentParentId(folder.id);
                                        setTargetFolder(folder.id);
                                    }}
                                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors aspect-square text-center gap-1.5 group"
                                >
                                    <FolderIcon className="h-5 w-5 text-primary group-hover:scale-105 transition-transform" />
                                    <span className="text-[10px] font-semibold leading-tight max-h-[24px] overflow-hidden text-ellipsis line-clamp-2 px-1">
                                        {folder.name}
                                    </span>
                                </button>
                            );
                        })}

                        <button
                            onClick={() => setShowNewFolderModal(true)}
                            className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-border hover:bg-muted transition-colors aspect-square text-center gap-1.5"
                        >
                            <FolderPlus className="h-5 w-5 text-primary" />
                            <span className="text-[10px] font-semibold text-muted-foreground leading-tight">
                                New Folder
                            </span>
                        </button>
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

                <DialogFooter className="border-t pt-3 flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} size="sm" className="text-xs">
                        Cancel
                    </Button>
                    <Button onClick={handleMove} disabled={loading || currentParentId === null} size="sm" className="text-xs">
                        {loading ? 'Moving...' : 'Move Here'}
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

export default MoveToFolderDialog;
