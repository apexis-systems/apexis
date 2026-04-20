"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  Loader2,
  Mail,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { getApiErrorMessage } from "@/helpers/apiError";
import {
  deleteSuperAdmin,
  getSuperAdmins,
  inviteSuperAdmin,
} from "@/services/superadminService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SuperadminMember {
  id: number | string;
  name?: string;
  email: string;
  email_verified?: boolean;
  createdAt?: string;
  is_primary?: boolean;
  isPrimaryAdmin?: boolean;
}

const cardClass =
  "rounded border border-[hsl(35_15%_85%)] bg-[hsl(39_30%_97%)] shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_8%_14%)]";
const mutedTextClass =
  "text-[hsl(30_8%_45%)] dark:text-[hsl(38_10%_55%)]";
const strongTextClass =
  "text-[hsl(30_10%_15%)] dark:text-[hsl(38_20%_90%)]";
const tableHeadClass =
  "border-b border-[hsl(35_15%_85%)] px-4 py-3 text-left text-xs font-semibold dark:border-[hsl(30_8%_22%)]";
const tableCellClass =
  "border-b border-[hsl(35_15%_85%/0.6)] px-4 py-3 text-xs dark:border-[hsl(30_8%_22%/0.6)]";

const isPrimarySuperadmin = (member: SuperadminMember) =>
  Boolean(member.is_primary ?? member.isPrimaryAdmin);

const Pill = ({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
      className,
    )}>
    {children}
  </span>
);

export default function SuperadminTeams() {
  const { user } = useAuth();
  const [members, setMembers] = useState<SuperadminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [deleteUser, setDeleteUser] = useState<SuperadminMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSuperAdmins();
      setMembers(data || []);
    } catch {
      toast.error("Failed to load team members");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const stats = useMemo(() => {
    const primary = members.filter(isPrimarySuperadmin).length;
    const pending = members.filter((member) => !member.email_verified).length;

    return {
      total: members.length,
      primary,
      secondary: Math.max(members.length - primary, 0),
      pending,
    };
  }, [members]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Please enter a valid email");
      return;
    }

    setInviting(true);
    try {
      await inviteSuperAdmin(inviteEmail.trim());
      toast.success("Invitation sent successfully");
      setInviteEmail("");
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
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-xl font-bold", strongTextClass)}>
            Admin Team
          </h1>
          <p className={cn("mt-0.5 text-xs", mutedTextClass)}>
            Manage admin access and invitations.
          </p>
        </div>

        <Button
          onClick={() => setShowInvite((prev) => !prev)}
          className={cn(
            "h-10 rounded border border-[hsl(24_95%_53%/0.18)] bg-[hsl(24_95%_53%)] px-4 text-white shadow-none hover:bg-[hsl(24_95%_53%/0.9)]",
            showInvite &&
              "border-[hsl(35_15%_85%)] bg-[hsl(39_30%_97%)] text-[hsl(30_10%_15%)] hover:bg-[hsl(37_18%_91%)] dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_8%_14%)] dark:text-[hsl(38_20%_90%)] dark:hover:bg-[hsl(30_6%_18%)]",
          )}>
          <UserPlus className="mr-2 h-4 w-4" />
          {showInvite ? "Cancel" : "Invite Member"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Total Admins",
            value: stats.total,
            icon: Users,
            accent: "bg-[hsl(24_95%_53%/0.1)] text-[hsl(24_95%_53%)]",
          },
          {
            title: "Super Admin",
            value: stats.primary,
            icon: ShieldCheck,
            accent: "bg-sky-500/10 text-sky-500",
          },
          {
            title: "Admins",
            value: stats.secondary,
            icon: ShieldCheck,
            accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          },
          {
            title: "Pending Invites",
            value: stats.pending,
            icon: Clock,
            accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          },
        ].map((item) => (
          <div key={item.title} className={cn(cardClass, "p-4")}>
            <div className="mb-2 flex items-center gap-2">
              <div className={cn("flex h-7 w-7 items-center justify-center rounded", item.accent)}>
                <item.icon className="h-3.5 w-3.5" />
              </div>
              <span className={cn("text-xs font-medium uppercase tracking-wide", mutedTextClass)}>
                {item.title}
              </span>
            </div>
            <div className={cn("text-2xl font-bold", strongTextClass)}>{item.value}</div>
          </div>
        ))}
      </div>

      {showInvite && (
        <div className={cn(cardClass, "p-5")}>
          <div className="mb-4">
            <h2 className={cn("text-sm font-semibold", strongTextClass)}>
              Invite another admin
            </h2>
            <p className={cn("mt-1 text-xs", mutedTextClass)}>
              The primary owner is shown as Super Admin. Everyone else is shown
              as Admin.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="w-full max-w-md">
              <label className={cn("mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em]", mutedTextClass)}>
                Email Address
              </label>
              <Input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="admin@example.com"
                type="email"
                className="h-10 rounded border-[hsl(35_15%_85%)] bg-transparent dark:border-[hsl(30_8%_22%)]"
              />
            </div>

            <Button
              onClick={handleInvite}
              disabled={inviting}
              className="h-10 rounded bg-[hsl(24_95%_53%)] px-6 text-white hover:bg-[hsl(24_95%_53%/0.9)]">
              {inviting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {inviting ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </div>
      )}

      <div className={cn(cardClass, "overflow-hidden")}>
        <div className="flex items-center justify-between border-b border-[hsl(35_15%_85%)] px-5 py-4 dark:border-[hsl(30_8%_22%)]">
          <div>
            <h2 className={cn("text-sm font-semibold", strongTextClass)}>
              Active admin roster
            </h2>
            <p className={cn("mt-1 text-xs", mutedTextClass)}>
              The primary owner is shown as Super Admin. Everyone else is shown
              as Admin.
            </p>
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-[hsl(24_95%_53%)]" />}
        </div>

        {loading ? (
          <div className="flex items-center justify-center px-5 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[hsl(24_95%_53%)]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[hsl(37_18%_91%/0.45)] dark:bg-[hsl(30_6%_18%/0.9)]">
                <tr>
                  <th className={tableHeadClass}>Member</th>
                  <th className={tableHeadClass}>Role</th>
                  <th className={tableHeadClass}>Status</th>
                  <th className={tableHeadClass}>Joined</th>
                  <th className={tableHeadClass}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isPrimary = isPrimarySuperadmin(member);

                  return (
                    <tr key={member.id}>
                      <td className={tableCellClass}>
                        <div>
                          <div className={cn("text-sm font-medium", strongTextClass)}>
                            {member.name || "Invited admin"}
                          </div>
                          <div className={cn("mt-1 flex items-center gap-1 text-xs", mutedTextClass)}>
                            <Mail className="h-3 w-3" />
                            <span>{member.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className={tableCellClass}>
                        <div className="flex items-center gap-2">
                          <ShieldCheck
                            className={cn(
                              "h-4 w-4",
                              isPrimary
                                ? "text-[hsl(24_95%_53%)]"
                                : "text-emerald-600 dark:text-emerald-400",
                            )}
                          />
                          <span className={cn("text-xs font-semibold uppercase tracking-[0.18em]", strongTextClass)}>
                            {isPrimary ? "Super Admin" : "Admin"}
                          </span>
                        </div>
                      </td>
                      <td className={tableCellClass}>
                        {member.email_verified ? (
                          <Pill className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            Active
                          </Pill>
                        ) : (
                          <Pill className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            Pending
                          </Pill>
                        )}
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {member.createdAt
                          ? new Date(member.createdAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className={tableCellClass}>
                        {!isPrimary && member.id !== user?.id ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteUser(member)}
                            className="h-8 w-8 text-red-500 hover:bg-red-500/10 hover:text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className={cn("text-[11px]", mutedTextClass)}>Protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {members.length === 0 && (
              <div className={cn("px-5 py-12 text-center text-sm", mutedTextClass)}>
                No team members found.
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <DialogContent className="border-[hsl(35_15%_85%)] bg-[hsl(39_30%_97%)] dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_8%_14%)]">
          <DialogHeader>
            <DialogTitle className={strongTextClass}>Remove Team Member?</DialogTitle>
            <DialogDescription className={mutedTextClass}>
              Are you sure you want to remove{" "}
              <span className={cn("font-bold", strongTextClass)}>
                {deleteUser?.email}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteUser(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
