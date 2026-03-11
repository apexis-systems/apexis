"use client";

import { useState, useEffect } from 'react';
import { UserRole } from '@/types';
import { UserPlus, Trash2, ToggleLeft, ToggleRight, Loader2, Mail, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getOrgUsers, inviteUser } from '@/services/userService';

const UserManagement = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<UserRole>('contributor');
    const [inviting, setInviting] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await getOrgUsers();
            setUsers(data || []);
        } catch (error) {
            console.error("fetchUsers error", error);
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return (
            <div className="p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground">You do not have permission to view this page.</p>
            </div>
        );
    }

    const handleInvite = async () => {
        if (!inviteEmail.trim()) {
            toast.error('Please enter a valid email');
            return;
        }
        setInviting(true);
        try {
            await inviteUser({ email: inviteEmail.trim(), role: inviteRole });
            toast.success('Invitation sent successfully');
            setInviteEmail('');
            setInviteRole('contributor');
            setShowInvite(false);
            fetchUsers();
        } catch (error: any) {
            console.error("Invite Error", error);
            toast.error(error.response?.data?.error || 'Failed to send invitation');
        } finally {
            setInviting(false);
        }
    };

    const toggleActive = (id: string | number) => {
        // Placeholder for real action
        setUsers(prev => prev.map(u => (u.id === id ? { ...u, active: !u.active } : u)));
        toast.success('User status updated');
    };

    const changeRole = (id: string | number, role: UserRole) => {
        // Placeholder for real action
        setUsers(prev => prev.map(u => (u.id === id ? { ...u, role } : u)));
        toast.success(`Role updated to ${role}`);
    };

    const removeUser = (id: string | number) => {
        // Placeholder for real action
        setUsers(prev => prev.filter(u => u.id !== id));
        toast.success('User removed from organization');
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('user_mgmt')}</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage organization members and roles.</p>
                </div>
                <Button
                    onClick={() => setShowInvite(!showInvite)}
                    className={cn(
                        "transition-all",
                        showInvite ? "bg-secondary text-foreground hover:bg-secondary/80" : "bg-accent text-accent-foreground hover:bg-accent/90"
                    )}
                >
                    <UserPlus className="h-4 w-4 mr-2" /> {showInvite ? "Cancel" : "Add Member"}
                </Button>
            </div>

            {showInvite && (
                <div className="mb-8 p-6 rounded-2xl border border-border bg-card shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-end gap-4 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wide">
                                Email Address
                            </label>
                            <Input
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                placeholder="member@example.com"
                                type="email"
                                className="h-11 rounded-xl"
                            />
                        </div>
                        <div className="w-40">
                            <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wide">
                                Role
                            </label>
                            <Select value={inviteRole} onValueChange={v => setInviteRole(v as UserRole)}>
                                <SelectTrigger className="h-11 rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="contributor">Contributor</SelectItem>
                                    <SelectItem value="client">Client</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={handleInvite}
                            disabled={inviting}
                            className="h-11 bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl px-8 font-bold"
                        >
                            {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                            {inviting ? "Inviting..." : "Send Invitation"}
                        </Button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
            ) : (
                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-secondary/30">
                                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Member</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Role</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Joined</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-foreground">{u.name || 'Invited User'}</span>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                <Mail className="h-3 w-3" /> {u.email}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Select value={u.role} onValueChange={val => changeRole(u.id, val as UserRole)}>
                                                <SelectTrigger className="h-8 w-32 text-[10px] font-bold uppercase rounded-lg">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="admin">Admin</SelectItem>
                                                    <SelectItem value="contributor">Contributor</SelectItem>
                                                    <SelectItem value="client">Client</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => toggleActive(u.id)} className="flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-secondary transition-colors">
                                            {u.active !== false
                                                ? <ToggleRight className="h-5 w-5 text-accent" />
                                                : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                                            <span className={cn('text-[10px] font-bold uppercase', u.active !== false ? 'text-accent' : 'text-muted-foreground')}>
                                                {u.active !== false ? 'Active' : 'Inactive'}
                                            </span>
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-muted-foreground">
                                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {!u.is_primary && u.id !== user.id && (
                                            <button onClick={() => removeUser(u.id)} className="rounded-lg p-2 hover:bg-destructive/10 transition-colors">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {users.length === 0 && (
                        <div className="p-12 text-center text-muted-foreground">
                            No users found.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default UserManagement;
