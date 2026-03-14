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
import { QrCode, Monitor, Download, ChevronRight, Lock } from 'lucide-react';
const Login = () => {
    // Mode toggle
    const [loginMode, setLoginMode] = useState<'qr' | 'email'>('email');

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
    const [qrRefreshTrigger, setQrRefreshTrigger] = useState(0);

    useEffect(() => {
        let socket: Socket | null = null;
        let expiryTimer: NodeJS.Timeout | null = null;

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
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                const backendUrl = apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl;
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
                expiryTimer = setTimeout(() => {
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
            if (expiryTimer) {
                clearTimeout(expiryTimer);
            }
        };
    }, [loginMode, qrRefreshTrigger]);

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
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 relative overflow-y-auto w-full">

            <div className="w-full max-w-4xl flex flex-col gap-6 items-center">

                <div className="flex flex-col items-center gap-5">
                    <div className="hidden sm:flex h-14 w-14 bg-secondary/50 rounded-2xl items-center justify-center border border-border/50">
                        <Monitor className="h-6 w-6 text-foreground/80" />
                    </div>
                    <div className='flex flex-col items-center'>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase">apexis</h1>
                        <p className="mt-1 text-sm tracking-[0.25em] text-muted-foreground">
                            RECORD · REPORT · RELEASE
                        </p>
                    </div>
                </div>


                {/* Main Auth Card */}
                <Card className="w-full border-0 shadow-md rounded-[32px] overflow-hidden bg-card">
                    <CardContent className="p-0">
                        {loginMode === 'qr' ? (
                            <div className="flex flex-col md:flex-row min-h-[500px]">
                                {/* Left Side: Scan Instructions */}
                                <div className="flex-1 p-8 sm:p-14 border-b md:border-b-0 md:border-r border-border/40 flex flex-col">
                                    <h2 className="text-[32px] font-normal text-foreground mb-10 tracking-tight">Scan to log in</h2>

                                    <div className="space-y-8 flex-1">
                                        <div className="flex items-start gap-5">
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-sm font-semibold text-foreground mt-0.5">1</div>
                                            <p className="text-[17px] text-foreground leading-snug pt-0.5">Open the <span className="font-semibold text-foreground inline-flex items-center gap-1.5 bg-secondary px-2 py-0.5 rounded-md">Apexis</span> mobile app & log in</p>
                                        </div>
                                        <div className="flex items-start gap-5">
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-sm font-semibold text-foreground mt-0.5">2</div>
                                            <p className="text-[17px] text-foreground leading-snug pt-0.5">Go to <span className="font-semibold text-foreground">Profile &gt; Linked Devices &gt; Link a Device</span></p>
                                        </div>
                                        <div className="flex items-start gap-5">
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-sm font-semibold text-foreground mt-0.5">3</div>
                                            <p className="text-[17px] text-foreground leading-snug pt-0.5">Point your phone to this screen to capture the code</p>
                                        </div>
                                        {/* <div className="pt-2">
                                            <a href="#" className="flex items-center gap-1 text-[15px] font-medium text-accent hover:underline">
                                                Need help? <ChevronRight className="h-4 w-4 -ml-0.5" />
                                            </a>
                                        </div> */}
                                    </div>

                                    {/* <div className="mt-8 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="h-4 w-4 rounded-sm bg-accent flex items-center justify-center">
                                                <ChevronRight className="h-3 w-3 text-white rotate-90" />
                                            </div>
                                            <span className="text-[15px] font-medium text-foreground">Stay logged in on this browser</span>
                                        </div>
                                        <button
                                            onClick={() => setLoginMode('email')}
                                            className="text-[15px] font-medium text-accent hover:underline flex items-center gap-1"
                                        >
                                            Log in with password <ChevronRight className="h-4 w-4 -ml-0.5" />
                                        </button>
                                    </div> */}
                                </div>

                                {/* Right Side: QR Code Area */}
                                <div className="w-full md:w-[420px] bg-secondary/20 p-8 sm:p-14 flex flex-col items-center justify-center relative">
                                    <div className="relative">
                                        {isLoading ? (
                                            <div className="w-[264px] h-[264px] flex flex-col items-center justify-center bg-secondary/30 rounded-3xl">
                                                <div className="h-10 w-10 rounded-full border-4 border-accent border-t-transparent animate-spin mb-4"></div>
                                                <span className="text-sm text-muted-foreground font-medium">Generating secure code...</span>
                                            </div>
                                        ) : qrExpired ? (
                                            <div className="w-[264px] h-[264px] flex flex-col items-center justify-center bg-secondary/50 rounded-3xl text-center p-6 border border-border/50 backdrop-blur-sm">
                                                <QrCode className="h-12 w-12 text-muted-foreground mb-4 opacity-40" />
                                                <h3 className="font-bold text-foreground mb-1 text-lg">Code Expired</h3>
                                                <p className="text-xs text-muted-foreground mb-5 px-2">For your security, QR codes expire after 2 minutes.</p>
                                                <Button
                                                    onClick={() => setQrRefreshTrigger(prev => prev + 1)}
                                                    className="w-full rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm"
                                                >
                                                    Generate New Code
                                                </Button>
                                            </div>
                                        ) : qrSessionId ? (
                                            <div className="relative bg-white p-2 rounded-2xl shadow-sm border border-border">
                                                <QRCodeCanvas
                                                    value={qrSessionId}
                                                    size={240}
                                                    bgColor={"#ffffff"}
                                                    fgColor={"#111b21"}
                                                    level={"H"}
                                                />
                                                {/* Custom center logo/icon overlay */}
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <div className="bg-white p-1 rounded-full flex items-center justify-center" style={{ width: 54, height: 54 }}>
                                                        <div className="bg-[#111b21] w-full h-full rounded-full flex items-center justify-center border-2 border-white">
                                                            <span className="text-2xl font-black text-white">A</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-[264px] h-[264px] flex flex-col items-center justify-center text-center p-4">
                                                <div className="text-red-500 text-sm font-medium">{error}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Email Mode - Styled cleanly in the same card wrapper */
                            <div className="flex flex-col min-h-[500px] p-8 sm:p-14 max-w-[500px] mx-auto w-full relative">
                                <button
                                    onClick={() => setLoginMode('qr')}
                                    className="absolute top-8 left-8 text-[15px] font-medium text-accent hover:underline flex items-center gap-1 transition-colors"
                                >
                                    <ChevronRight className="h-4 w-4 rotate-180 -mr-0.5" /> Back to QR Login
                                </button>

                                <div className="w-full mt-12 flex-1 flex flex-col justify-center">
                                    <div className="mb-8 text-center pt-4">
                                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
                                            <span className="text-xl font-black tracking-tight text-primary-foreground">A</span>
                                        </div>
                                        <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
                                        <p className="text-sm text-muted-foreground mt-1">Select your role and enter credentials.</p>
                                    </div>

                                    <form onSubmit={handleEmailLogin} className="space-y-6">

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
                                                        ? 'border-primary bg-primary/5'
                                                        : 'border-border/50 bg-secondary/50'
                                                        }`}
                                                >
                                                    <div className="text-[13px] font-bold">{role.label}</div>
                                                    <div className="mt-0.5 text-[10px] text-muted-foreground">{role.desc}</div>
                                                </button>
                                            ))}
                                        </div>

                                        {selectedRole === 'client' ? (
                                            <div className="space-y-2">
                                                <Label htmlFor="clientName" className="text-sm font-medium">Your Name</Label>
                                                <Input
                                                    id="clientName"
                                                    type="text"
                                                    placeholder="John Doe"
                                                    value={clientName}
                                                    onChange={(e) => setClientName(e.target.value)}
                                                    className="h-12 rounded-xl bg-secondary/50 border-border/50 text-base"
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
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="h-12 rounded-xl bg-secondary/50 border-border/50 text-base"
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
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="h-12 rounded-xl bg-secondary/50 border-border/50 text-base"
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
                                                    onChange={(e) => setProjectCode(e.target.value)}
                                                    className="h-12 rounded-xl bg-secondary/50 border-border/50 text-base"
                                                    required
                                                />
                                            </div>
                                        )}

                                        {error && (
                                            <div className="text-red-500 text-sm font-medium text-center bg-red-50 p-3 rounded-lg border border-red-100">
                                                {error}
                                            </div>
                                        )}

                                        <Button
                                            type="submit"
                                            disabled={isLoading}
                                            className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 mt-2"
                                        >
                                            {isLoading ? 'Signing In...' : 'Sign In'}
                                        </Button>

                                        <div className="text-center pt-2">
                                            <button
                                                type="button"
                                                onClick={() => router.push('/signup')}
                                                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                Don&apos;t have an account? <span className="font-semibold text-primary">Sign Up</span>
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Bottom Footnote matching the design */}
                <div className="mt-10 flex flex-col items-center gap-4">
                    {/* <p className="text-[15px] text-muted-foreground flex items-center gap-1.5">
                        Don&apos;t have an Apexis account? <button onClick={() => router.push('/signup')} className="text-accent font-medium hover:underline flex items-center gap-1">Get started <ChevronRight className="h-4 w-4 -ml-0.5" /></button>
                    </p> */}

                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Lock className="h-3.5 w-3.5" />
                        <span className="text-[13px]">Your personal files and data are end-to-end encrypted</span>
                    </div>

                    <a href="#" className="text-xs text-muted-foreground/70 hover:underline mt-2">Terms &amp; Privacy Policy</a>
                </div>
            </div>
        </div>
    );
};

export default Login;
