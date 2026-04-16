"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { forgotPasswordRequestOtp, forgotPasswordVerifyOtp, resetPassword } from '@/services/authService';
import { Loader2, KeyRound, Mail, ArrowLeft, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type Step = 'email' | 'otp' | 'reset';

const ForgotPasswordPage = () => {
    const router = useRouter();
    const [step, setStep] = useState<Step>('email');
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [error, setError] = useState('');

    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            await forgotPasswordRequestOtp(email, 'superadmin');
            setStep('otp');
            toast.success("OTP sent to your email");
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to send OTP");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const res = await forgotPasswordVerifyOtp(email, otp);
            setResetToken(res.resetToken);
            setStep('reset');
            toast.success("OTP verified");
        } catch (err: any) {
            setError(err.response?.data?.error || "Invalid OTP");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            await resetPassword(resetToken, newPassword);
            toast.success("Password reset successful");
            router.push('/auth/login');
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to reset password");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-card px-6">
            <div className="mb-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
                    <ShieldCheck className="h-10 w-10 text-primary-foreground" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground font-angelica flex items-center justify-center gap-1">
                    APEXIS
                    <span className="text-sm lowercase mt-2 font-angelica">pro™</span>
                </h1>
                <p className="mt-1 text-sm tracking-[0.25em] text-muted-foreground uppercase">Reset Password</p>
            </div>

            <Card className="w-full max-w-sm border-0 shadow-none">
                <CardContent className="p-0">
                    {step === 'email' && (
                        <form onSubmit={handleRequestOtp} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                    <Mail className="h-4 w-4" /> Work Email
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@apexis.in"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="h-12 rounded-xl bg-secondary border-0 text-base"
                                    required
                                />
                            </div>
                            {error && (
                                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium p-3 rounded-xl text-center">
                                    {error}
                                </div>
                            )}
                            <Button type="submit" disabled={isLoading} className="h-12 w-full rounded-xl bg-accent text-base font-bold uppercase tracking-wider text-accent-foreground hover:bg-accent/90">
                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send OTP"}
                            </Button>
                        </form>
                    )}

                    {step === 'otp' && (
                        <form onSubmit={handleVerifyOtp} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="otp" className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                    <KeyRound className="h-4 w-4" /> Verification Code
                                </Label>
                                <Input
                                    id="otp"
                                    placeholder="123456"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    className="h-12 rounded-xl bg-secondary border-0 text-base text-center tracking-[0.5em] font-bold"
                                    required
                                />
                                <p className="text-xs text-center text-muted-foreground">Enter the 6-digit code sent to {email}</p>
                            </div>
                            {error && (
                                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium p-3 rounded-xl text-center">
                                    {error}
                                </div>
                            )}
                            <Button type="submit" disabled={isLoading} className="h-12 w-full rounded-xl bg-accent text-base font-bold uppercase tracking-wider text-accent-foreground hover:bg-accent/90">
                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify OTP"}
                            </Button>
                            <button type="button" onClick={() => setStep('email')} className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline">
                                Back to email
                            </button>
                        </form>
                    )}

                    {step === 'reset' && (
                        <form onSubmit={handleResetPassword} className="space-y-6">
                            <div className="space-y-2 text-center mb-6">
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Account</p>
                                <p className="text-base font-semibold text-foreground">{email}</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-password text-sm font-bold text-muted-foreground uppercase tracking-wide">New Password</Label>
                                <PasswordInput
                                    id="new-password"
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="h-12 rounded-xl bg-secondary border-0 text-base"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password text-sm font-bold text-muted-foreground uppercase tracking-wide">Confirm Password</Label>
                                <PasswordInput
                                    id="confirm-password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="h-12 rounded-xl bg-secondary border-0 text-base"
                                    required
                                />
                            </div>
                            {error && (
                                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium p-3 rounded-xl text-center">
                                    {error}
                                </div>
                            )}
                            <Button type="submit" disabled={isLoading} className="h-12 w-full rounded-xl bg-accent text-base font-bold uppercase tracking-wider text-accent-foreground hover:bg-accent/90">
                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Reset Password"}
                            </Button>
                        </form>
                    )}

                    <div className="mt-10 text-center">
                        <button
                            type="button"
                            onClick={() => router.push('/auth/login')}
                            className="flex items-center justify-center gap-2 mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors group"
                        >
                            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                            Back to Sign In
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ForgotPasswordPage;
