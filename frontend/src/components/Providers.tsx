"use client";

import { AuthProvider } from '@/contexts/AuthContext';
import { InterfaceProvider } from '@/contexts/InterfaceContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { Toaster } from 'sonner';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <LanguageProvider>
                <InterfaceProvider>
                    {children}
                    <Toaster position="top-right" richColors />
                </InterfaceProvider>
            </LanguageProvider>
        </AuthProvider>
    );
}
