"use client";

import { useState, useEffect } from 'react';
import { UserRole } from '@/types';
import {
    UserPlus, Trash2, ToggleLeft, ToggleRight, Loader2, Mail,
    Briefcase, AlertCircle, Link, Copy, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getOrgUsers, inviteUser, getOnboardingLinks } from '@/services/userService';
import { getProjects } from '@/services/projectService';

const UserManagement = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [users, setUsers] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<UserRole>('contributor');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [inviting, setInviting] = useState(false);
    const [onboardingLinks, setOnboardingLinks] = useState<{ contributor_link: string, client_link: string } | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

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

    const fetchProjects = async () => {
        try {
            const data = await getProjects();
            setProjects(data.projects || []);
        } catch (error) {
            console.error("fetchProjects error", error);
        }
    };

    const fetchOnboardingLinks = async () => {
        try {
            const data = await getOnboardingLinks();
            setOnboardingLinks(data);
        } catch (error) {
            console.error("fetchOnboardingLinks error", error);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchProjects();
        fetchOnboardingLinks();
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

        const isProjectRole = inviteRole === 'contributor' || inviteRole === 'client';
        if (isProjectRole && !selectedProjectId) {
            toast.error('Please select a project for this role');
            return;
        }

        setInviting(true);
        try {
            await inviteUser({
                email: inviteEmail.trim(),
                role: inviteRole,
                project_id: isProjectRole ? selectedProjectId : undefined
            } as any);

            toast.success('Invitation sent successfully');
            setInviteEmail('');
            setInviteRole('contributor');
            setSelectedProjectId('');
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
        setUsers(prev => prev.map(u => (u.id === id ? { ...u, active: !u.active } : u)));
        toast.success('User status updated');
    };

    const changeRole = (id: string | number, role: UserRole) => {
        setUsers(prev => prev.map(u => (u.id === id ? { ...u, role } : u)));
        toast.success(`Role updated to ${role}`);
    };

    const removeUser = (id: string | number) => {
        setUsers(prev => prev.filter(u => u.id !== id));
        toast.success('User removed from organization');
    };

    const copyToClipboard = (text: string, type: string) => {
        navigator.clipboard.writeText(text);
        setCopied(type);
        toast.success(`${type} link copied to clipboard`);
        setTimeout(() => setCopied(null), 2000);
    };

    const isProjectRole = inviteRole === 'contributor' || inviteRole === 'client';

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
                <div className="mb-8 p-6 rounded-2xl border-2 border-accent/20 bg-card shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        <div className="md:col-span-4">
                            <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wide">
                                Email Address
                            </label>
                            <Input
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                placeholder="member@example.com"
                                type="email"
                                className="h-11 rounded-xl focus-visible:ring-accent"
                            />
                        </div>
                        <div className="md:col-span-3">
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

                        <div className={cn("md:col-span-3 transition-opacity duration-300", isProjectRole ? "opacity-100" : "opacity-0 pointer-events-none")}>
                            <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wide">
                                Assign Project
                            </label>
                            {projects.length > 0 ? (
                                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue placeholder="Choose Project" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projects.map(p => (
                                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="h-11 border border-dashed border-border rounded-xl flex items-center px-3 bg-secondary/20">
                                    <AlertCircle className="h-4 w-4 text-amber-500 mr-2" />
                                    <span className="text-[10px] text-muted-foreground">No projects found</span>
                                </div>
                            )}
                        </div>

                        <div className="md:col-span-2">
                            <Button
                                onClick={handleInvite}
                                disabled={inviting}
                                className="w-full h-11 bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl font-bold shadow-md shadow-accent/20"
                            >
                                {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                                {inviting ? "..." : "Invite"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Public Onboarding Links Section */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent/10 rounded-lg">
                                <Link className="h-5 w-5 text-accent" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Contributor Onboarding</h3>
                                <p className="text-[10px] text-muted-foreground">General link for all contributors</p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-[10px]"
                            onClick={() => onboardingLinks && copyToClipboard(onboardingLinks.contributor_link, 'Contributor')}
                        >
                            {copied === 'Contributor' ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                            {copied === 'Contributor' ? "Copied" : "Copy Link"}
                        </Button>
                    </div>
                </div>

                <div className="p-6 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent/10 rounded-lg">
                                <Link className="h-5 w-5 text-accent" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Client Onboarding</h3>
                                <p className="text-[10px] text-muted-foreground">General link for all clients</p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-[10px]"
                            onClick={() => onboardingLinks && copyToClipboard(onboardingLinks.client_link, 'Client')}
                        >
                            {copied === 'Client' ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                            {copied === 'Client' ? "Copied" : "Copy Link"}
                        </Button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
            ) : (
                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border bg-secondary/30">
                                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Member</th>
                                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Role</th>
                                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Joined</th>
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
                                    </td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => toggleActive(u.id)} className="flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-secondary transition-colors text-[10px] font-bold uppercase">
                                            {u.active !== false
                                                ? <><ToggleRight className="h-5 w-5 text-accent" /> <span className="text-accent">Active</span></>
                                                : <><ToggleLeft className="h-5 w-5 text-muted-foreground" /> <span className="text-muted-foreground">Inactive</span></>}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-muted-foreground font-medium">
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
                            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            No users found in your organization.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default UserManagement;
