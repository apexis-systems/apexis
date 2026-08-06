"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Trash2,
  X,
  Loader2,
  Building,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as subscriptionService from "@/services/subscriptionService";

interface ProjectMember {
  project_member_id: number;
  user_id: number;
  role: string;
  name: string;
  email: string;
  phone_number?: string;
  profile_pic?: string;
}

interface ProjectDetail {
  id: number;
  name: string;
  description?: string;
  teamMemberCount: number;
  clientCount: number;
  targetSeats: number;
  exceeded: boolean;
  exceededBy: number;
  members: ProjectMember[];
}

interface ProjectMemberManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSeats: number;
  projects: ProjectDetail[];
  onRefreshValidation: () => Promise<any>;
  onProceed: () => void;
}

export const ProjectMemberManagementModal: React.FC<ProjectMemberManagementModalProps> = ({
  isOpen,
  onClose,
  targetSeats,
  projects,
  onRefreshValidation,
  onProceed,
}) => {
  const [deletingMemberId, setDeletingMemberId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  if (!isOpen) return null;

  // Calculate total contributor memberships across all projects in the organization
  const totalContributors = projects.reduce(
    (sum, p) => sum + p.members.filter((m) => m.role === "contributor").length,
    0
  );
  const isFullyCompliant = totalContributors <= targetSeats;
  const exceededByTotal = Math.max(0, totalContributors - targetSeats);

  const handleDeleteMember = async (projectId: number, userId: number, memberName: string) => {
    setDeletingMemberId(userId);
    try {
      await subscriptionService.removeProjectMember(projectId, userId);
      toast.success(`Removed ${memberName} from project.`);
      setRefreshing(true);
      await onRefreshValidation();
    } catch (error: any) {
      const msg = error.response?.data?.error || "Failed to remove member";
      toast.error(msg);
    } finally {
      setDeletingMemberId(null);
      setRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Manage Contributors ({targetSeats} Seats)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reduce contributor seats across projects to fit your target limit of {targetSeats} seat(s).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Compliance Status Alert Banner */}
        <div className="px-6 py-3 border-b border-border">
          {isFullyCompliant ? (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>Total organization contributors ({totalContributors}) satisfies your target limit of {targetSeats} seat(s)!</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-semibold">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <span>
                Organization has {totalContributors} total contributor(s) across projects. Please remove {exceededByTotal} contributor(s) below to decrease to {targetSeats} seat(s).
              </span>
            </div>
          )}
        </div>

        {refreshing && (
          <div className="px-6 pt-3 flex items-center gap-1.5 text-xs text-orange-500 font-semibold animate-pulse">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Updating...
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {projects.map((project) => {
            const contributorMembers = project.members.filter((m) => m.role === "contributor");
            const contributorCount = contributorMembers.length;

            return (
              <div
                key={project.id}
                className="rounded-2xl border border-border bg-card transition-all"
              >
                {/* Project Header */}
                <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-background border border-border text-foreground">
                      <Building className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{project.name}</h3>
                      {project.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{project.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-orange-500/10 text-orange-600 border border-orange-500/20">
                      {contributorCount} {contributorCount === 1 ? "Contributor" : "Contributors"}
                    </span>
                  </div>
                </div>

                {/* Project Members List (Only Contributors) */}
                <div className="p-4">
                  {contributorMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      No contributors in this project.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {contributorMembers.map((member) => {
                        const isDeleting = deletingMemberId === member.user_id;

                        return (
                          <div
                            key={member.project_member_id}
                            className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-background hover:border-orange-500/30 transition-all"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center font-black text-orange-600 text-xs shrink-0">
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground truncate">{member.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                                    {member.email || member.phone_number || "No contact"}
                                  </span>
                                  <span className="px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded bg-orange-500/10 text-orange-600">
                                    CONTRIBUTOR
                                  </span>
                                </div>
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteMember(project.id, member.user_id, member.name)}
                              disabled={isDeleting}
                              className="h-8 w-8 rounded-lg hover:bg-red-500/10 hover:text-red-600 text-muted-foreground shrink-0 ml-2"
                              title="Remove contributor from project"
                            >
                              {isDeleting ? (
                                <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-red-500" />
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-border bg-muted/30 flex items-center justify-between gap-4">
          <Button variant="outline" onClick={onClose} className="rounded-xl font-bold">
            Cancel
          </Button>

          <Button
            onClick={onProceed}
            disabled={!isFullyCompliant}
            className={`rounded-xl font-bold px-6 h-11 transition-all ${
              isFullyCompliant
                ? "bg-[#FF8A3D] text-white hover:bg-[#FF8A3D]/90 shadow-lg shadow-orange-500/20"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            {isFullyCompliant ? "Proceed to Payment / Upgrade" : `Remove Contributors to Enable Upgrade`}
          </Button>
        </div>
      </div>
    </div>
  );
};
