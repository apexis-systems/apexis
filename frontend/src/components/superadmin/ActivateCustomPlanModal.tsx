"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, X, Loader2, Users, HardDrive, Calendar, CreditCard, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPendingCustomPlanForOrg, activateCustomPlan } from "@/services/superadminService";
import { toast } from "sonner";

interface ActivateCustomPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: {
    id: number;
    organizationId: number | null;
    name: string;
    company: string;
    email: string;
  } | null;
  onSuccess?: () => void;
  onOpenSendInvoice?: (lead: any) => void;
}

export default function ActivateCustomPlanModal({
  isOpen,
  onClose,
  lead,
  onSuccess,
  onOpenSendInvoice,
}: ActivateCustomPlanModalProps) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [planDetails, setPlanDetails] = useState<any>(null);

  useEffect(() => {
    if (isOpen && lead?.organizationId) {
      setFetching(true);
      setPlanDetails(null);
      getPendingCustomPlanForOrg(lead.organizationId)
        .then((data) => {
          setPlanDetails(data.plan);
        })
        .catch((err) => {
          console.error("Failed to fetch pending plan details:", err);
          toast.error("Failed to load custom plan details.");
        })
        .finally(() => {
          setFetching(false);
        });
    }
  }, [isOpen, lead?.organizationId]);

  if (!isOpen || !lead) return null;

  const handleActivate = async () => {
    if (!lead.organizationId) {
      toast.error("Invalid organization.");
      return;
    }

    setLoading(true);
    try {
      const response = await activateCustomPlan(lead.organizationId);
      toast.success(response.message || `Custom plan activated for ${lead.company || lead.name}!`);
      if (onSuccess) onSuccess();
      onClose();
      if (onOpenSendInvoice) {
        onOpenSendInvoice(lead);
      }
    } catch (error: any) {
      console.error("Failed to activate custom plan:", error);
      toast.error(error?.response?.data?.error || "Failed to activate custom plan.");
    } finally {
      setLoading(false);
    }
  };

  const storageGb = planDetails?.storage_limit_mb
    ? Math.round(planDetails.storage_limit_mb / 1024)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-[hsl(35_15%_85%)] bg-background p-6 shadow-2xl dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_10%_12%)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Activate Custom Plan</h2>
              <p className="text-xs text-muted-foreground">
                Confirm direct payment activation for <span className="font-semibold text-foreground">{lead.company || lead.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        {fetching ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(24_95%_53%)]" />
            <p className="text-xs text-muted-foreground">Loading offer specifications...</p>
          </div>
        ) : !planDetails ? (
          <div className="my-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-center text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="mx-auto mb-2 h-6 w-6" />
            No pending custom plan offer found for this organization.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Customer Info Card */}
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Company / Organization:</span>
                <span className="font-medium text-foreground">{lead.company || "—"}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Admin Contact:</span>
                <span className="font-medium text-foreground">{lead.name} ({lead.email})</span>
              </div>
            </div>

            {/* Plan Breakdown Grid */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="mb-3 flex items-center justify-between border-b border-emerald-500/15 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Plan Specifications to Activate
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Direct Payment
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <div className="text-[11px] text-muted-foreground">Seat Count</div>
                    <div className="font-bold text-foreground">{planDetails.contributor_limit} Contributor Seats</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <div className="text-[11px] text-muted-foreground">Storage Allocation</div>
                    <div className="font-bold text-foreground">{storageGb} GB Cloud Storage</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <div className="text-[11px] text-muted-foreground">Billing Cycle</div>
                    <div className="font-bold capitalize text-foreground">
                      {planDetails.subscription_cycle || "Monthly"} Cycle ({planDetails.duration_days || 30} days)
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <div className="text-[11px] text-muted-foreground">Total Plan Amount</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{Number(planDetails.price).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              </div>

              {planDetails.custom_notes ? (
                <div className="mt-3 border-t border-emerald-500/15 pt-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Notes: </span>
                  {planDetails.custom_notes}
                </div>
              ) : null}
            </div>

            {/* GST-Free and Invoice Notice Alert */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1 leading-relaxed">
                  <p className="font-semibold text-foreground">Activation & Invoice Notice:</p>
                  <p>
                    • <strong>Immediate Access:</strong> The organization will gain immediate access with {planDetails.contributor_limit} seats.
                  </p>
                  <p>
                    • <strong>Invoice Customization:</strong> Invoice will not be auto-sent. You can customize payment details (Bank Transfer / UPI) and send it via the <strong>Send Invoice</strong> button.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleActivate}
                disabled={loading}
                className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Activating Plan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Confirm & Activate Plan
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
