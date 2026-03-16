"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { loginSuperAdmin } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldCheck, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';

const SuperAdminLogin = () => {
    const router = useRouter();
    const auth = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await loginSuperAdmin({ email, password });
            if (res?.token && auth?.login) {
                const user = await auth.login(res.token);
                if (user?.role === 'superadmin') {
                    router.push('/superadmin/dashboard');
                    toast.success("Welcome back, SuperAdmin");
                } else {
                    setError("Unauthorized: This page is for SuperAdmins only.");
                }
            }
        } catch (err: any) {
            setError(err.response?.data?.error || "Login failed. Please check your credentials.");
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
                <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase">apexis</h1>
                <p className="mt-1 text-sm tracking-[0.25em] text-muted-foreground uppercase">SuperAdmin Login</p>
            </div>

            <Card className="w-full max-w-sm border-0 shadow-none">
                <CardContent className="p-0">
                    <form onSubmit={handleLogin} className="space-y-6">
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

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                <Lock className="h-4 w-4" /> Password
                            </Label>
                            <PasswordInput
                                id="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-12 rounded-xl bg-secondary border-0 text-base"
                                required
                            />
                        </div>

                        {error && (
                            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium p-3 rounded-xl text-center">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="h-12 w-full rounded-xl bg-accent text-base font-bold uppercase tracking-wider text-accent-foreground hover:bg-accent/90"
                        >
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : "Sign In"}
                        </Button>
                    </form>

                    <div className="mt-8 text-center">
                        <button
                            type="button"
                            onClick={() => router.push('/login')}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Regular login? <span className="font-semibold text-accent">Go back</span>
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SuperAdminLogin;
