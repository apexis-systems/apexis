"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Link2, Mail, MessageCircle } from 'lucide-react';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  downloadUrl?: string;
  fileType?: string;
}

const ShareDialog = ({ open, onOpenChange, itemName, downloadUrl, fileType }: ShareDialogProps) => {
  const shareUrl = downloadUrl || `https://app.apexis.in/shared/${encodeURIComponent(itemName)}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied to clipboard');
    onOpenChange(false);
  };

  const shareWhatsApp = () => {
    const encoded = encodeURIComponent(`Check out: ${itemName}\n${shareUrl}`);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
    onOpenChange(false);
  };

  const shareEmail = () => {
    const subject = encodeURIComponent(`Shared: ${itemName}`);
    const body = encodeURIComponent(`Here is a shared file from APEXIS:\n\n${itemName}\n${shareUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-sm">Share "{itemName}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Button onClick={shareWhatsApp} variant="outline" className="w-full justify-start gap-3">
            <MessageCircle className="h-4 w-4 text-green-500" /> WhatsApp Link
          </Button>
          <Button onClick={shareEmail} variant="outline" className="w-full justify-start gap-3">
            <Mail className="h-4 w-4 text-accent" /> Email Link
          </Button>
          <Button onClick={copyLink} variant="outline" className="w-full justify-start gap-3">
            <Link2 className="h-4 w-4 text-muted-foreground" /> Copy Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
