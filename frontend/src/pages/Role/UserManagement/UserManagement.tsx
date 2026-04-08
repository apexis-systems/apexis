"use client";

import { useState, useEffect } from 'react';
import { UserRole } from '@/types';
import {
    UserPlus, Trash2, ToggleLeft, ToggleRight, Loader2, Mail, Phone,
    Briefcase, AlertCircle, Link, Copy, Check, Shield, CheckCircle2, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getOrgUsers, inviteUser, getOnboardingLinks, deleteUser } from '@/services/userService';
import { getProjects } from '@/services/projectService';
import { getApiErrorMessage } from '@/helpers/apiError';

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
    const [selectedProjectIdForLinks, setSelectedProjectIdForLinks] = useState<string>('');
    const [copied, setCopied] = useState<string | null>(null);

    const [deleteUserObj, setDeleteUserObj] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await getOrgUsers();
            const sorted = (data || []).sort((a: any, b: any) => {
                if (a.is_primary && !b.is_primary) return -1;
                if (!a.is_primary && b.is_primary) return 1;

                const priority: any = { admin: 1, contributor: 2, client: 3 };
                const pA = priority[a.role] || 4;
                const pB = priority[b.role] || 4;

                if (pA !== pB) return pA - pB;
                return (a.name || '').localeCompare(b.name || '');
            });
            setUsers(sorted);
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

    useEffect(() => {
        fetchUsers();
        fetchProjects();
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
            toast.error(getApiErrorMessage(error, 'Failed to send invitation'));
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
            toast.error(getApiErrorMessage(error, "Failed to remove user"));
        } finally {
            setDeleting(false);
        }
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

            {/* Public Access Links Section */}
            <div className="mb-8 p-6 rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Project Access Links</h2>
                        <p className="text-xs text-muted-foreground mt-1">Generate direct login links for internal contributors and external clients.</p>
                    </div>
                    <div className="w-full md:w-64">
                        <Select value={selectedProjectIdForLinks} onValueChange={setSelectedProjectIdForLinks}>
                            <SelectTrigger className="mt-1 w-full bg-secondary outline-none border-none shadow-none rounded-xl h-10">
                                <SelectValue placeholder="Select a Project" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {projects.map((proj: any) => (
                                    <SelectItem key={`link-${proj.id}`} value={String(proj.id)}>
                                        <div className="flex items-center gap-2">
                                            {proj.name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {selectedProjectIdForLinks && projects.find(p => String(p.id) === selectedProjectIdForLinks) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="p-5 rounded-xl border border-border bg-background">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-accent/10 rounded-lg">
                                        <Link className="h-4 w-4 text-accent" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-foreground">Contributor Access</h3>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Role: Contributor</p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-lg text-xs"
                                    onClick={() => {
                                        const p = projects.find(it => String(it.id) === selectedProjectIdForLinks);
                                        const deepUrl = `${window.location.origin}/auth/login-redirect?role=contributor&code=${p.contributor_code}`;
                                        copyToClipboard(deepUrl, 'Contributor');
                                    }}
                                >
                                    {copied === 'Contributor' ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                                    {copied === 'Contributor' ? "Copied" : "Copy Link"}
                                </Button>
                            </div>
                        </div>

                        <div className="p-5 rounded-xl border border-border bg-background">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-accent/10 rounded-lg">
                                        <Link className="h-4 w-4 text-accent" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-foreground">Client Access</h3>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Role: Client</p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-lg text-xs"
                                    onClick={() => {
                                        const p = projects.find(it => String(it.id) === selectedProjectIdForLinks);
                                        const deepUrl = `${window.location.origin}/auth/login-redirect?role=client&code=${p.client_code}`;
                                        copyToClipboard(deepUrl, 'Client');
                                    }}
                                >
                                    {copied === 'Client' ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                                    {copied === 'Client' ? "Copied" : "Copy Link"}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 bg-secondary/30 rounded-xl border border-dashed border-border text-center">
                        <Briefcase className="h-8 w-8 text-muted-foreground opacity-30 mb-2" />
                        <p className="text-sm font-bold text-foreground">No Project Selected</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm">Please select a project from the dropdown above to generate direct access links for contributors and clients.</p>
                    </div>
                )}
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
                                                {u.email ? (
                                                    <><Mail className="h-3 w-3" /> {u.email}</>
                                                ) : u.phone_number ? (
                                                    <><Phone className="h-3 w-3" /> {u.phone_number}</>
                                                ) : (
                                                    <span className="italic opacity-50">No contact info</span>
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-foreground">
                                            {u.is_primary && <Shield className="h-3 w-3 text-accent" />}
                                            {u.role}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {(u.email_verified || u.phone_verified) ? (
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 text-green-600 text-[10px] font-bold uppercase w-fit">
                                                <CheckCircle2 className="h-3 w-3" /> Verified
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase w-fit">
                                                <Clock className="h-3 w-3" /> Pending
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-muted-foreground font-medium">
                                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {!u.is_primary && u.id !== user.id && (
                                            <button onClick={() => setDeleteUserObj(u)} className="rounded-lg p-2 hover:bg-destructive/10 transition-colors">
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

            {/* Delete Confirmation */}
            <Dialog open={!!deleteUserObj} onOpenChange={(open) => !open && setDeleteUserObj(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove User?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove <span className="font-bold text-foreground">{deleteUserObj?.name || deleteUserObj?.email || deleteUserObj?.phone_number}</span>? This action cannot be undone.
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

export default UserManagement;
