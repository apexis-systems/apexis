"use client";

import { useState } from "react";
import { Sparkles, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCustomPlanOffer } from "@/services/superadminService";
import { toast } from "sonner";

interface CreateCustomPlanModalProps {
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
}

export default function CreateCustomPlanModal({
  isOpen,
  onClose,
  lead,
  onSuccess,
}: CreateCustomPlanModalProps) {
  const [seats, setSeats] = useState("100");
  const [storageGb, setStorageGb] = useState("50");
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [amount, setAmount] = useState("25000");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen || !lead) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!lead.organizationId) {
      toast.error("Selected lead does not have a valid Organization ID.");
      return;
    }

    const seatsNum = Number(seats);
    const storageNum = Number(storageGb);
    const amountNum = Number(amount);

    if (!seatsNum || seatsNum < 1) {
      toast.error("Please enter a valid seat limit.");
      return;
    }
    if (!storageNum || storageNum < 1) {
      toast.error("Please enter a valid storage limit.");
      return;
    }
    if (!amountNum || amountNum < 0) {
      toast.error("Please enter a valid price amount.");
      return;
    }

    setLoading(true);
    try {
      await createCustomPlanOffer({
        organizationId: lead.organizationId,
        seats: seatsNum,
        storageGb: storageNum,
        cycle,
        amount: amountNum,
        notes: notes.trim() || undefined,
      });

      toast.success(`Custom plan offer sent to ${lead.company || lead.name}!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Failed to create custom plan:", error);
      toast.error(error?.response?.data?.error || "Failed to create custom plan offer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-[hsl(35_15%_85%)] bg-background p-6 shadow-2xl dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_10%_12%)]">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(24_95%_53%/0.15)] text-[hsl(24_95%_53%)]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Create Custom Plan</h2>
              <p className="text-xs text-muted-foreground">
                Generate tailored offer for <span className="font-semibold text-foreground">{lead.company || lead.name}</span>
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Seats Limit</label>
              <Input
                type="number"
                min="1"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                placeholder="e.g. 150"
                className="mt-1 h-9 text-sm"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Storage Limit (GB)</label>
              <Input
                type="number"
                min="1"
                value={storageGb}
                onChange={(e) => setStorageGb(e.target.value)}
                placeholder="e.g. 50"
                className="mt-1 h-9 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Autopay Cycle</label>
              <Select value={cycle} onValueChange={(val: "monthly" | "annual") => setCycle(val)}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue placeholder="Cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly Cycle</SelectItem>
                  <SelectItem value="annual">Annual Cycle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Amount per Cycle (₹)</label>
              <Input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 25000"
                className="mt-1 h-9 text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">Offer Description / Custom Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Special enterprise rate including 150 contributor seats and dedicated storage quota."
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
            💡 Sending this plan will deliver an instant in-app & push notification to <span className="font-semibold">{lead.name} ({lead.email})</span> and display an invitation banner on their Subscription & Plans page.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-[hsl(24_95%_53%)] text-white hover:bg-[hsl(24_95%_45%)]" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Send Custom Plan Offer
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
