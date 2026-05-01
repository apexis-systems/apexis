"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getFolders } from '@/services/folderService';
import { Folder as FolderIcon, ChevronRight, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FolderPickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: any;
    selectedFolderIds: (string | number)[];
    onSelect: (folderIds: (string | number)[]) => void;
    submitting?: boolean;
}

const FolderPickerDialog = ({
    open = false,
    onOpenChange = () => {},
    project = null,
    selectedFolderIds = [],
    onSelect = () => {},
    submitting = false
}: FolderPickerDialogProps) => {
    const [folders, setFolders] = useState<any[]>([]);
    const [type, setType] = useState<'document' | 'photo'>('document');
    const [currentSelected, setCurrentSelected] = useState<(string | number)[]>(selectedFolderIds || []);

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

    const renderFolderTree = (parentId: string | null = null, depth = 0) => {
        return folders
            .filter(f => String(f.parent_id ?? 'null') === String(parentId ?? 'null'))
            .map(folder => {
                const isSelected = currentSelected.includes(folder.id);
                return (
                    <div key={folder.id}>
                        <button
                            onClick={() => toggleFolder(folder.id)}
                            className={cn(
                                "w-full flex items-center justify-between p-2 rounded-md transition-colors text-xs mb-1",
                                isSelected ? 'bg-accent/10 border border-accent/50' : 'hover:bg-secondary border border-transparent'
                            )}
                            style={{ paddingLeft: `${depth * 16 + 8}px` }}
                        >
                            <div className="flex items-center gap-2 truncate">
                                <FolderIcon className={cn("h-3.5 w-3.5", isSelected ? 'text-accent' : 'text-muted-foreground')} />
                                <span className={cn("truncate", isSelected && "font-semibold")}>{folder.name}</span>
                            </div>
                            {isSelected && <Check className="h-3 w-3 text-accent shrink-0" />}
                        </button>
                        {renderFolderTree(folder.id, depth + 1)}
                    </div>
                );
            });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle>Link RFI to Folders</DialogTitle>
                </DialogHeader>
                
                <div className="flex gap-2 p-1 bg-secondary/50 rounded-lg mb-4">
                    <button 
                        onClick={() => setType('document')}
                        className={cn(
                            "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                            type === 'document' ? "bg-background shadow-sm text-accent" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Documents
                    </button>
                    <button 
                        onClick={() => setType('photo')}
                        className={cn(
                            "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                            type === 'photo' ? "bg-background shadow-sm text-accent" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Photos
                    </button>
                </div>

                <div className="max-h-[350px] overflow-y-auto pr-2 no-scrollbar">
                    {folders?.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground text-xs italic">
                            No {type} folders found
                        </div>
                    ) : (
                        renderFolderTree(null)
                    )}
                </div>

                <div className="pt-4 border-t border-border">
                    <p className="text-[10px] text-muted-foreground font-medium mb-2">
                        {currentSelected?.length || 0} folder(s) selected
                    </p>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} size="sm" disabled={submitting}>Cancel</Button>
                    <Button 
                        onClick={() => onSelect(currentSelected)} 
                        size="sm"
                        disabled={submitting}
                        className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                        {submitting && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FolderPickerDialog;
