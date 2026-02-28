"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Users, Mail, CheckCircle, Plus } from 'lucide-react';
import { getOrgUsers, inviteUser } from '@/services/userService';

export default function UserManagementPage() {
    const { user } = useAuth() || {};
    const { t } = useLanguage();
    const [orgUsers, setOrgUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInviting, setIsInviting] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('contributor');
    const [inviteLoading, setInviteLoading] = useState(false);

    useEffect(() => {
        if (user && user.role === 'admin') {
            fetchUsers();
        }
    }, [user]);

    const fetchUsers = async () => {
        try {
            const data = await getOrgUsers();
            setOrgUsers(data || []);
        } catch (e) {
            console.error("Failed to fetch organization users", e);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviteLoading(true);
        try {
            await inviteUser({ email: inviteEmail, role: inviteRole });
            setIsInviting(false);
            setInviteEmail('');
            setInviteRole('contributor');
            fetchUsers();
        } catch (e) {
            console.error("Failed to invite user", e);
        } finally {
            setInviteLoading(false);
        }
    };

    if (user?.role !== 'admin') {
        return (
            <div className="p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground">Unauthorized access.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground">Loading Users...</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center overflow-hidden shrink-0">
                        <Users className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">
                            {t('user_mgmt') || 'User Management'}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Manage your organization's administrators, contributors, and clients.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setIsInviting(!isInviting)}
                    className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    <Plus className="h-4 w-4" /> Invite User
                </button>
            </div>

            {isInviting && (
                <div className="rounded-xl bg-card border border-border p-6 mb-8 shadow-sm">
                    <h3 className="text-lg font-bold text-foreground mb-4">Invite New User</h3>
                    <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Email Address</label>
                            <input
                                required
                                type="email"
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                placeholder="colleague@company.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Role</label>
                            <select
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                                value={inviteRole}
                                onChange={e => setInviteRole(e.target.value)}
                            >
                                <option value="admin">Admin</option>
                                <option value="contributor">Contributor</option>
                                <option value="client">Client</option>
                            </select>
                        </div>
                        <div className="md:col-span-3 flex justify-end gap-3 mt-4">
                            <button
                                type="button"
                                onClick={() => setIsInviting(false)}
                                className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={inviteLoading}
                                className="px-4 py-2 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
                            >
                                {inviteLoading ? 'Sending...' : 'Send Invite'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="rounded-xl bg-card border border-border overflow-hidden shadow-sm">
                <div className="grid grid-cols-12 gap-4 border-b border-border bg-muted/50 p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-3">Name</div>
                    <div className="col-span-4">Email</div>
                    <div className="col-span-2">Joined</div>
                    <div className="col-span-3 text-right">Role</div>
                </div>
                {orgUsers.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                        No users found in your organization.
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {orgUsers.map((orgUser) => (
                            <div key={orgUser.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/20 transition-colors">
                                <div className="col-span-3 flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                                        <span className="text-xs font-bold text-foreground">
                                            {orgUser.name ? orgUser.name.charAt(0).toUpperCase() : '?'}
                                        </span>
                                    </div>
                                    <span className="text-sm font-medium text-foreground">{orgUser.name}</span>
                                </div>
                                <div className="col-span-4 flex items-center gap-2">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">{orgUser.email}</span>
                                </div>
                                <div className="col-span-2 flex items-center">
                                    <span className="text-sm text-muted-foreground">
                                        {orgUser.createdAt ? new Date(orgUser.createdAt).toLocaleDateString() : '-'}
                                    </span>
                                </div>
                                <div className="col-span-3 flex justify-end items-center gap-2">
                                    {orgUser.is_primary && (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2 py-1 text-xs font-medium text-accent border border-accent/20">
                                            <CheckCircle className="h-3 w-3" />
                                            Primary
                                        </span>
                                    )}
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-1 text-xs font-medium text-foreground border border-border uppercase">
                                        {orgUser.role}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
