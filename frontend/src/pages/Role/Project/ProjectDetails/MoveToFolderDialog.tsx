"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getFolders, bulkUpdateFolders } from '@/services/folderService';
import { bulkUpdateFiles } from '@/services/fileService';
import { Folder as FolderIcon, ChevronRight } from 'lucide-react';
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
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && project?.id) {
            fetchFolders();
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

    const renderFolderTree = (parentId: string | null = null, depth = 0) => {
        return folders
            .filter(f => String(f.parent_id ?? 'null') === String(parentId ?? 'null'))
            .map(folder => {
                // If moving a folder, don't allow moving it into itself or its children
                if (item?.type === 'folder' && String(item.id) === String(folder.id)) return null;
                if (selectedItems?.folders.some(id => String(id) === String(folder.id))) return null;

                const isSelected = targetFolder === folder.id;
                return (
                    <div key={folder.id}>
                        <button
                            onClick={() => setTargetFolder(folder.id)}
                            className={`w-full flex items-center gap-2 p-2 rounded-md transition-colors text-xs ${isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary'}`}
                            style={{ paddingLeft: `${depth * 16 + 8}px` }}
                        >
                            <FolderIcon className="h-3.5 w-3.5" />
                            <span className="truncate">{folder.name}</span>
                        </button>
                        {renderFolderTree(folder.id, depth + 1)}
                    </div>
                );
            });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Move to Folder</DialogTitle>
                </DialogHeader>
                <div className="max-h-[300px] overflow-y-auto py-4">
                    <button
                        onClick={() => setTargetFolder(null)}
                        className={`w-full flex items-center gap-2 p-2 rounded-md transition-colors text-xs ${targetFolder === null ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary'}`}
                    >
                        <FolderIcon className="h-3.5 w-3.5" />
                        <span>Root Folder</span>
                    </button>
                    {renderFolderTree(null)}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">Cancel</Button>
                    <Button onClick={handleMove} disabled={loading} size="sm">
                        {loading ? 'Moving...' : 'Move Here'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MoveToFolderDialog;
