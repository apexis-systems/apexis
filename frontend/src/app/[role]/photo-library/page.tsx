"use client";

import PhotoLibrary from '@/pages/Role/Project/ProjectDetails/PhotoLibrary';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function PhotoLibraryPage() {
    const { user } = useAuth() as any || {};
    const router = useRouter();

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <PhotoLibrary
                user={user}
                onBack={() => router.back()}
            />
        </div>
    );
}
