"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const Signup = () => {
    const [contact, setContact] = useState('');
    const [step, setStep] = useState<'contact' | 'otp' | 'role'>('contact');
    const [otp, setOtp] = useState('');
    const [selectedRole, setSelectedRole] = useState<'superadmin' | 'admin' | 'contributor' | 'client'>('contributor');
    const auth = useAuth();
    const router = useRouter();

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    const isMobile = /^\d{10}$/.test(contact);
    const isValidContact = isEmail || isMobile;

    const handleSendOtp = () => {
        if (!isValidContact) { alert('Please enter a valid email or 10-digit mobile number'); return; }
        setStep('otp');
    };

    const handleVerifyOtp = () => {
        if (otp.length !== 6) { alert('Please enter a 6-digit OTP'); return; }
        setStep('role');
    };

    const handleCreateAccount = () => {
        if (auth?.login) auth.login(selectedRole);
        router.push(`/${selectedRole}/dashboard`);
    };

    const roles: { value: 'superadmin' | 'admin' | 'contributor' | 'client'; label: string; desc: string }[] = [
        { value: 'superadmin', label: 'Super Admin', desc: 'System management' },
        { value: 'admin', label: 'Admin', desc: 'Full project control' },
        { value: 'contributor', label: 'Contributor', desc: 'Upload & view assigned' },
        { value: 'client', label: 'Client', desc: 'View shared files only' },
    ];

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-card px-6">
            <div className="mb-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
                    <span className="text-2xl font-black tracking-tight text-primary-foreground">A</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">apexis</h1>
                <p className="mt-1 text-sm tracking-[0.25em] text-muted-foreground">CREATE YOUR ACCOUNT</p>
            </div>

            <Card className="w-full max-w-sm border-0 shadow-none">
                <CardContent className="p-0">
                    {step === 'contact' && (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="contact" className="text-sm font-medium">Email or Mobile Number</Label>
                                <Input
                                    id="contact"
                                    type="text"
                                    placeholder="you@company.com or 9876543210"
                                    value={contact}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContact(e.target.value)}
                                    className="h-12 rounded-xl bg-secondary border-0 text-base"
                                />
                                {contact && !isValidContact && (
                                    <p className="text-xs text-destructive">Enter a valid email or 10-digit mobile number</p>
                                )}
                            </div>
                            <Button
                                onClick={handleSendOtp}
                                disabled={!isValidContact}
                                className="h-12 w-full rounded-xl bg-accent text-base font-semibold text-accent-foreground hover:bg-accent/90"
                            >
                                Send OTP
                            </Button>
                        </div>
                    )}

                    {step === 'otp' && (
                        <div className="space-y-5">
                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Enter 6-digit OTP</Label>
                                <p className="text-xs text-muted-foreground">Sent to {contact}</p>
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
                            <Button
                                onClick={handleVerifyOtp}
                                disabled={otp.length !== 6}
                                className="h-12 w-full rounded-xl bg-accent text-base font-semibold text-accent-foreground hover:bg-accent/90"
                            >
                                Verify OTP
                            </Button>
                            <button
                                type="button"
                                onClick={() => { setStep('contact'); setOtp(''); }}
                                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                            >
                                ← Change {isEmail ? 'email' : 'number'}
                            </button>
                        </div>
                    )}

                    {step === 'role' && (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Select Your Role</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {roles.map((role) => (
                                        <button
                                            key={role.value}
                                            type="button"
                                            onClick={() => setSelectedRole(role.value)}
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
                            <Button
                                onClick={handleCreateAccount}
                                className="h-12 w-full rounded-xl bg-accent text-base font-semibold text-accent-foreground hover:bg-accent/90"
                            >
                                Create Account
                            </Button>
                        </div>
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
