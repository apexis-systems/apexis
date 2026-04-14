"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { requestSuperAdminOtp, requestAdminOtp, verifySuperAdminOtp, verifyAdminOtp } from '@/services/authService';
import Cookies from 'js-cookie';
import { useAuth } from '@/contexts/AuthContext';

const Signup = () => {
    const [step, setStep] = useState<'details' | 'otp'>('details');
    const [selectedRole, setSelectedRole] = useState<'superadmin' | 'admin'>('admin');

    // Form fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [orgName, setOrgName] = useState('');
    const [otp, setOtp] = useState('');

    // UI states
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const auth = useAuth();

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            if (selectedRole === 'superadmin') {
                await requestSuperAdminOtp({ name, email, password });
            } else {
                if (!orgName.trim()) {
                    throw new Error("Organization Name is required for Admins");
                }
                await requestAdminOtp({ name, email, password, organization_name: orgName });
            }
            setStep('otp');
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to send OTP. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (otp.length !== 6) { setError('Please enter a 6-digit OTP'); return; }

        setIsLoading(true);
        setError('');

        try {
            let res;
            if (selectedRole === 'superadmin') {
                res = await verifySuperAdminOtp({ email, otp });
            } else {
                res = await verifyAdminOtp({ email, otp });
            }

            if (res?.token) {
                if (auth?.login) {
                    const user = await auth.login(res.token);
                    if (user?.role) {
                        router.push(`/${user.role}/dashboard`);
                        return;
                    }
                }
                router.push(`/`);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || "Invalid OTP. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const roles: { value: 'superadmin' | 'admin'; label: string; desc: string }[] = [
        { value: 'superadmin', label: 'Super Admin', desc: 'System management' },
        { value: 'admin', label: 'Admin', desc: 'Full project control' },
    ];

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-card px-6">
            <div className="mb-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
                    <span className="text-2xl font-black tracking-tight text-primary-foreground font-angelica">A</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-primary font-angelica flex items-center justify-center gap-1">
                    APEXIS
                    <span className="text-sm lowercase mt-2 font-angelica">pro™</span>
                </h1>
                <p className="mt-1 text-sm tracking-[0.25em] text-muted-foreground uppercase">CREATE YOUR ACCOUNT</p>
            </div>

            <Card className="w-full max-w-sm border-0 shadow-none">
                <CardContent className="p-0">
                    {step === 'details' && (
                        <form onSubmit={handleSendOtp} className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Select Your Role</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {roles.map((role) => (
                                        <button
                                            key={role.value}
                                            type="button"
                                            onClick={() => { setSelectedRole(role.value); setError(''); }}
                                            className={`rounded-xl border-2 p-3 text-center transition-all ${selectedRole === role.value
                                                ? 'border-accent bg-accent/10'
                                                : 'border-border bg-secondary'
                                                }`}
                                        >
                                            <div className="text-xs font-bold">{role.label}</div>
                                            <div className="mt-0.5 text-[10px] text-muted-foreground">{role.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="John Doe"
                                    value={name}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                                    className="h-12 rounded-xl bg-secondary border-0 text-base"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-medium">Work Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@company.com"
                                    value={email}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                                    className="h-12 rounded-xl bg-secondary border-0 text-base"
                                    required
                                />
                            </div>

                            {selectedRole === 'admin' && (
                                <div className="space-y-2">
                                    <Label htmlFor="orgName" className="text-sm font-medium">Organization Name</Label>
                                    <Input
                                        id="orgName"
                                        type="text"
                                        placeholder="Acme Corp"
                                        value={orgName}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrgName(e.target.value)}
                                        className="h-12 rounded-xl bg-secondary border-0 text-base"
                                        required
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                                <PasswordInput
                                    id="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                                    className="h-12 rounded-xl bg-secondary border-0 text-base"
                                    required
                                    minLength={6}
                                />
                            </div>

                            {error && (
                                <div className="text-red-500 text-sm font-medium text-center">
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="h-12 w-full rounded-xl bg-accent text-base font-semibold text-accent-foreground hover:bg-accent/90"
                            >
                                {isLoading ? 'Sending...' : 'Send OTP'}
                            </Button>
                        </form>
                    )}

                    {step === 'otp' && (
                        <form onSubmit={handleVerifyOtp} className="space-y-5">
                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Enter 6-digit OTP</Label>
                                <p className="text-xs text-muted-foreground">Sent to {email}</p>
                                <div className="flex justify-center">
                                    <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                                        <InputOTPGroup>
                                            <InputOTPSlot index={0} />
                                            <InputOTPSlot index={1} />
                                            <InputOTPSlot index={2} />
                                            <InputOTPSlot index={3} />
                                            <InputOTPSlot index={4} />
                                            <InputOTPSlot index={5} />
                                        </InputOTPGroup>
                                    </InputOTP>
                                </div>
                            </div>

                            {error && (
                                <div className="text-red-500 text-sm font-medium text-center">
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={otp.length !== 6 || isLoading}
                                className="h-12 w-full rounded-xl bg-accent text-base font-semibold text-accent-foreground hover:bg-accent/90"
                            >
                                {isLoading ? 'Verifying...' : 'Verify OTP & Create Account'}
                            </Button>

                            <button
                                type="button"
                                onClick={() => { setStep('details'); setOtp(''); setError(''); }}
                                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                            >
                                ← Change details
                            </button>
                        </form>
                    )}

                    <div className="mt-6 text-center">
                        <button
                            type="button"
                            onClick={() => router.push('/login')}
                            className="text-sm text-muted-foreground hover:text-foreground"
                        >
                            Already have an account? <span className="font-semibold text-accent">Sign In</span>
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Signup;
