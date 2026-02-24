"use client";

import { AuthProvider } from '@/contexts/AuthContext';
import { InterfaceProvider } from '@/contexts/InterfaceContext';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <InterfaceProvider>
                {children}
            </InterfaceProvider>
        </AuthProvider>
    );
}
