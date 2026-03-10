"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { loginSuperAdmin, loginAdmin, loginProject, getQrSession } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import { QRCodeCanvas } from 'qrcode.react';
import { io, Socket } from 'socket.io-client';
import { QrCode, Mail } from 'lucide-react';

const Login = () => {
    // Mode toggle
    const [loginMode, setLoginMode] = useState<'qr' | 'email'>('qr');

    // Email/Password State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [projectCode, setProjectCode] = useState('');
    const [clientName, setClientName] = useState('');
    const [selectedRole, setSelectedRole] = useState<'superadmin' | 'admin' | 'contributor' | 'client'>('admin');

    // Auth overall State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const auth = useAuth();

    // QR Code State
    const [qrSessionId, setQrSessionId] = useState<string | null>(null);
    const [qrExpired, setQrExpired] = useState(false);

    useEffect(() => {
        let socket: Socket | null = null;

        if (loginMode === 'qr') {
            generateSessionAndConnect();
        }

        async function generateSessionAndConnect() {
            setIsLoading(true);
            setQrExpired(false);
            setError('');
            try {
                // 1. Fetch exactly one UUID
                const { sessionId } = await getQrSession();
                setQrSessionId(sessionId);

                // 2. Connect to the socket server
                const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001';
                socket = io(backendUrl);

                socket.on('connect', () => {
                    // 3. Join the room specific to our UUID
                    socket?.emit('join-qr-room', sessionId);
                });

                // 4. Listen for the auth success event
                socket.on('qr-authorized', async (data: { token: string; user: any }) => {
                    if (data?.token && auth?.login) {
                        localStorage.setItem('qrSessionId', sessionId);
                        const user = await auth.login(data.token);
                        if (user?.role) {
                            router.push(`/${user.role}/dashboard`);
                            return;
                        }
                        router.push(`/`);
                    }
                });

                // QR Expires in 2 mins, so we force refresh UI
                setTimeout(() => {
                    setQrExpired(true);
                    if (socket) socket.disconnect();
                }, 120 * 1000);

            } catch (err) {
                console.error("Failed to init QR flow", err);
                setError("Could not generate login QR. Please check connection.");
            } finally {
                setIsLoading(false);
            }
        }

        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [loginMode]);

    const handleEmailLogin = async (e: React.FormEvent) => {
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
            <div className="mb-8 text-center">
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

                    {/* View Switcher Tabs */}
                    <div className="flex rounded-xl bg-secondary p-1 mb-6">
                        <button
                            onClick={() => setLoginMode('qr')}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${loginMode === 'qr' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <QrCode className="h-4 w-4" />
                            QR Login
                        </button>
                        <button
                            onClick={() => setLoginMode('email')}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${loginMode === 'email' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Mail className="h-4 w-4" />
                            Email Login
                        </button>
                    </div>

                    {loginMode === 'qr' ? (
                        <div className="flex flex-col items-center py-6">
                            <h2 className="text-xl font-bold text-foreground mb-2">Scan to Login</h2>
                            <p className="text-sm text-muted-foreground text-center mb-8 px-4">
                                Open the Apexis mobile app, go to Settings, and scan this QR code to sign in instantly.
                            </p>

                            <div className="relative flex items-center justify-center bg-white p-4 rounded-3xl border border-border shadow-sm mb-6 w-64 h-64">
                                {isLoading ? (
                                    <div className="animate-pulse flex flex-col items-center gap-3">
                                        <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                                        <span className="text-sm text-muted-foreground font-medium">Generating secure code...</span>
                                    </div>
                                ) : qrExpired ? (
                                    <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6 text-center">
                                        <QrCode className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
                                        <h3 className="font-bold text-foreground mb-1">Code Expired</h3>
                                        <p className="text-xs text-muted-foreground mb-4">For your security, QR codes expire after 2 minutes.</p>
                                        <Button
                                            onClick={() => setLoginMode('qr')}
                                            className="w-full rounded-xl bg-primary text-primary-foreground font-semibold"
                                            size="sm"
                                        >
                                            Generate New Code
                                        </Button>
                                    </div>
                                ) : qrSessionId ? (
                                    <QRCodeCanvas
                                        value={qrSessionId}
                                        size={220}
                                        bgColor={"#ffffff"}
                                        fgColor={"#000000"}
                                        level={"H"}
                                    />
                                ) : (
                                    <div className="text-red-500 text-sm font-medium">{error}</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleEmailLogin} className="space-y-5">
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
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default Login;
