"use client";

import React from "react";
import { Mail, Info, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubscriptionNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  planName: string;
  targetSeats: number;
  billingCycle: "monthly" | "annual";
  currentSeats: number;
  currentCycle?: string;
  isUpgrade?: boolean;
  isDowngrade?: boolean;
  isCycleChanged?: boolean;
  planEndDate?: string;
  proratedAmount?: number;
}

export const SubscriptionNoticeModal: React.FC<SubscriptionNoticeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  planName,
  targetSeats,
  billingCycle,
  currentSeats,
  currentCycle = "monthly",
  isUpgrade = false,
  isDowngrade = false,
  isCycleChanged = false,
  planEndDate,
  proratedAmount,
}) => {
  if (!isOpen) return null;

  const formattedEndDate = planEndDate
    ? new Date(planEndDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "the end of your current cycle";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-orange-500/10 text-orange-500 shrink-0">
            <Info className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Subscription Update Notice</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Please review how Razorpay processes plan updates
            </p>
          </div>
        </div>

        {/* Selected Change Summary */}
        <div className="p-4 rounded-2xl bg-muted/50 border border-border/80 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">New Plan Target:</span>
            <span className="font-bold text-foreground">
              {planName} ({targetSeats} Seats · {billingCycle === "annual" ? "Annual" : "Monthly"})
            </span>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Current Status:</span>
            <span>{currentSeats} Seats ({currentCycle})</span>
          </div>
          {isUpgrade && proratedAmount && proratedAmount > 0 ? (
            <div className="pt-2 border-t border-border flex justify-between items-center text-xs font-semibold text-orange-600 dark:text-orange-400">
              <span>Prorated Mid-Cycle Charge:</span>
              <span>₹{proratedAmount.toLocaleString("en-IN")}</span>
            </div>
          ) : null}
        </div>

        {/* Razorpay Email Alert Banner */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
            <Mail className="h-4 w-4 shrink-0" />
            <span>Expected Razorpay Emails</span>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">
            Razorpay will send you <strong>two automated emails</strong>:
          </p>
          <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside pl-1">
            <li>
              <span className="font-medium text-foreground">1. Cancellation Email:</span> Confirms that your previous AutoPay mandate was updated/replaced.
            </li>
            <li>
              <span className="font-medium text-foreground">2. Activation Email:</span> Confirms your new AutoPay mandate for {targetSeats} seats.
            </li>
          </ul>
          <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold pt-1">
            ✨ Don't worry—your active days are safe and won't be lost!
          </p>
        </div>

        {/* Renewal Schedule Note */}
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400">
          <Clock className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            {isUpgrade ? (
              <span>
                Your <strong>new {billingCycle} plan</strong> will automatically renew starting <strong>{formattedEndDate}</strong>.
              </span>
            ) : (
              <span>
                Your updated plan & seat mandate will take effect automatically on <strong>{formattedEndDate}</strong> when your current period completes.
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl px-5 h-11 text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="rounded-xl px-6 h-11 text-xs font-bold bg-[#FF8A3D] text-white hover:bg-[#FF8A3D]/90 gap-2"
          >
            <span>Proceed to Payment</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

      </div>
    </div>
  );
};
