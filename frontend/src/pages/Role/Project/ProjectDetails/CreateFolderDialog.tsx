"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderPlus } from 'lucide-react';

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFolder: (name: string) => void;
  type: 'documents' | 'photos';
}

const CreateFolderDialog = ({ open, onOpenChange, onCreateFolder, type }: CreateFolderDialogProps) => {
  const [folderName, setFolderName] = useState('');

  const handleCreate = () => {
    if (folderName.trim()) {
      onCreateFolder(folderName.trim());
      setFolderName('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[320px] rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FolderPlus className="h-4 w-4 text-accent" />
            Create New Folder
          </DialogTitle>
        </DialogHeader>
        <div className="py-3">
          <Label htmlFor="folderName" className="text-xs text-muted-foreground">
            Folder name for {type}
          </Label>
          <Input
            id="folderName"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Enter folder name"
            className="mt-1.5 h-9 text-xs"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!folderName.trim()}
            className="h-8 bg-accent text-accent-foreground hover:bg-accent/90 text-xs"
          >
            Create Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateFolderDialog;
