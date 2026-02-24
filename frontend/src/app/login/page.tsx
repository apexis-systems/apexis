"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useInterface } from '@/contexts/InterfaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
// import LanguageSelector from '@/components/shared/LanguageSelector';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState<'admin' | 'contributor' | 'client'>('admin');
    const auth = useAuth();
    const interfaceCtx = useInterface();
    const router = useRouter();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (auth?.login) {
            auth.login(selectedRole);
        }
        // Fixed to push to /dashboard always for now, or based on mode
        router.push(interfaceCtx?.mode === 'desktop' ? '/dashboard' : '/dashboard');
    };

    const roles: { value: 'admin' | 'contributor' | 'client'; label: string; desc: string }[] = [
        { value: 'admin', label: 'Admin', desc: 'Full project control' },
        { value: 'contributor', label: 'Contributor', desc: 'Upload & view assigned' },
        { value: 'client', label: 'Client', desc: 'View shared files only' },
    ];

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-card px-6 relative">
            <div className="absolute top-4 right-4">
                {/* <LanguageSelector /> */}
            </div>
            <div className="mb-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
                    <span className="text-2xl font-black tracking-tight text-primary-foreground">A</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">apexis</h1>
                <p className="mt-1 text-sm tracking-[0.25em] text-muted-foreground">
                    RECORD · REPORT · RELEASE
                </p>
            </div>

            <Card className="w-full max-w-sm border-0 shadow-none">
                <CardContent className="p-0">
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium">Work Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                                className="h-12 rounded-xl bg-secondary border-0 text-base"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                                className="h-12 rounded-xl bg-secondary border-0 text-base"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Demo Role</Label>
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
                            type="submit"
                            className="h-12 w-full rounded-xl bg-accent text-base font-semibold text-accent-foreground hover:bg-accent/90"
                        >
                            Sign In
                        </Button>

                        <button type="button" className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
                            Sign in with SSO →
                        </button>

                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => router.push('/signup')}
                                className="text-sm text-muted-foreground hover:text-foreground"
                            >
                                Don&apos;t have an account? <span className="font-semibold text-accent">Sign Up</span>
                            </button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default Login;
