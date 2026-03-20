"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Users, Mail, Trash2, Loader2, UserPlus, Clock, ShieldCheck, Briefcase, AlertCircle, Link, Copy, Check } from 'lucide-react';
import { getOrgUsers, inviteUser, deleteUser, getOnboardingLinks } from '@/services/userService';
import { getProjects } from '@/services/projectService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const UserManagementPage = () => {
    const { user } = useAuth() || {};
    const { t } = useLanguage();
    const [orgUsers, setOrgUsers] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('contributor');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [inviting, setInviting] = useState(false);
    const [onboardingLinks, setOnboardingLinks] = useState<{ contributor_link: string, client_link: string } | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    const [deleteUserObj, setDeleteUserObj] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await getOrgUsers();

            // Priority sorting
            const sorted = (data || []).sort((a: any, b: any) => {
                if (a.is_primary) return -1;
                if (b.is_primary) return 1;

                const rolePriority: Record<string, number> = {
                    admin: 1,
                    contributor: 2,
                    client: 3
                };

                return (rolePriority[a.role] || 4) - (rolePriority[b.role] || 4);
            });

            setOrgUsers(sorted);
        } catch (e) {
            console.error("Failed to fetch organization users", e);
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
        if (user && (user.role === 'admin' || user.role === 'superadmin')) {
            fetchUsers();
            fetchProjects();
            fetchOnboardingLinks();
        }
    }, [user]);

    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return (
            <div className="p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground">You do not have permission to view this page.</p>
            </div>
        );
    }

    const handleInvite = async () => {
        if (!inviteEmail.trim()) {
            toast.error("Please enter a valid email");
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
                project_id: isProjectRole ? selectedProjectId : undefined,
                projectId: isProjectRole ? selectedProjectId : undefined
            } as any);

            toast.success("Invitation sent successfully");
            setInviteEmail('');
            setInviteRole('contributor');
            setSelectedProjectId('');
            setShowInvite(false);
            fetchUsers();
        } catch (error: any) {
            console.error("Invite Error", error);
            toast.error(error.response?.data?.error || "Failed to send invitation");
        } finally {
            setInviting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteUserObj) return;
        setDeleting(true);
        try {
            await deleteUser(deleteUserObj.id);
            toast.success("User removed successfully");
            setDeleteUserObj(null);
            fetchUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to remove user");
        } finally {
            setDeleting(false);
        }
    };

    const copyToClipboard = (text: string, type: string) => {
        if (!text) return;
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
                    <h1 className="text-2xl font-bold text-foreground">{t('user_mgmt') || 'User Management'}</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage organization members, roles, and project access.</p>
                </div>
                <Button
                    onClick={() => setShowInvite(!showInvite)}
                    className={cn(
                        "transition-all",
                        showInvite ? "bg-secondary text-foreground hover:bg-secondary/80" : "bg-accent text-accent-foreground hover:bg-accent/90"
                    )}
                >
                    <UserPlus className="h-4 w-4 mr-2" /> {showInvite ? "Cancel" : "Invite Member"}
                </Button>
            </div>

            {showInvite && (
                <div className="mb-8 p-6 rounded-2xl border border-border bg-card shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex flex-wrap items-end gap-4">
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
                            <Select value={inviteRole} onValueChange={v => setInviteRole(v as any)}>
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

                        {isProjectRole && (
                            <div className="w-56">
                                <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wide">
                                    Assigned Project
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
                                        <span className="text-[10px] text-muted-foreground font-medium uppercase">No projects</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <Button
                            onClick={handleInvite}
                            disabled={inviting}
                            className="h-11 bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl px-8 font-bold"
                        >
                            {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                            {inviting ? "Sending..." : "Send Invitation"}
                        </Button>
                    </div>
                    {isProjectRole && (
                        <p className="mt-4 text-[10px] text-muted-foreground flex items-center gap-1.5">
                            <Briefcase className="h-3 w-3" /> Note: {inviteRole}s join projects via email access codes.
                        </p>
                    )}
                </div>
            )}

            {/* Public Onboarding Links Section */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6 scale-95 origin-top">
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
                            {orgUsers.map(m => (
                                <tr key={m.id} className="hover:bg-secondary/20 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-foreground">{m.name || 'Invited User'}</span>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                <Mail className="h-3 w-3" /> {m.email}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5">
                                            {m.role === 'admin' && (
                                                <>
                                                    <ShieldCheck className={cn("h-4 w-4", m.is_primary ? "text-accent" : "text-muted-foreground")} />
                                                    <span className="text-xs font-medium uppercase text-muted-foreground">
                                                        {m.is_primary ? 'Primary Admin' : 'Admin'}
                                                    </span>
                                                </>
                                            )}
                                            {(m.role === 'contributor' || m.role === 'client') && (
                                                <span className="text-xs font-medium uppercase text-muted-foreground">
                                                    {m.role}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {m.email_verified ? (
                                            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-green-600 bg-green-500/5 border-green-500/20 text-[10px] py-0 h-5">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-amber-600 bg-amber-500/5 border-amber-500/20 text-[10px] py-0 h-5 flex items-center gap-1">
                                                <Clock className="h-3 w-3" /> Pending
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-muted-foreground">
                                        {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {!m.is_primary && m.id !== user.id && (
                                            <button
                                                onClick={() => setDeleteUserObj(m)}
                                                className="rounded-lg p-2 hover:bg-destructive/10 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {orgUsers.length === 0 && (
                        <div className="p-12 text-center text-muted-foreground">
                            No users found in your organization.
                        </div>
                    )}
                </div>
            )}

            {/* Delete Confirmation */}
            <Dialog open={!!deleteUserObj} onOpenChange={(open) => !open && setDeleteUserObj(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove User?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove <span className="font-bold text-foreground">{deleteUserObj?.email}</span>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setDeleteUserObj(null)} disabled={deleting}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="rounded-xl px-6"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove User"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default UserManagementPage;
