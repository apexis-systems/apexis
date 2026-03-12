"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Camera, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSecureFileUrl } from '@/services/fileService';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ProfilePreviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: any;
    onImageSelect: () => void;
    uploading: boolean;
}

const ProfilePreviewModal = ({ open, onOpenChange, user, onImageSelect, uploading }: ProfilePreviewModalProps) => {
    const [imgError, setImgError] = useState(false);
    const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);

    // Reset error and fetch secure URL when user or open state changes
    useEffect(() => {
        let currentUrl: string | null = null;
        const fetchUrl = async () => {
            if (user?.profile_pic) {
                const url = await getSecureFileUrl(user.profile_pic);
                if (url) {
                    setProfilePicUrl(url);
                    currentUrl = url;
                    setImgError(false);
                }
            } else {
                setProfilePicUrl(null);
            }
        };

        if (open) {
            fetchUrl();
        }

        return () => {
            if (currentUrl) URL.createObjectURL(new Blob()).startsWith('blob:') && URL.revokeObjectURL(currentUrl);
        };
    }, [user?.profile_pic, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="max-w-sm rounded-2xl p-0 overflow-hidden border-none bg-background shadow-2xl">
                <DialogHeader className="p-0 absolute right-4 top-4 z-10">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenChange(false)}
                        className="rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </DialogHeader>

                <div className="p-8 flex flex-col items-center gap-6">
                    <div className={cn(
                        "w-48 h-48 rounded-2xl border-2 border-border overflow-hidden flex items-center justify-center shadow-inner relative",
                        !profilePicUrl || imgError ? "bg-muted" : "bg-background"
                    )}>
                        {profilePicUrl && !imgError ? (
                            <img
                                src={profilePicUrl}
                                alt="Profile Preview"
                                className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-primary-foreground bg-primary">
                                <User className="h-16 w-16" />
                            </div>
                        )}
                        {uploading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            </div>
                        )}
                    </div>

                    <div className="text-center">
                        <h3 className="text-lg font-bold text-foreground">Profile Picture</h3>
                        <p className="text-sm text-muted-foreground mt-1">This photo is visible to your team members and clients.</p>
                    </div>

                    <Button
                        onClick={() => {
                            onOpenChange(false);
                            onImageSelect();
                        }}
                        disabled={uploading}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Camera className="h-4 w-4" />
                        Change Photo
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ProfilePreviewModal;
