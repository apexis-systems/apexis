"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Smartphone, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppStoreIcon, PlayStoreIcon } from '@/components/ui/store-icons';

const RedirectContent = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const role = searchParams?.get('role');
    const code = searchParams?.get('code');
    const [attempted, setAttempted] = useState(false);

    useEffect(() => {
        if (!role || !code) return;

        if (!attempted) {
            const deepLink = `apexis://login?role=${role}&code=${code}`;
            window.location.href = deepLink;

            const timer = setTimeout(() => {
                setAttempted(true);
            }, 1500);

            return () => clearTimeout(timer);
        }
    }, [role, code, attempted]);

    const handleOpenApp = () => {
        if (role && code) {
            window.location.href = `apexis://login?role=${role}&code=${code}`;
        }
    };

    if (!role || !code) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
                <div className="max-w-md">
                    <h1 className="text-xl font-bold text-foreground mb-2 uppercase font-angelica">Access Link Error</h1>
                    <p className="text-muted-foreground text-sm">This access link is missing required parameters. Please contact your administrator.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
            {/* App Icon / Logo */}
            <div className="w-24 h-24 mb-8 animate-in fade-in zoom-in duration-500">
                <img src="/app-icon.png" alt="Apexis Logo" className="w-full h-full object-contain drop-shadow-md" />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-3 font-angelica uppercase tracking-wider">APEXIS<span className="text-sm lowercase font-angelica">pro™</span></h1>
            <p className="text-muted-foreground max-w-sm mb-10 text-sm">
                We're opening the app for you to access your project.
            </p>

            <div className="space-y-4 w-full max-w-xs animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                {!attempted ? (
                    <div className="flex flex-col items-center gap-3 py-4">
                        <Loader2 className="h-8 w-8 animate-spin text-accent" />
                        <span className="text-sm font-medium text-muted-foreground uppercase tracking-tighter">Connecting to <span className="font-angelica">APEXIS</span>...</span>
                    </div>
                ) : (
                    <>
                        <Button
                            onClick={handleOpenApp}
                            className="w-full h-12 rounded-2xl bg-accent hover:bg-accent/90 text-white font-bold"
                        >
                            <ExternalLink className="w-4 h-4 mr-2" /> Open APEXIS
                        </Button>

                        <div className="relative py-4">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Don't have the app?</span></div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <a
                                href="https://apps.apple.com/in/app/apexis-record-report-release/id6760482687"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-border bg-card hover:bg-secondary/80 transition-all px-2 shadow-sm"
                            >
                                <AppStoreIcon className="w-7 h-7 text-foreground" />
                                <span className="text-[10px] font-bold uppercase tracking-wider mt-1">App Store</span>
                            </a>
                            <a
                                href="https://play.google.com/store/apps/details?id=com.apexis.app"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-border bg-card hover:bg-secondary/80 transition-all px-2 shadow-sm"
                            >
                                <PlayStoreIcon className="w-7 h-7 text-foreground" />
                                <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Play Store</span>
                            </a>
                        </div>
                    </>
                )}
            </div>

            <footer className="mt-20 text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                Powered by <span className="font-angelica uppercase tracking-tighter">APEXIS</span>.
            </footer>
        </div>
    );
};

export default function LoginRedirect() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-accent" />
            </div>
        }>
            <RedirectContent />
        </Suspense>
    );
}
