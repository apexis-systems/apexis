"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { loginSuperAdmin, loginAdmin, loginProject } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import Cookies from 'js-cookie';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [projectCode, setProjectCode] = useState('');
    const [clientName, setClientName] = useState('');
    const [selectedRole, setSelectedRole] = useState<'superadmin' | 'admin' | 'contributor' | 'client'>('admin');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const auth = useAuth();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            let res;
            if (selectedRole === 'superadmin') {
                res = await loginSuperAdmin({ email, password });
            } else if (selectedRole === 'admin') {
                res = await loginAdmin({ email, password });
            } else if (selectedRole === 'contributor') {
                res = await loginProject({ email, code: projectCode });
            } else if (selectedRole === 'client') {
                res = await loginProject({ name: clientName, code: projectCode });
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
            setError(err.response?.data?.error || "Login failed. Please check your credentials.");
        } finally {
            setIsLoading(false);
        }
    };

    const roles: { value: 'superadmin' | 'admin' | 'contributor' | 'client'; label: string; desc: string }[] = [
        { value: 'superadmin', label: 'Super Admin', desc: 'System management' },
        { value: 'admin', label: 'Admin', desc: 'Full project control' },
        { value: 'contributor', label: 'Contributor', desc: 'Upload & view assigned' },
        { value: 'client', label: 'Client', desc: 'View shared files only' },
    ];

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-card px-6 relative">
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

                        {/* Dynamic Input Fields based on Role */}
                        {selectedRole === 'client' ? (
                            <div className="space-y-2">
                                <Label htmlFor="clientName" className="text-sm font-medium">Your Name</Label>
                                <Input
                                    id="clientName"
                                    type="text"
                                    placeholder="John Doe"
                                    value={clientName}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClientName(e.target.value)}
                                    className="h-12 rounded-xl bg-secondary border-0 text-base"
                                    required
                                />
                            </div>
                        ) : (
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
                        )}

                        {(selectedRole === 'superadmin' || selectedRole === 'admin') && (
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                                    className="h-12 rounded-xl bg-secondary border-0 text-base"
                                    required
                                />
                            </div>
                        )}

                        {(selectedRole === 'contributor' || selectedRole === 'client') && (
                            <div className="space-y-2">
                                <Label htmlFor="projectCode" className="text-sm font-medium">Project Code</Label>
                                <Input
                                    id="projectCode"
                                    type="text"
                                    placeholder="e.g. ABC123XYZ"
                                    value={projectCode}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProjectCode(e.target.value)}
                                    className="h-12 rounded-xl bg-secondary border-0 text-base"
                                    required
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Select Role</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {roles.map((role) => (
                                    <button
                                        key={role.value}
                                        type="button"
                                        onClick={() => {
                                            setSelectedRole(role.value);
                                            setError('');
                                        }}
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
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </Button>

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
