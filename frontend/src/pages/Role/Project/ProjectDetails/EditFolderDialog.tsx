"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (newName: string) => Promise<void>;
  currentName: string;
}

const EditFolderDialog = ({ open, onOpenChange, onRename, currentName }: EditFolderDialogProps) => {
  const [name, setName] = useState(currentName || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentName) setName(currentName);
  }, [currentName, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name?.trim() || name === currentName) {
      onOpenChange(false);
      return;
    }

    setLoading(true);
    try {
      if (onRename) await onRename(name);
      if (onOpenChange) onOpenChange(false);
    } catch (error) {
      console.error("Failed to rename folder:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Rename Folder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="folder-name">New Name</Label>
              <Input
                id="folder-name"
                value={name || ""}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange && onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name?.trim()}>
              {loading ? "Renaming..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditFolderDialog;
