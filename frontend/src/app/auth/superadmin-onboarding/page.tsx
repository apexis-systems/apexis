"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { verifyInvitation, completeSuperAdminOnboarding, loginSuperAdmin } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldCheck, Mail, Lock, UserCircle } from 'lucide-react';
import { toast } from 'sonner';

const OnboardingContent = () => {
    const router = useRouter();
    const auth = useAuth();
    const searchParams = useSearchParams();
    const token = searchParams?.get('token') || null;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) {
            router.push('/');
            return;
        }

        const verify = async () => {
            try {
                const data = await verifyInvitation(token);
                setEmail(data.email);
            } catch (err) {
                toast.error("Invalid or expired invitation link");
                router.push('/');
            } finally {
                setLoading(false);
            }
        };

        verify();
    }, [token, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim() || !password.trim()) {
            setError("All fields are required");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setSubmitting(true);
        try {
            await completeSuperAdminOnboarding({
                token: token!,
                name: name.trim(),
                password: password.trim()
            });

            // Auto Logan after setup
            if (auth?.login) {
                // If there's an existing user, it's better to log them out first to be safe, 
                // but the login function in AuthContext usually overwrites the token.
                const loginRes = await loginSuperAdmin({ email, password: password.trim() });
                if (loginRes?.token) {
                    const user = await auth.login(loginRes.token);
                    if (user?.role) {
                        toast.success("Account set up & logged in successfully");
                        router.push(`/${user.role}/dashboard`);
                        return;
                    }
                }
            }

            toast.success("Account set up successfully");
            router.push('/login');
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to complete onboarding");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <Loader2 className="h-10 w-10 animate-spin text-accent" />
                <p className="mt-4 text-muted-foreground animate-pulse">Verifying invitation...</p>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-card px-6">
            <div className="mb-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
                    <ShieldCheck className="h-10 w-10 text-primary-foreground" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">apexis</h1>
                <p className="mt-1 text-sm tracking-[0.25em] text-muted-foreground">COMPLETE YOUR SETUP</p>
            </div>

            <Card className="w-full max-w-sm border-0 shadow-none">
                <CardContent className="p-0">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                <Mail className="h-4 w-4" /> Work Email
                            </Label>
                            <Input
                                value={email}
                                disabled
                                className="h-12 rounded-xl bg-secondary border-0 text-base font-medium opacity-70"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                <UserCircle className="h-4 w-4" /> Full Name
                            </Label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="Enter your full name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="h-12 rounded-xl bg-secondary border-0 text-base"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                <Lock className="h-4 w-4" /> Set Password
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Min. 6 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-12 rounded-xl bg-secondary border-0 text-base"
                                required
                                minLength={6}
                            />
                        </div>

                        {error && (
                            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium p-3 rounded-xl text-center">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={submitting}
                            className="h-12 w-full rounded-xl bg-accent text-base font-bold uppercase tracking-wider text-accent-foreground hover:bg-accent/90"
                        >
                            {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : "Complete Setup"}
                        </Button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-muted-foreground italic">
                            By completing your setup, you agree to join the Apexis platform as a SuperAdmin.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const SuperAdminOnboardingPage = () => {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-screen">
                <Loader2 className="h-10 w-10 animate-spin text-accent" />
            </div>
        }>
            <OnboardingContent />
        </Suspense>
    );
};

export default SuperAdminOnboardingPage;
