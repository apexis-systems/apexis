"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { LogOut, Shield, User, Pencil } from 'lucide-react';

const Profile = () => {
    const { user, switchRole, logout } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();

    if (!user) return null;

    const handleLogout = () => {
        logout();
        router.push('/');
    };

    const roles: { value: UserRole; label: string }[] = [
        { value: 'admin', label: 'Admin' },
        { value: 'contributor', label: 'Contributor' },
        { value: 'client', label: 'Client' },
    ];

    const roleBadgeColor: Record<UserRole, string> = {
        admin: 'bg-accent text-accent-foreground',
        superadmin: 'bg-accent text-accent-foreground',
        contributor: 'bg-primary text-primary-foreground',
        client: 'bg-secondary text-secondary-foreground',
    };

    return (
        <div className="p-8 max-w-lg mx-auto">
            <div className="flex flex-col items-center text-center mb-8">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary mb-3">
                    <User className="h-10 w-10 text-primary-foreground" />
                </div>
                <h1 className="text-xl font-bold text-foreground">{user.name}</h1>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${roleBadgeColor[user.role]}`}>
                    <Shield className="h-3 w-3" />
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
            </div>

            <div className="rounded-xl bg-card border border-border p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-bold text-foreground">Switch Demo Role</h2>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {roles.map((role) => (
                        <button
                            key={role.value}
                            onClick={() => switchRole(role.value)}
                            className={`rounded-xl border-2 p-3 text-center text-xs font-semibold transition-all ${user.role === role.value
                                ? 'border-accent bg-accent/10 text-accent'
                                : 'border-border bg-secondary text-muted-foreground'
                                }`}
                        >
                            {role.label}
                        </button>
                    ))}
                </div>
            </div>

            <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full h-11 rounded-xl text-sm text-destructive border-destructive/30 hover:bg-destructive/5"
            >
                <LogOut className="h-4 w-4 mr-2" /> {t('sign_out')}
            </Button>
        </div>
    );
};

export default Profile;
