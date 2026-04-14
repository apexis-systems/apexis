"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { LogOut, Shield, User, Camera, Loader2, X, ArrowLeft } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { updateUserProfilePic, updateUserName } from '@/services/userService';
import { getSecureFileUrl } from '@/services/fileService';
import { uploadOrganizationLogo, updateOrganization } from '@/services/organizationService';
import { toast } from 'sonner';
import { changePassword, getMyMemberships, switchContext } from '@/services/authService';
import ProfilePreviewModal from '@/components/shared/ProfilePreviewModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { KeyRound, CheckCircle2, Edit2, Check, Briefcase, Building, Layers, RefreshCw } from 'lucide-react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { cn } from '@/lib/utils';

const Profile = () => {
    const { user, setUser, logout, login } = useAuth() as any;
    const router = useRouter();
    const { t } = useLanguage();
    
    const [memberships, setMemberships] = useState<any[]>([]);
    const [isSwitching, setIsSwitching] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState('');
    const [nameLoading, setNameLoading] = useState(false);

    const [isCompanySettingsOpen, setIsCompanySettingsOpen] = useState(false);
    const [compName, setCompName] = useState('');
    const [compLoading, setCompLoading] = useState(false);
    const [compLogoUrl, setCompLogoUrl] = useState<string | null>(null);
    const [compLogoUploading, setCompLogoUploading] = useState(false);
    const compLogoRef = useRef<HTMLInputElement>(null);

    // Initial setups based on user
    useEffect(() => {
        if (user) {
            setEditNameValue(user.name || '');
            setCompName(user.organization?.name || '');
        }
    }, [user]);

    useEffect(() => {
        let currentUrl: string | null = null;
        if (user?.organization?.logo) {
            getSecureFileUrl(user.organization.logo).then(url => {
                if (url) {
                    setCompLogoUrl(url);
                    currentUrl = url;
                }
            });
        }
        return () => {
            if (currentUrl) URL.revokeObjectURL(currentUrl);
        };
    }, [user?.organization?.logo]);

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

    const handleSaveName = async () => {
        if (!editNameValue.trim() || editNameValue === user.name) {
            setIsEditingName(false);
            return;
        }
        setNameLoading(true);
        try {
            await updateUserName({ name: editNameValue });
            setUser({ ...user, name: editNameValue.trim() });
            toast.success("Name updated successfully");
            setIsEditingName(false);
        } catch (e) {
            toast.error("Failed to update name");
        } finally {
            setNameLoading(false);
        }
    };

    const handleSaveCompName = async () => {
        if (!compName.trim()) return;
        setCompLoading(true);
        try {
            await updateOrganization({ name: compName });
            setUser({ ...user, organization: { ...user.organization, name: compName } });
            toast.success("Company name updated");
        } catch (e) {
            toast.error("Failed to update company name");
        } finally {
            setCompLoading(false);
        }
    };

    const handleCompLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCompLogoUploading(true);
        try {
            const formData = new FormData();
            formData.append('logo', file);
            const res = await uploadOrganizationLogo(formData);
            if (res.logo) {
                setUser({ ...user, organization: { ...user.organization, logo: res.logo } });
                toast.success("Company logo updated");
            }
        } catch (e) {
            toast.error("Failed to upload company logo");
        } finally {
            setCompLogoUploading(false);
            if (compLogoRef.current) compLogoRef.current.value = '';
        }
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

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        setPasswordLoading(true);
        try {
            await changePassword({ currentPassword, newPassword });
            toast.success("Password updated successfully");
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setIsChangingPassword(false);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to update password");
        } finally {
            setPasswordLoading(false);
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

                {isEditingName ? (
                    <div className="flex items-center gap-2 mb-1">
                        <Input
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            className="h-8 text-center"
                            autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8 bg-green-500/10 text-green-600 hover:bg-green-500/20" onClick={handleSaveName} disabled={nameLoading}>
                            {nameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 bg-red-500/10 text-red-600 hover:bg-red-500/20" onClick={() => { setIsEditingName(false); setEditNameValue(user.name); }}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 group/name cursor-pointer" onClick={() => setIsEditingName(true)}>
                        <h1 className="text-xl font-bold text-foreground">{user.name}</h1>
                        <Edit2 className="h-4 w-4 text-muted-foreground " />
                    </div>
                )}

                <p className="text-sm text-muted-foreground">{user.email || user.phone_number}</p>
                <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${roleBadgeColor[user.role as UserRole]}`}>
                    <Shield className="h-3 w-3" />
                    {(user.role as string).charAt(0).toUpperCase() + (user.role as string).slice(1)}
                </span>
            </div>

            <div className="space-y-4 mb-8">

                {user.role === 'admin' && (
                    <div className="border border-border rounded-2xl overflow-hidden bg-secondary/10">
                        <button
                            onClick={() => setIsCompanySettingsOpen(!isCompanySettingsOpen)}
                            className="w-full flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Briefcase className="h-5 w-5 text-primary" />
                                </div>
                                <span className="font-bold text-sm uppercase tracking-wide">Company Settings</span>
                            </div>
                            <span className={cn("transition-transform", isCompanySettingsOpen ? "rotate-90" : "")}>
                                <ArrowLeft className="-rotate-90 h-4 w-4" />
                            </span>
                        </button>

                        {isCompanySettingsOpen && (
                            <div className="p-4 pt-0 border-t border-border/50">
                                <div className="space-y-6 pt-4">
                                    <div className="flex flex-col items-center">
                                        <div
                                            onClick={() => compLogoRef.current?.click()}
                                            className="h-20 w-20 rounded-2xl border-2 border-dashed border-primary/50 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-primary/5 transition-colors relative"
                                        >
                                            {compLogoUrl ? (
                                                <img src={compLogoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                                            ) : (
                                                <Building className="h-8 w-8 text-primary/50" />
                                            )}
                                            {compLogoUploading && (
                                                <div className="absolute inset-0 bg-background/50 flex items-center justify-center backdrop-blur-sm">
                                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold mt-2">Tap to change logo</p>
                                        <input type="file" ref={compLogoRef} className="hidden" accept="image/*" onChange={handleCompLogoSelect} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Company Name</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                value={compName}
                                                onChange={(e) => setCompName(e.target.value)}
                                                placeholder="Enter company name"
                                                className="h-11 rounded-xl bg-secondary/50 border-0 flex-1"
                                            />
                                            <Button
                                                onClick={handleSaveCompName}
                                                disabled={compLoading || !compName.trim() || compName === user.organization?.name}
                                                className="h-11 rounded-xl bg-primary text-primary-foreground font-bold px-6"
                                            >
                                                {compLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Change Password Toggle */}
                {(user.role === 'admin' || user.role === 'superadmin') && (
                    <div className="border border-border rounded-2xl overflow-hidden bg-secondary/10">
                        <button
                            onClick={() => setIsChangingPassword(!isChangingPassword)}
                            className="w-full flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center">
                                    <KeyRound className="h-5 w-5 text-accent" />
                                </div>
                                <span className="font-bold text-sm uppercase tracking-wide">Change Password</span>
                            </div>
                            <span className={cn("transition-transform", isChangingPassword ? "rotate-90" : "")}>
                                <ArrowLeft className="-rotate-90 h-4 w-4" />
                            </span>
                        </button>

                        {isChangingPassword && (
                            <div className="p-4 pt-0 border-t border-border/50">
                                <form onSubmit={handleChangePassword} className="space-y-4 pt-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Current Password</Label>
                                        <PasswordInput
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="h-11 rounded-xl bg-secondary/50 border-0"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">New Password</Label>
                                        <PasswordInput
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="h-11 rounded-xl bg-secondary/50 border-0"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Confirm New Password</Label>
                                        <PasswordInput
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="h-11 rounded-xl bg-secondary/50 border-0"
                                            required
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={passwordLoading}
                                        className="w-full h-11 rounded-xl bg-accent text-white font-bold uppercase tracking-wider text-xs"
                                    >
                                        {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
                                    </Button>
                                </form>
                            </div>
                        )}
                    </div>
                )}



                <Button
                    variant="outline"
                    onClick={handleLogout}
                    className="w-full h-11 rounded-xl text-sm text-destructive border-destructive/30 hover:bg-destructive/5"
                >
                    <LogOut className="h-4 w-4 mr-2" /> {t('sign_out')}
                </Button>
            </div>

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
