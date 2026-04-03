"use client";

import { AuthProvider } from '@/contexts/AuthContext';
import { InterfaceProvider } from '@/contexts/InterfaceContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { Toaster } from 'sonner';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <SocketProvider>
                <LanguageProvider>
                    <InterfaceProvider>
                        {children}
                        <Toaster position="top-right" richColors />
                    </InterfaceProvider>
                </LanguageProvider>
            </SocketProvider>
        </AuthProvider>
    );
}
