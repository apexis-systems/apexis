"use client";

import { AuthProvider } from '@/contexts/AuthContext';
import { InterfaceProvider } from '@/contexts/InterfaceContext';
import { LanguageProvider } from '@/contexts/LanguageContext';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <LanguageProvider>
                <InterfaceProvider>
                    {children}
                </InterfaceProvider>
            </LanguageProvider>
        </AuthProvider>
    );
}
