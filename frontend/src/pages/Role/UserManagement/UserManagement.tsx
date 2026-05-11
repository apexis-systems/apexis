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
    const [copied, setCopied] = useState<string | null>(null);

    const [deleteUserObj, setDeleteUserObj] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    // Filters
    const [filterProject, setFilterProject] = useState<string>('all');
    const [filterRole, setFilterRole] = useState<string>('all');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await getOrgUsers('management');
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
            toast.success("Project access removed successfully");
            setDeleteUserObj(null);
            fetchUsers();
        } catch (error: any) {
            toast.error(getApiErrorMessage(error, "Failed to remove project access"));
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

    const filteredUsers = users.filter(u => {
        const matchesRole = filterRole === 'all' || u.role === filterRole;
        
        let matchesProject = true;
        if (filterProject !== 'all') {
            // Admins/Superadmins have access to all projects
            const isGlobalAdmin = u.role === 'admin' || u.role === 'superadmin';
            if (!isGlobalAdmin) {
                matchesProject = u.project_members?.some((pm: any) => String(pm.project_id) === String(filterProject));
            }
        }

        return matchesRole && matchesProject;
    });

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

            {/* Removed Redundant Access Links Section */}

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
            ) : (
                <>
                    {/* Unified Team Management Hub */}
                    <div className="flex flex-col gap-4 mb-8 p-6 rounded-2xl border-2 border-accent/10 bg-card shadow-sm">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-accent/10 rounded-xl">
                                    <Shield className="h-5 w-5 text-accent" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-foreground">Team Management Hub</h2>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Filter & Access Control</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                                <div className="w-full md:w-56">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5 block px-1">Project Access</label>
                                    <Select value={filterProject} onValueChange={setFilterProject}>
                                        <SelectTrigger className="h-10 rounded-xl bg-background border-border hover:border-accent/50 transition-colors">
                                            <SelectValue placeholder="All Projects" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Projects</SelectItem>
                                            {projects.map(p => (
                                                <SelectItem key={`filter-proj-${p.id}`} value={String(p.id)}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-full md:w-44">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5 block px-1">Team Role</label>
                                    <Select value={filterRole} onValueChange={setFilterRole}>
                                        <SelectTrigger className="h-10 rounded-xl bg-background border-border hover:border-accent/50 transition-colors">
                                            <SelectValue placeholder="All Roles" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Roles</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="contributor">Contributor</SelectItem>
                                            <SelectItem value="client">Client</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {(filterProject !== 'all' || filterRole !== 'all') && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => { setFilterProject('all'); setFilterRole('all'); }}
                                        className="h-10 mt-5 text-xs text-muted-foreground hover:text-foreground font-bold"
                                    >
                                        Reset
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Integrated Access Links */}
                        {filterProject !== 'all' && projects.find(p => String(p.id) === filterProject) && (
                            <div className="pt-4 mt-2 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-2">
                                    <Link className="h-3.5 w-3.5 text-accent" />
                                    <span className="text-xs font-bold text-foreground">Project Access Links:</span>
                                </div>
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 flex-1 md:flex-initial rounded-xl text-[11px] font-bold border-accent/20 hover:bg-accent/5"
                                        onClick={() => {
                                            const p = projects.find(it => String(it.id) === filterProject);
                                            const deepUrl = `${window.location.origin}/auth/login-redirect?role=contributor&code=${p.contributor_code}`;
                                            copyToClipboard(deepUrl, 'Contributor');
                                        }}
                                    >
                                        {copied === 'Contributor' ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5 text-accent" />}
                                        {copied === 'Contributor' ? "Copied" : "Copy Contributor Link"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 flex-1 md:flex-initial rounded-xl text-[11px] font-bold border-accent/20 hover:bg-accent/5"
                                        onClick={() => {
                                            const p = projects.find(it => String(it.id) === filterProject);
                                            const deepUrl = `${window.location.origin}/auth/login-redirect?role=client&code=${p.client_code}`;
                                            copyToClipboard(deepUrl, 'Client');
                                        }}
                                    >
                                        {copied === 'Client' ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5 text-accent" />}
                                        {copied === 'Client' ? "Copied" : "Copy Client Link"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

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
                                {filteredUsers.map(u => (
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
                                        <div className="flex flex-col gap-1.5">
                                            {u.role === 'admin' || u.role === 'superadmin' ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-bold uppercase text-accent bg-accent/5 px-2 py-0.5 rounded border border-accent/10 flex items-center gap-1">
                                                        <Shield className="h-2.5 w-2.5" />
                                                        {u.role}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-muted-foreground">
                                                        (All Projects)
                                                    </span>
                                                </div>
                                            ) : (
                                                <>
                                                    {u.project_members && u.project_members.length > 0 ? (
                                                        u.project_members.map((pm: any, idx: number) => (
                                                            <div key={idx} className="flex items-center gap-2">
                                                                <span className="text-[9px] font-bold uppercase text-accent bg-accent/5 px-2 py-0.5 rounded border border-accent/10">
                                                                    {pm.role}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-muted-foreground">
                                                                    {pm.project?.name || 'Project'}
                                                                </span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] font-bold uppercase text-muted-foreground italic">No projects assigned</span>
                                                    )}
                                                </>
                                            )}
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
                                        {!u.is_primary && u.id !== user.id && u.role !== 'admin' && u.role !== 'superadmin' && (
                                            <button onClick={() => setDeleteUserObj(u)} className="rounded-lg p-2 hover:bg-destructive/10 transition-colors">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                        <div className="p-12 text-center text-muted-foreground">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            No users found matching your filters.
                        </div>
                    )}
                </div>
            </>
        )}

            {/* Delete Confirmation */}
            <Dialog open={!!deleteUserObj} onOpenChange={(open) => !open && setDeleteUserObj(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove Project Access?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove <span className="font-bold text-foreground">{deleteUserObj?.name || deleteUserObj?.email || deleteUserObj?.phone_number}</span> from their project access? The user account will stay in the organization.
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
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove Access"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default UserManagement;
