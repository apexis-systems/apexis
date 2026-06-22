"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

interface RenameFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (newName: string) => Promise<void>;
  currentName: string;
}

const RenameFileDialog = ({ open, onOpenChange, onRename, currentName }: RenameFileDialogProps) => {
  const { t } = useLanguage();
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
      console.error("Failed to rename file:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t('rename_file_title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="file-name">{t('new_name_label')}</Label>
              <Input
                id="file-name"
                value={name || ""}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                placeholder={t('enter_new_name_placeholder')}
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
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading || !name?.trim()}>
              {loading ? t('renaming_btn') : t('save_changes')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RenameFileDialog;
