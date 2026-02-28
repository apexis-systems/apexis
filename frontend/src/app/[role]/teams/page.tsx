"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Shield, Mail, CheckCircle } from 'lucide-react';
import { getSuperAdmins } from '@/services/superadminService';

export default function TeamsPage() {
    const { user } = useAuth() || {};
    const { t } = useLanguage();
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && user.role === 'superadmin') {
            fetchTeams();
        }
    }, [user]);

    const fetchTeams = async () => {
        try {
            const data = await getSuperAdmins();
            setTeams(data || []);
        } catch (e) {
            console.error("Failed to fetch teams", e);
        } finally {
            setLoading(false);
        }
    };

    if (user?.role !== 'superadmin') {
        return (
            <div className="p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground">Unauthorized access.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground">Loading Teams...</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center overflow-hidden shrink-0">
                    <Shield className="h-5 w-5 text-accent" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        {t('teams') || 'Super Admin Teams'}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage other Super Admins
                    </p>
                </div>
            </div>

            <div className="rounded-xl bg-card border border-border overflow-hidden">
                <div className="grid grid-cols-12 gap-4 border-b border-border bg-muted/50 p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-4">Name</div>
                    <div className="col-span-4">Email</div>
                    <div className="col-span-2">Joined</div>
                    <div className="col-span-2 text-right">Status</div>
                </div>
                {teams.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                        No team members found.
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {teams.map((teamMember) => (
                            <div key={teamMember.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/20 transition-colors">
                                <div className="col-span-4 flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                                        <span className="text-xs font-bold text-foreground">
                                            {teamMember.name ? teamMember.name.charAt(0).toUpperCase() : '?'}
                                        </span>
                                    </div>
                                    <span className="text-sm font-medium text-foreground">{teamMember.name}</span>
                                </div>
                                <div className="col-span-4 flex items-center gap-2">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">{teamMember.email}</span>
                                </div>
                                <div className="col-span-2 flex items-center">
                                    <span className="text-sm text-muted-foreground">
                                        {teamMember.createdAt ? new Date(teamMember.createdAt).toLocaleDateString() : '-'}
                                    </span>
                                </div>
                                <div className="col-span-2 flex justify-end items-center">
                                    {teamMember.is_primary ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2 py-1 text-xs font-medium text-accent border border-accent/20">
                                            <CheckCircle className="h-3 w-3" />
                                            Primary Admin
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-1 text-xs font-medium text-muted-foreground border border-border">
                                            Admin
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
