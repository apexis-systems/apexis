"use client";

import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Loader2, Mail, ShieldCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getApiErrorMessage } from '@/helpers/apiError';
import { getSuperAdmins, inviteSuperAdmin, deleteSuperAdmin } from '@/services/superadminService';
import { cn } from '@/lib/utils';

interface SuperadminMember {
    id: number | string;
    name?: string;
    email: string;
    email_verified?: boolean;
    createdAt?: string;
    is_primary?: boolean;
    isPrimaryAdmin?: boolean;
}

const isPrimarySuperadmin = (member: SuperadminMember) =>
    Boolean(member?.is_primary ?? member?.isPrimaryAdmin);

const Teams = () => {
    const { user } = useAuth();
    const [members, setMembers] = useState<SuperadminMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviting, setInviting] = useState(false);

    const [deleteUser, setDeleteUser] = useState<SuperadminMember | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchTeams = async () => {
        setLoading(true);
        try {
            const data = await getSuperAdmins();
            setMembers(data || []);
        } catch {
            toast.error("Failed to load team members");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeams();
    }, []);

    if (!user || user.role !== 'superadmin') {
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
        setInviting(true);
        try {
            await inviteSuperAdmin(inviteEmail.trim());
            toast.success("Invitation sent successfully");
            setInviteEmail('');
            setShowInvite(false);
            fetchTeams();
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, "Failed to send invitation"));
        } finally {
            setInviting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteUser) return;
        setDeleting(true);
        try {
            await deleteSuperAdmin(deleteUser.id);
            toast.success("Member removed successfully");
            setDeleteUser(null);
            fetchTeams();
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, "Failed to remove member"));
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">SuperAdmin Team</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage superadmin access, invitations, and primary ownership.</p>
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
                    <div className="flex items-end gap-4">
                        <div className="flex-1 max-w-sm">
                            <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wide">
                                Email Address
                            </label>
                            <Input
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                placeholder="admin@example.com"
                                type="email"
                                className="h-11 rounded-xl"
                            />
                        </div>
                        <Button
                            onClick={handleInvite}
                            disabled={inviting}
                            className="h-11 bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl px-8 font-bold"
                        >
                            {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                            {inviting ? "Sending..." : "Send Invitation"}
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
                            {members.map((m) => {
                                const isPrimary = isPrimarySuperadmin(m);

                                return (
                                    <tr key={m.id} className="hover:bg-secondary/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-foreground">{m.name || 'Invited superadmin'}</span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <Mail className="h-3 w-3" /> {m.email}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <ShieldCheck className={cn("h-4 w-4", isPrimary ? "text-accent" : "text-muted-foreground")} />
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium uppercase text-muted-foreground">
                                                        Superadmin
                                                    </span>
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {isPrimary ? 'Primary access' : 'Secondary access'}
                                                    </span>
                                                </div>
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
                                            {!isPrimary && m.id !== user.id && (
                                                <button
                                                    onClick={() => setDeleteUser(m)}
                                                    className="rounded-lg p-2 hover:bg-destructive/10 transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {members.length === 0 && (
                        <div className="p-12 text-center text-muted-foreground">
                            No team members found.
                        </div>
                    )}
                </div>
            )}



            {/* Delete Confirmation */}
            <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove Team Member?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove <span className="font-bold text-foreground">{deleteUser?.email}</span>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setDeleteUser(null)} disabled={deleting}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="rounded-xl px-6"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove Member"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Teams;
