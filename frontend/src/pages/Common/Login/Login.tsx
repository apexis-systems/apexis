"use client";

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getQrSession } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import { QRCodeCanvas } from 'qrcode.react';
import { io, Socket } from 'socket.io-client';
import { QrCode, Lock } from 'lucide-react';
const Login = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const { login } = useAuth();

    const [qrSessionId, setQrSessionId] = useState<string | null>(null);
    const [qrExpired, setQrExpired] = useState(false);
    const [qrRefreshTrigger, setQrRefreshTrigger] = useState(0);

    useEffect(() => {
        let socket: Socket | null = null;
        let expiryTimer: NodeJS.Timeout | null = null;

        generateSessionAndConnect();

        async function generateSessionAndConnect() {
            setIsLoading(true);
            setQrExpired(false);
            setError('');
            try {
                // 1. Fetch exactly one UUID
                const { sessionId } = await getQrSession();
                setQrSessionId(sessionId);

                // 2. Connect to the socket server
                const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5002';
                socket = io(socketUrl);

                socket.on('connect', () => {
                    // 3. Join the room specific to our UUID
                    socket?.emit('join-qr-room', sessionId);
                });

                // 4. Listen for the auth success event
                socket.on('qr-authorized', async (data: { token: string; user?: unknown }) => {
                    if (data?.token) {
                        localStorage.setItem('qrSessionId', sessionId);
                        const user = await login(data.token);
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
            if (expiryTimer) {
                clearTimeout(expiryTimer);
            }
            if (socket) {
                socket.off('connect');
                socket.off('qr-authorized');
                socket.disconnect();
            }
        };
    }, [qrRefreshTrigger, login, router]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 relative overflow-y-auto w-full">

            <div className="w-full max-w-4xl flex flex-col gap-6 items-center">

                <div className="flex flex-col items-center gap-5">
                    <div className="hidden sm:flex h-32 w-32 items-center justify-center">
                        <Image src="/app-icon.png" alt="Apexis Logo" width={112} height={112} className="h-28 w-28 object-contain" />
                    </div>
                    <div className='flex flex-col items-center'>
                        <h1 className="text-4xl tracking-[0.1em] text-primary font-angelica flex items-center gap-1">
                            APEXIS
                            <span className="text-xl mt-3 font-angelica">PRO™</span>
                        </h1>
                        <p className="mt-1 text-sm tracking-[0.25em] text-muted-foreground uppercase">
                            RECORD · REPORT · RELEASE
                        </p>
                    </div>
                </div>


                {/* Main Auth Card */}
                <Card className="w-full border-0 shadow-md rounded-[32px] overflow-hidden bg-card">
                    <CardContent className="p-0">
                        <div className="flex flex-col md:flex-row min-h-[500px]">
                            <div className="flex-1 p-8 sm:p-14 border-b md:border-b-0 md:border-r border-border/40 flex flex-col">
                                <h2 className="text-[28px] font-bold text-foreground mb-10 tracking-tight uppercase text-center md:text-left font-montserrat">Scan to log in</h2>

                                <div className="space-y-8 flex-1">
                                    <div className="flex items-start gap-5">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-sm font-semibold text-foreground mt-0.5">1</div>
                                        <p className="text-[17px] text-foreground leading-snug pt-0.5 font-montserrat">Open the <span className="text-primary inline-flex items-center gap-0.5 bg-primary/5 px-2 py-0.5 rounded-md font-angelica tracking-widest">APEXIS<span className="text-[10px] pt-0.5 font-angelica">PRO™</span></span> mobile app & log in</p>
                                    </div>
                                    <div className="flex items-start gap-5">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-sm font-semibold text-foreground mt-0.5">2</div>
                                        <p className="text-[17px] text-foreground leading-snug pt-0.5">Go to <span className="font-semibold text-foreground">Settings &gt; Linked Devices &gt; Link a Device</span></p>
                                    </div>
                                    <div className="flex items-start gap-5">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-sm font-semibold text-foreground mt-0.5">3</div>
                                        <p className="text-[17px] text-foreground leading-snug pt-0.5">Point your phone to this screen to capture the code</p>
                                    </div>
                                </div>
                            </div>

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
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="bg-white p-1.5 rounded-2xl flex items-center justify-center shadow-sm" style={{ width: 62, height: 62 }}>
                                                    <div className="w-full h-full rounded-xl flex items-center justify-center overflow-hidden">
                                                        <Image src="/app-icon.png" alt="APEXIS PRO" width={52} height={52} className="w-full h-full object-contain" />
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
                    </CardContent>
                </Card>

                {/* Bottom Footnote matching the design */}
                <div className="mt-10 flex flex-col items-center gap-4">
                    {/* <p className="text-[15px] text-muted-foreground flex items-center gap-1.5">
                        Don&apos;t have an <span className="font-angelica uppercase tracking-tight">APEXIS</span> account? <button onClick={() => router.push('/signup')} className="text-accent font-medium hover:underline flex items-center gap-1">Get started <ChevronRight className="h-4 w-4 -ml-0.5" /></button>
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
