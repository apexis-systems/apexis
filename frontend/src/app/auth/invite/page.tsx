"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Smartphone, Download, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InviteLandingPage() {
    const searchParams = useSearchParams();
    const token = searchParams?.get('token');
    const [attempted, setAttempted] = useState(false);

    useEffect(() => {
        if (token && !attempted) {
            // Try to open the app automatically
            const appUrl = `apexis://signup?token=${token}`;
            window.location.href = appUrl;

            // Mark as attempted after a short delay
            const timer = setTimeout(() => {
                setAttempted(true);
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [token, attempted]);

    const handleOpenApp = () => {
        if (token) {
            window.location.href = `apexis://signup?token=${token}`;
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
                <div className="max-w-md">
                    <h1 className="text-xl font-bold text-foreground mb-2">Invalid Invitation</h1>
                    <p className="text-muted-foreground">The invitation link you followed appears to be invalid or expired.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
            {/* App Icon / Logo */}
            <div className="w-24 h-24 bg-accent rounded-3xl flex items-center justify-center mb-8 shadow-lg shadow-accent/20 animate-in fade-in zoom-in duration-500">
                <Smartphone className="w-12 h-12 text-white" />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-3">Welcome to Apexis</h1>
            <p className="text-muted-foreground max-w-sm mb-10">
                We're opening the app for you to complete your account setup.
            </p>

            <div className="space-y-4 w-full max-w-xs animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                {!attempted ? (
                    <div className="flex flex-col items-center gap-3 py-4">
                        <Loader2 className="h-8 w-8 animate-spin text-accent" />
                        <span className="text-sm font-medium text-muted-foreground">Opening Apexis...</span>
                    </div>
                ) : (
                    <>
                        <Button
                            onClick={handleOpenApp}
                            className="w-full h-12 rounded-2xl bg-accent hover:bg-accent/90 text-white font-bold"
                        >
                            <ExternalLink className="w-4 h-4 mr-2" /> Open Apexis
                        </Button>

                        <div className="relative py-4">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Don't have the app?</span></div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <a
                                href="https://apps.apple.com/app/apexis" // Replace with real URL
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-border bg-card hover:bg-secondary transition-colors"
                            >
                                <Download className="w-5 h-5 text-foreground" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">App Store</span>
                            </a>
                            <a
                                href="https://play.google.com/store/apps/details?id=com.apexis.app" // Replace with real URL
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-border bg-card hover:bg-secondary transition-colors"
                            >
                                <Download className="w-5 h-5 text-foreground" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Play Store</span>
                            </a>
                        </div>
                    </>
                )}
            </div>

            <footer className="mt-20 text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                Powered by Apexis.
            </footer>
        </div>
    );
}
