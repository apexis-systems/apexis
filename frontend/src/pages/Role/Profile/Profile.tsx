"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { LogOut, Shield, User, Camera, Loader2, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { updateUserProfilePic } from '@/services/userService';
import { getSecureFileUrl } from '@/services/fileService';
import { toast } from 'sonner';
import ProfilePreviewModal from '@/components/shared/ProfilePreviewModal';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { cn } from '@/lib/utils';

const Profile = () => {
    const { user, setUser, logout } = useAuth() as any;
    const router = useRouter();
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);

    // Fetch secure URL for profile pic
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
        fetchUrl();
        return () => {
            if (currentUrl) URL.createObjectURL(new Blob()).startsWith('blob:') && URL.revokeObjectURL(currentUrl);
        };
    }, [user?.profile_pic]);

    // Cropping states
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [imgSrc, setImgSrc] = useState('');
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const imgRef = useRef<HTMLImageElement>(null);

    if (!user) return null;

    const handleLogout = () => {
        logout();
        router.push('/');
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setCrop(undefined);
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setImgSrc(reader.result?.toString() || '');
            setIsCropModalOpen(true);
        });
        reader.readAsDataURL(file);
    };

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;
        const _crop = makeAspectCrop(
            { unit: '%', width: 90 },
            1,
            width,
            height
        );
        setCrop(centerCrop(_crop, width, height));
    }

    const handleUploadCropped = async () => {
        if (!completedCrop || !imgRef.current) return;

        setUploading(true);
        setIsCropModalOpen(false);

        try {
            const canvas = document.createElement('canvas');
            const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
            const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
            canvas.width = completedCrop.width;
            canvas.height = completedCrop.height;
            const ctx = canvas.getContext('2d');

            if (!ctx) throw new Error('No 2d context');

            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(
                imgRef.current,
                completedCrop.x * scaleX,
                completedCrop.y * scaleY,
                completedCrop.width * scaleX,
                completedCrop.height * scaleY,
                0,
                0,
                completedCrop.width,
                completedCrop.height
            );

            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
            if (!blob) throw new Error('Canvas is empty');

            const formData = new FormData();
            formData.append('profile_pic', blob, 'profile.jpg');

            const res = await updateUserProfilePic(formData);
            if (res.profile_pic) {
                setUser({ ...user, profile_pic: res.profile_pic });
                toast.success("Profile picture updated successfully");
            }
            setIsPreviewOpen(false);
        } catch (error) {
            console.error("Upload failed", error);
            toast.error("Failed to upload profile picture");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const roleBadgeColor: Record<UserRole, string> = {
        admin: 'bg-accent text-accent-foreground',
        superadmin: 'bg-accent text-accent-foreground',
        contributor: 'bg-primary text-primary-foreground',
        client: 'bg-secondary text-secondary-foreground',
    };

    return (
        <div className="p-8 max-w-lg mx-auto">
            <div className="flex flex-col items-center text-center mb-8">
                <div className="relative group mb-3">
                    <div
                        className={cn(
                            "flex h-24 w-24 items-center justify-center rounded-full border-2 border-border overflow-hidden ring-offset-2 ring-primary transition-all group-hover:ring-2 cursor-pointer relative",
                            !profilePicUrl || imgError ? "bg-secondary" : "bg-background"
                        )}
                        onClick={() => setIsPreviewOpen(true)}
                    >
                        {profilePicUrl && !imgError ? (
                            <img
                                src={profilePicUrl}
                                alt={user.name}
                                className="h-full w-full object-cover"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <User className="h-10 w-10 text-muted-foreground" />
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="h-6 w-6 text-white" />
                        </div>
                        {uploading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                                <Loader2 className="h-6 w-6 animate-spin text-white" />
                            </div>
                        )}
                    </div>
                </div>
                <h1 className="text-xl font-bold text-foreground">{user.name}</h1>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${roleBadgeColor[user.role as UserRole]}`}>
                    <Shield className="h-3 w-3" />
                    {(user.role as string).charAt(0).toUpperCase() + (user.role as string).slice(1)}
                </span>
            </div>

            <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full h-11 rounded-xl text-sm text-destructive border-destructive/30 hover:bg-destructive/5"
            >
                <LogOut className="h-4 w-4 mr-2" /> {t('sign_out')}
            </Button>

            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
            />

            {/* Profile Preview Modal */}
            <ProfilePreviewModal
                open={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
                user={user}
                onImageSelect={() => fileInputRef.current?.click()}
                uploading={uploading}
            />

            {/* Crop Modal */}
            {isCropModalOpen && !!imgSrc && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-background rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h2 className="font-bold text-lg">Crop Profile Photo</h2>
                            <button onClick={() => { setIsCropModalOpen(false); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 bg-secondary/30 flex-1 overflow-auto flex items-center justify-center min-h-[300px]">
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                aspect={1}
                                circularCrop
                            >
                                <img
                                    ref={imgRef}
                                    alt="Crop me"
                                    src={imgSrc}
                                    onLoad={onImageLoad}
                                    className="max-h-[50vh] max-w-full object-contain"
                                />
                            </ReactCrop>
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-3 bg-background">
                            <Button
                                variant="ghost"
                                onClick={() => { setIsCropModalOpen(false); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                className="px-6 rounded-xl hover:bg-secondary"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleUploadCropped}
                                disabled={!completedCrop?.width || !completedCrop?.height || uploading}
                                className="px-8 bg-accent hover:bg-accent/90 text-white rounded-xl font-bold"
                            >
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Save Photo
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Profile;
