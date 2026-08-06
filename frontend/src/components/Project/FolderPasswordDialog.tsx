import React, { useState } from 'react';
import { Shield, Eye, EyeOff, X, Lock, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    setFolderPassword,
    changeFolderPassword,
    verifyFolderPassword,
    removeFolderPassword,
    forgotFolderPasswordReset
} from '@/services/folderService';

interface FolderPasswordDialogProps {
    isOpen: boolean;
    folder: any;
    user: any;
    initialMode?: 'unlock' | 'set' | 'change' | 'forgot' | 'remove';
    onClose: () => void;
    onSuccess: (action: 'unlocked' | 'updated' | 'removed') => void;
}

export default function FolderPasswordDialog({
    isOpen,
    folder,
    user,
    initialMode = 'unlock',
    onClose,
    onSuccess
}: FolderPasswordDialogProps) {
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

    const [mode, setMode] = useState<'unlock' | 'set' | 'change' | 'forgot' | 'remove'>(initialMode);
    
    // Form fields
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [email, setEmail] = useState(user?.email || '');
    const [loginPassword, setLoginPassword] = useState('');
    const [removeSecurity, setRemoveSecurity] = useState(false);

    const [showPass, setShowPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [showCurrentPass, setShowCurrentPass] = useState(false);
    const [showLoginPass, setShowLoginPass] = useState(false);

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    React.useEffect(() => {
        setMode(initialMode);
        resetForm();
    }, [initialMode, isOpen]);

    const resetForm = () => {
        setPassword('');
        setConfirmPassword('');
        setCurrentPassword('');
        setEmail(user?.email || '');
        setLoginPassword('');
        setRemoveSecurity(false);
        setErrorMsg(null);
        setShowPass(false);
        setShowConfirmPass(false);
        setShowCurrentPass(false);
        setShowLoginPass(false);
    };

    const handleUnlock = async () => {
        setErrorMsg(null);
        if (!password.trim()) {
            setErrorMsg('Please enter the folder password.');
            return;
        }
        setLoading(true);
        try {
            const res = await verifyFolderPassword(folder.id, password.trim());
            if (res.success) {
                resetForm();
                onSuccess('unlocked');
            } else {
                setErrorMsg(res.error || 'Incorrect password.');
            }
        } catch (err: any) {
            setErrorMsg(err?.response?.data?.error || 'Failed to verify password.');
        } finally {
            setLoading(false);
        }
    };

    const handleSetPassword = async () => {
        setErrorMsg(null);
        if (!password.trim()) {
            setErrorMsg('Please enter a password.');
            return;
        }
        if (password !== confirmPassword) {
            setErrorMsg('Passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            await setFolderPassword(folder.id, password.trim());
            resetForm();
            onSuccess('updated');
        } catch (err: any) {
            setErrorMsg(err?.response?.data?.error || 'Failed to set password.');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async () => {
        setErrorMsg(null);
        if (!currentPassword.trim() || !password.trim()) {
            setErrorMsg('Please fill in all password fields.');
            return;
        }
        if (password !== confirmPassword) {
            setErrorMsg('New passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            await changeFolderPassword(folder.id, currentPassword.trim(), password.trim());
            resetForm();
            onSuccess('updated');
        } catch (err: any) {
            setErrorMsg(err?.response?.data?.error || 'Failed to change password.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemovePassword = async () => {
        setErrorMsg(null);
        setLoading(true);
        try {
            await removeFolderPassword(folder.id, currentPassword.trim());
            resetForm();
            onSuccess('removed');
        } catch (err: any) {
            setErrorMsg(err?.response?.data?.error || 'Failed to remove password protection.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPasswordReset = async () => {
        setErrorMsg(null);
        if (!email.trim() || !loginPassword.trim()) {
            setErrorMsg('Please provide your account login email and password.');
            return;
        }
        if (!removeSecurity) {
            if (!password.trim()) {
                setErrorMsg('Please enter a new folder password.');
                return;
            }
            if (password !== confirmPassword) {
                setErrorMsg('New folder passwords do not match.');
                return;
            }
        }

        setLoading(true);
        try {
            await forgotFolderPasswordReset(folder.id, {
                email: email.trim(),
                loginPassword: loginPassword.trim(),
                newPassword: removeSecurity ? undefined : password.trim(),
                removeSecurity
            });
            resetForm();
            onSuccess(removeSecurity ? 'removed' : 'updated');
        } catch (err: any) {
            setErrorMsg(err?.response?.data?.error || 'Account verification failed.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-rose-500" />
                        <h3 className="text-base font-bold text-foreground">
                            {mode === 'unlock' && 'Protected Folder'}
                            {mode === 'set' && 'Set Folder Password'}
                            {mode === 'change' && 'Change Folder Password'}
                            {mode === 'forgot' && 'Reset Folder Password'}
                            {mode === 'remove' && 'Remove Password'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-secondary">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <p className="text-xs text-muted-foreground mt-2 mb-4">
                    {mode === 'unlock' && `Enter the password to access "${folder?.name || 'Confidential'}"`}
                    {mode === 'set' && `Set a security password for "${folder?.name || 'Confidential'}"`}
                    {mode === 'change' && `Update the password for "${folder?.name || 'Confidential'}"`}
                    {mode === 'forgot' && 'Verify your admin account credentials to reset folder password'}
                    {mode === 'remove' && `Remove password protection from "${folder?.name || 'Confidential'}"`}
                </p>

                {errorMsg && (
                    <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                        {errorMsg}
                    </div>
                )}

                {/* MODE: UNLOCK */}
                {mode === 'unlock' && (
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-semibold text-foreground">Folder Password</label>
                            <div className="relative mt-1">
                                <Input
                                    type={showPass ? 'text' : 'password'}
                                    placeholder="Enter folder password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pr-10 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {isAdmin && (
                            <button
                                type="button"
                                onClick={() => { setErrorMsg(null); setMode('forgot'); }}
                                className="text-xs font-semibold text-rose-500 hover:underline"
                            >
                                Forgot Folder Password?
                            </button>
                        )}
                    </div>
                )}

                {/* MODE: SET */}
                {mode === 'set' && (
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-semibold text-foreground">New Folder Password</label>
                            <div className="relative mt-1">
                                <Input
                                    type={showPass ? 'text' : 'password'}
                                    placeholder="Create folder password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pr-10 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-foreground">Confirm Password</label>
                            <div className="relative mt-1">
                                <Input
                                    type={showConfirmPass ? 'text' : 'password'}
                                    placeholder="Confirm folder password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pr-10 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODE: CHANGE */}
                {mode === 'change' && (
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-semibold text-foreground">Current Folder Password</label>
                            <div className="relative mt-1">
                                <Input
                                    type={showCurrentPass ? 'text' : 'password'}
                                    placeholder="Current folder password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="pr-10 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showCurrentPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-foreground">New Folder Password</label>
                            <div className="relative mt-1">
                                <Input
                                    type={showPass ? 'text' : 'password'}
                                    placeholder="New folder password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pr-10 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-foreground">Confirm New Password</label>
                            <div className="relative mt-1">
                                <Input
                                    type={showConfirmPass ? 'text' : 'password'}
                                    placeholder="Confirm new folder password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pr-10 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {isAdmin && (
                            <button
                                type="button"
                                onClick={() => { setErrorMsg(null); setMode('forgot'); }}
                                className="text-xs font-semibold text-rose-500 hover:underline"
                            >
                                Forgot Folder Password?
                            </button>
                        )}
                    </div>
                )}

                {/* MODE: FORGOT */}
                {mode === 'forgot' && (
                    <div className="space-y-3">
                        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-600 dark:text-blue-400">
                            Enter your Admin account email and app login password to authenticate and reset the folder security.
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-foreground">Admin Account Email</label>
                            <Input
                                type="email"
                                placeholder="Your login email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-foreground">Admin Login Password</label>
                            <div className="relative mt-1">
                                <Input
                                    type={showLoginPass ? 'text' : 'password'}
                                    placeholder="Your app login password"
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    className="pr-10 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowLoginPass(!showLoginPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                            <input
                                type="checkbox"
                                checked={removeSecurity}
                                onChange={(e) => setRemoveSecurity(e.target.checked)}
                                className="rounded text-rose-500 border-border"
                            />
                            <span className="text-xs font-medium text-foreground">Completely remove password protection</span>
                        </label>

                        {!removeSecurity && (
                            <>
                                <div>
                                    <label className="text-xs font-semibold text-foreground">New Folder Password</label>
                                    <div className="relative mt-1">
                                        <Input
                                            type={showPass ? 'text' : 'password'}
                                            placeholder="Enter new folder password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="pr-10 text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPass(!showPass)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-foreground">Confirm New Password</label>
                                    <div className="relative mt-1">
                                        <Input
                                            type={showConfirmPass ? 'text' : 'password'}
                                            placeholder="Confirm new folder password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="pr-10 text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPass(!showConfirmPass)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* MODE: REMOVE */}
                {mode === 'remove' && (
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-semibold text-foreground">Current Folder Password (Optional for Admin)</label>
                            <div className="relative mt-1">
                                <Input
                                    type={showCurrentPass ? 'text' : 'password'}
                                    placeholder="Current password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="pr-10 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showCurrentPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {isAdmin && (
                            <button
                                type="button"
                                onClick={() => { setErrorMsg(null); setMode('forgot'); }}
                                className="text-xs font-semibold text-rose-500 hover:underline"
                            >
                                Forgot Folder Password?
                            </button>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>

                    {mode === 'unlock' && (
                        <Button size="sm" className="bg-rose-500 hover:bg-rose-600 text-white" onClick={handleUnlock} disabled={loading}>
                            {loading ? 'Verifying...' : 'Unlock Folder'}
                        </Button>
                    )}

                    {mode === 'set' && (
                        <Button size="sm" className="bg-rose-500 hover:bg-rose-600 text-white" onClick={handleSetPassword} disabled={loading}>
                            {loading ? 'Saving...' : 'Set Password'}
                        </Button>
                    )}

                    {mode === 'change' && (
                        <Button size="sm" className="bg-rose-500 hover:bg-rose-600 text-white" onClick={handleChangePassword} disabled={loading}>
                            {loading ? 'Updating...' : 'Update Password'}
                        </Button>
                    )}

                    {mode === 'forgot' && (
                        <Button size="sm" className="bg-rose-500 hover:bg-rose-600 text-white" onClick={handleForgotPasswordReset} disabled={loading}>
                            {loading ? 'Verifying...' : 'Verify & Reset Password'}
                        </Button>
                    )}

                    {mode === 'remove' && (
                        <Button size="sm" className="bg-destructive hover:bg-destructive/90 text-white" onClick={handleRemovePassword} disabled={loading}>
                            {loading ? 'Removing...' : 'Confirm Remove Security'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
