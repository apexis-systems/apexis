"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Check,
  Clock,
  CreditCard,
  History,
  LayoutGrid,
  Users,
  AlertCircle,
  FileText,
  Download,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useUsage } from "@/contexts/UsageContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import * as subscriptionService from "@/services/subscriptionService";
import { getMe } from "@/services/authService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatFileSize } from "@/lib/format";
import { ProjectMemberManagementModal } from "@/components/subscription/ProjectMemberManagementModal";
import { SubscriptionNoticeModal } from "@/components/subscription/SubscriptionNoticeModal";

const plans = [
  {
    name: "Starter",
    key: "starter",
    subtitle: "Pay Per Seat Subscription",
    projectLimit: "Unlimited Projects",
    isSubscription: true,
    recommended: true,
    buttonText: "Buy Plan",
    features: [
      "Unlimited Projects",
      "5GB Storage Per Project",
      "1 to 100 Seats Choice",
      "Full Role & Permission Access",
      "Snag List & Inspection Workflow",
      "Drawings Release to Site",
      "Multilingual Support (English, Hindi, Telugu)",
      "Handover & PDF Export Reports",
    ],
  },
  {
    name: "Enterprise",
    key: "enterprise",
    subtitle: "Custom Pricing (>100 Seats)",
    projectLimit: "100+ Seats / Custom Storage",
    recommended: false,
    buttonText: "Contact Support",
    features: [
      "Above 100 Seats Custom Quota",
      "Unlimited Projects",
      "Custom Cloud Storage Quota",
      "Dedicated Account Manager & Support",
      "Custom Workflow & Integrations",
      "Snag List & Inspection Workflow",
      "Drawings Release to Site",
      "Multilingual Support",
    ],
  },
];

const Billing = () => {
  const { user, setUser } = useAuth();
  const { t } = useLanguage();
  const { usageData, refreshUsage } = useUsage();
  const [loading, setLoading] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [selectedSeats, setSelectedSeats] = useState<number>(5);
  const [cancellingAutoPay, setCancellingAutoPay] = useState(false);

  // Member management modal state
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [validationProjects, setValidationProjects] = useState<any[]>([]);
  const [pendingPlan, setPendingPlan] = useState<any | null>(null);

  // Subscription change notice modal state
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [pendingNoticePlan, setPendingNoticePlan] = useState<any | null>(null);

  // Custom Plan Offer state
  const [pendingCustomPlan, setPendingCustomPlan] = useState<any | null>(null);
  const [customPlanLoading, setCustomPlanLoading] = useState(false);

  useEffect(() => {
    if (user && (user.role === "admin" || user.role === "superadmin")) {
      loadTransactions();
      loadCustomPlanOffer();
    }
  }, [user]);

  const loadCustomPlanOffer = async () => {
    try {
      const res = await subscriptionService.getPendingCustomPlan();
      if (res?.hasPendingOffer && res?.plan) {
        setPendingCustomPlan(res.plan);
      } else {
        setPendingCustomPlan(null);
      }
    } catch (err) {
      console.error("Failed to load pending custom plan offer", err);
    }
  };

  const handleAcceptCustomPlan = async () => {
    setCustomPlanLoading(true);
    try {
      const res = await subscriptionService.createCustomPlanOrder();
      const isScriptLoaded = await loadRazorpayScript();
      if (!isScriptLoaded) {
        toast.error("Razorpay SDK failed to load. Check your network connection.");
        setCustomPlanLoading(false);
        return;
      }

      const options: any = {
        key: res.keyId,
        name: "Apexis",
        description: "Accept Custom Enterprise Plan",
        handler: async (response: any) => {
          try {
            await subscriptionService.acceptCustomPlan({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_subscription_id: response.razorpay_subscription_id || res.subscriptionId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success("🎉 Custom Plan activated successfully!");
            setPendingCustomPlan(null);
            await refreshUsage();
            loadTransactions();
            const refreshed = await getMe();
            if (refreshed?.user) {
              setUser({
                ...refreshed.user,
                organization: refreshed.organization,
                project_id: refreshed.project_id,
              });
            }
          } catch (err: any) {
            toast.error("Failed to complete custom plan activation");
          } finally {
            setCustomPlanLoading(false);
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
        },
        modal: {
          ondismiss: () => setCustomPlanLoading(false),
        },
        theme: {
          color: "#f97316",
        },
      };

      if (res.is_subscription && res.subscriptionId) {
        options.subscription_id = res.subscriptionId;
      } else {
        options.order_id = res.orderId;
        options.amount = res.amountInPaise;
        options.currency = res.currency;
      }

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        toast.error(`Payment failed: ${response?.error?.description || ""}`);
        setCustomPlanLoading(false);
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to initiate custom plan order");
      setCustomPlanLoading(false);
    }
  };

  const handleDeclineCustomPlan = async () => {
    try {
      await subscriptionService.declineCustomPlan();
      toast.info("Custom Plan offer declined.");
      setPendingCustomPlan(null);
    } catch (err) {
      toast.error("Failed to decline offer");
    }
  };

  const loadTransactions = async () => {
    try {
      const data = await subscriptionService.getTransactions();
      setTransactions(data);
    } catch (error) {
      console.error("Failed to load transactions", error);
    }
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src =
        process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_URL ||
        "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const unitPrice = billingCycle === "annual" ? 99 : 159;

  const currentPlanName = usageData?.plan?.name || usageData?.usage?.plan_name || user?.organization?.plan_name || "";
  const isPaidPlan = Boolean(currentPlanName && !["freemium", "free"].includes(currentPlanName.toLowerCase()));
  const activeSeats = usageData?.plan?.seats_purchased || usageData?.usage?.seats_purchased || 1;
  const remainingDays = Math.max(1, usageData?.plan?.daysRemaining || 30);
  const isPlanActive = isPaidPlan && (usageData?.plan?.daysRemaining || 0) > 0;
  const isAutoPayActive = usageData?.plan?.auto_pay_enabled || false;

  const handleSeatChange = (delta: number) => {
    setSelectedSeats((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (next > 100) {
        toast.info("For more than 100 seats, please contact support@apexis.in for custom pricing.");
        return 100;
      }
      return next;
    });
  };

  const handleDirectSeatInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1) {
      setSelectedSeats(1);
    } else if (val > 100) {
      setSelectedSeats(100);
      toast.info("For more than 100 seats, please contact support@apexis.in for custom pricing.");
    } else {
      setSelectedSeats(val);
    }
  };

  const handleRefreshValidation = async () => {
    try {
      const res = await subscriptionService.validateSeatChange(selectedSeats);
      setValidationProjects(res.projects || []);
      return res;
    } catch (error) {
      console.error("Error refreshing seat validation", error);
    }
  };

  const handleCancelAutoPay = async () => {
    if (!window.confirm("Are you sure you want to cancel Razorpay AutoPay? Your plan will remain active until the end of the current billing cycle, but will not automatically renew.")) {
      return;
    }

    setCancellingAutoPay(true);
    try {
      const res = await subscriptionService.cancelAutoPay();
      if (res.success) {
        toast.success(res.message || "AutoPay cancelled successfully.");
        await refreshUsage();
        loadTransactions();
      } else {
        toast.error(res.error || "Failed to cancel AutoPay");
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to cancel AutoPay");
    } finally {
      setCancellingAutoPay(false);
    }
  };

  const executeCheckout = async (plan: any) => {
    setLoading(plan.key);
    try {
      const isScriptLoaded = await loadRazorpayScript();
      if (!isScriptLoaded) {
        toast.error(t('payment_sdk_error') || "Payment gateway failed to load");
        setLoading(null);
        return;
      }

      const isUpgrade = isPlanActive && selectedSeats > activeSeats;
      let totalAmount = 0;
      if (isUpgrade) {
        const addedSeats = selectedSeats - activeSeats;
        const fullCycleCost = billingCycle === "annual" ? addedSeats * 99 * 12 : addedSeats * 159;
        const dailyRatePerSeat = billingCycle === "annual" ? (99 * 12) / 365 : 159 / 30;
        const proratedCost = Math.round(addedSeats * dailyRatePerSeat * remainingDays);
        totalAmount = Math.max(1, Math.min(fullCycleCost, proratedCost));
      } else {
        totalAmount = billingCycle === "annual" ? selectedSeats * 99 * 12 : selectedSeats * 159;
      }

      const orderData = await subscriptionService.createOrder({
        amount: totalAmount,
        currency: "INR",
        plan_name: plan.name,
        plan_cycle: plan.key === "onetime" ? "monthly" : billingCycle,
        seats: selectedSeats,
      });

      if (orderData?.is_downgrade && !orderData?.is_subscription) {
        toast.success(orderData.message || `Seats updated to ${selectedSeats} seats.`);
        loadTransactions();
        await refreshUsage();
        try {
          const refreshed = await getMe();
          if (refreshed?.user) {
            setUser({
              ...refreshed.user,
              organization: refreshed.organization,
              project_id: refreshed.project_id,
            });
          }
        } catch (refreshError) {
          console.error("Failed to refresh user after seat update:", refreshError);
        }
        setLoading(null);
        return;
      }

      const appIconUrl = `${window.location.origin}/app-icon.png`;

      // Razorpay Checkout Options: Support both Subscription flow and Order flow
      let options: any = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        image: appIconUrl,
        name: "Apexis",
        description: `${plan.name} (${selectedSeats} Seats · ${billingCycle})`,
        handler: async (response: any) => {
          try {
            await subscriptionService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_subscription_id: response.razorpay_subscription_id || orderData.subscriptionId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_name: plan.name,
              plan_cycle: plan.key === "onetime" ? "monthly" : billingCycle,
            });
            toast.success(t('payment_success') || "Payment successful! AutoPay active.");
            loadTransactions();
            await refreshUsage();
            try {
              const refreshed = await getMe();
              if (refreshed?.user) {
                setUser({
                  ...refreshed.user,
                  organization: refreshed.organization,
                  project_id: refreshed.project_id,
                });
              }
            } catch (refreshError) {
              console.error("Failed to refresh user after payment:", refreshError);
            }
          } catch (error) {
            toast.error(t('payment_verification_failed') || "Payment verification failed.");
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
        },
        theme: {
          color: "#0F172A",
        },
      };

      if (orderData.is_subscription) {
        // AutoPay Subscription mandate flow
        options.subscription_id = orderData.subscriptionId;
      } else if (orderData.order) {
        // Mid-cycle prorated upgrade order flow
        options.order_id = orderData.order.id;
        options.amount = orderData.order.amount;
        options.currency = orderData.order.currency;
      } else {
        throw new Error("Invalid payment order/subscription response from server.");
      }

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        const message = response?.error?.description || t('payment_failed');
        toast.error(`${t('payment_failed')}: ${message}`);
      });
      rzp.open();
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(
        error.response?.data?.message || t('payment_error') || "Payment initiation failed",
      );
    } finally {
      setLoading(null);
    }
  };

  const handlePayment = async (plan: any) => {
    if (plan.key === "enterprise") {
      window.location.href =
        "mailto:support@apexis.in?subject=Enterprise Plan Inquiry (>100 Seats)";
      return;
    }

    setLoading(plan.key);
    try {
      const validation = await subscriptionService.validateSeatChange(selectedSeats);
      if (!validation.valid) {
        setValidationProjects(validation.projects || []);
        setPendingPlan(plan);
        setIsMemberModalOpen(true);
        setLoading(null);
        return;
      }

      // If user has an active plan and is changing seats or cycle, show Notice Modal first
      const activeCycle = usageData?.plan?.subscription_cycle || user?.organization?.subscription_cycle || "monthly";
      const isCycleChanged = activeCycle !== billingCycle;
      const isSeatChanged = selectedSeats !== activeSeats;

      if (isPlanActive && (isCycleChanged || isSeatChanged)) {
        setPendingNoticePlan(plan);
        setIsNoticeModalOpen(true);
        setLoading(null);
        return;
      }

      await executeCheckout(plan);
    } catch (error) {
      console.error("Pre-checkout seat validation error", error);
      setLoading(null);
    }
  };

  const handleDownloadInvoice = async (tx: any) => {
    setDownloadingId(tx.id);
    try {
      await subscriptionService.downloadInvoice(tx.id, `Invoice_${tx.invoice_number || tx.id}.pdf`);
    } catch (error) {
      toast.error("Failed to download invoice");
    } finally {
      setDownloadingId(null);
    }
  };

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">
          {t('no_permission')}
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black text-foreground tracking-tight">{t("billing")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('billing_subtitle')} & Razorpay AutoPay Subscription Management
        </p>
      </div>

      {/* Seat Selection & Cycle Bar */}
      <div className="bg-card border border-border rounded-3xl p-6 mb-10 max-w-3xl mx-auto shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block mb-2">
            Team Seats Count (1 - 100)
          </label>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl border-orange-300 hover:bg-orange-100"
              onClick={() => handleSeatChange(-1)}
              disabled={selectedSeats <= 1}
            >
              <Minus className="h-4 w-4 text-orange-600" />
            </Button>
            <input
              type="number"
              min={1}
              max={100}
              value={selectedSeats}
              onChange={handleDirectSeatInput}
              className="w-20 h-9 rounded-xl border border-orange-300 text-center font-black text-lg bg-background focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl border-orange-300 hover:bg-orange-100"
              onClick={() => handleSeatChange(1)}
              disabled={selectedSeats >= 100}
            >
              <Plus className="h-4 w-4 text-orange-600" />
            </Button>
            <span className="text-xs text-muted-foreground font-medium ml-2">
              Seats
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={cn("text-sm font-semibold transition-colors", billingCycle === "monthly" ? "text-foreground font-bold" : "text-muted-foreground")}>{t('monthly')} (₹159/seat)</span>
          <button
            onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
            className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background bg-[#FF8A3D]"
          >
            <span className={cn(
              "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
              billingCycle === "annual" ? "translate-x-6" : "translate-x-1"
            )} />
          </button>
          <span className={cn("text-sm font-semibold transition-colors", billingCycle === "annual" ? "text-foreground font-bold" : "text-muted-foreground")}>
            {t('annual')} <span className="text-orange-500 font-extrabold text-xs">(₹99/seat)</span>
          </span>
        </div>
      </div>

      <Tabs defaultValue="plans" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[450px] mx-auto mb-10 text-foreground">
          <TabsTrigger value="plans" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t('plans_tab')}
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            {t('usage_tab')}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {t('history_tab')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          {pendingCustomPlan ? (
            <div className="mb-8 rounded-2xl border-2 border-orange-500/30 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 p-6 shadow-lg backdrop-blur dark:border-orange-500/40">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                    <span>🎉 Exclusive Custom Plan Invitation</span>
                  </div>
                  <h3 className="text-xl font-black text-foreground">
                    Tailored Enterprise Offer for Your Organization
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Superadmin has generated a special custom plan offer for your team. Review details below and accept to activate auto-renewal.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-4 pt-1 text-xs font-semibold text-foreground">
                    <div className="rounded-lg border border-orange-500/20 bg-background/80 px-3 py-2">
                      Seats: <span className="text-base font-black text-orange-600 dark:text-orange-400">{pendingCustomPlan.contributor_limit} Contributor Seats</span>
                    </div>
                    <div className="rounded-lg border border-orange-500/20 bg-background/80 px-3 py-2">
                      Storage: <span className="text-base font-black text-orange-600 dark:text-orange-400">{Math.round(pendingCustomPlan.storage_limit_mb / 1024)} GB Storage</span>
                    </div>
                    <div className="rounded-lg border border-orange-500/20 bg-background/80 px-3 py-2">
                      Cycle: <span className="text-base font-black capitalize text-orange-600 dark:text-orange-400">{pendingCustomPlan.subscription_cycle || "monthly"}</span>
                    </div>
                    <div className="rounded-lg border border-orange-500/20 bg-background/80 px-3 py-2">
                      Amount: <span className="text-base font-black text-emerald-600 dark:text-emerald-400">₹{Number(pendingCustomPlan.price).toLocaleString("en-IN")} / cycle</span>
                    </div>
                  </div>

                  {pendingCustomPlan.custom_notes ? (
                    <div className="mt-2 text-xs italic text-muted-foreground">
                      Note from Admin: "{pendingCustomPlan.custom_notes}"
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 shrink-0 sm:flex-row md:flex-col">
                  <Button
                    onClick={handleAcceptCustomPlan}
                    disabled={customPlanLoading}
                    className="h-11 px-6 font-bold bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md hover:from-orange-600 hover:to-amber-700"
                  >
                    {customPlanLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Accept & Activate AutoPay (₹{Number(pendingCustomPlan.price).toLocaleString("en-IN")})
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeclineCustomPlan}
                    disabled={customPlanLoading}
                    className="h-9 text-xs text-muted-foreground hover:text-destructive"
                  >
                    Decline Offer
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan) => {
              const isAnnual = billingCycle === "annual" && plan.key !== "enterprise";
              const totalBilled = plan.key === "enterprise"
                ? 0
                : isAnnual
                  ? selectedSeats * 99 * 12
                  : selectedSeats * 159;

              return (
                <div
                  key={plan.key}
                  className={cn(
                    "relative rounded-3xl border p-6 flex flex-col transition-all duration-300 hover:shadow-xl",
                    plan.recommended
                      ? "border-orange-500 bg-orange-50/10 shadow-lg scale-105 z-10"
                      : "border-border bg-card",
                  )}>
                  {plan.recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-black px-4 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                        {t('most_popular')}
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-foreground mb-1">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      {t(plan.subtitle)}
                    </p>

                    <div className="inline-block px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 font-bold text-[11px] mb-3">
                      {plan.projectLimit}
                    </div>

                    <div className="flex flex-col items-center justify-center gap-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-foreground">
                          {plan.key === "enterprise" ? t('price_custom') : `₹${unitPrice}`}
                        </span>
                        {plan.key !== "enterprise" && (
                          <span className="text-xs text-muted-foreground">
                            /seat/mo
                          </span>
                        )}
                      </div>
                      {plan.key !== "enterprise" && (() => {
                        const isUpgrade = isPlanActive && selectedSeats > activeSeats;
                        const addedSeats = selectedSeats - activeSeats;
                        const fullCycleCost = billingCycle === "annual" ? addedSeats * 99 * 12 : addedSeats * 159;
                        const dailyRatePerSeat = billingCycle === "annual" ? (99 * 12) / 365 : 159 / 30;
                        const proratedCost = Math.round(addedSeats * dailyRatePerSeat * remainingDays);
                        const proratedTotal = Math.max(1, Math.min(fullCycleCost, proratedCost));
                        return (
                          <p className="text-[11px] text-orange-600 font-bold mt-1">
                            {isUpgrade
                              ? `Prorated Upgrade (+${addedSeats} seat${addedSeats > 1 ? 's' : ''}, ${remainingDays}d remaining): ₹${proratedTotal.toLocaleString("en-IN")}`
                              : `AutoPay Billing (${selectedSeats} seats): ₹${totalBilled.toLocaleString("en-IN")}`}
                          </p>
                        );
                      })()}
                    </div>
                  </div>

                  <ul className="space-y-3.5 flex-1 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <Check className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
                        <span className="text-foreground/80 leading-relaxed">
                          {t(feature) || feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {(() => {
                    const currentPlanName =
                      usageData?.plan?.name || user?.organization?.plan_name;
                    const activeCycle = usageData?.plan?.subscription_cycle || user?.organization?.subscription_cycle || "monthly";

                    const isCurrentPlanName = currentPlanName === plan.name;
                    const isSameCycle = activeCycle === billingCycle;
                    const isSameSeats = selectedSeats === activeSeats;
                    const isCurrentPlan = isCurrentPlanName && isSameCycle && isSameSeats;

                    const isCycleChanged = isPlanActive && !isSameCycle;
                    const isUpgrade = isPlanActive && selectedSeats > activeSeats;
                    const isDowngrade = isPlanActive && selectedSeats < activeSeats;
                    const addedSeats = selectedSeats - activeSeats;
                    const fullCycleCost = billingCycle === "annual" ? addedSeats * 99 * 12 : addedSeats * 159;
                    const dailyRatePerSeat = billingCycle === "annual" ? (99 * 12) / 365 : 159 / 30;
                    const proratedCost = Math.round(addedSeats * dailyRatePerSeat * remainingDays);
                    const proratedTotal = Math.max(1, Math.min(fullCycleCost, proratedCost));

                    const isDisabled = loading !== null || isCurrentPlan;

                    let btnText = "";
                    if (loading === plan.key) {
                      btnText = t('processing');
                    } else if (isCurrentPlanName && isCycleChanged) {
                      btnText = billingCycle === "annual"
                        ? `Switch to Annual Billing (₹${(selectedSeats * 99 * 12).toLocaleString("en-IN")}/yr)`
                        : `Switch to Monthly Billing (₹${(selectedSeats * 159).toLocaleString("en-IN")}/mo)`;
                    } else if (isCurrentPlanName && isUpgrade) {
                      btnText = `Upgrade to ${selectedSeats} Seats (₹${proratedTotal.toLocaleString("en-IN")})`;
                    } else if (isCurrentPlanName && isDowngrade) {
                      btnText = `Update to ${selectedSeats} Seats (₹${totalBilled.toLocaleString("en-IN")})`;
                    } else if (isCurrentPlan) {
                      btnText = t('current_plan');
                    } else {
                      btnText = t(plan.buttonText);
                    }

                    return (
                      <Button
                        onClick={() => handlePayment(plan)}
                        disabled={isDisabled}
                        className={cn(
                          "w-full h-12 rounded-xl font-bold transition-all",
                          isDisabled
                            ? "bg-green-100 text-green-700 hover:bg-green-100 border border-green-200"
                            : plan.key === "enterprise"
                              ? "bg-transparent border border-muted-foreground/30 text-foreground hover:bg-secondary"
                              : "bg-[#FF8A3D] text-white hover:bg-[#FF8A3D]/90",
                        )}>
                        {btnText}
                      </Button>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="usage">
          {usageData && (
            <div className="space-y-8">
              <div className="p-8 rounded-3xl border border-border bg-card/50 backdrop-blur-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-orange-100 dark:bg-orange-500/10 text-orange-600">
                      <LayoutGrid className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">
                        {t('resource_consumption')}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t('resource_consumption_subtitle')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* AutoPay Status & Cancel Button */}
                    {isAutoPayActive ? (
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          AutoPay Active ({usageData.plan.subscription_cycle === "annual" ? "Annual" : "Monthly"})
                        </span>
                        {/* <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelAutoPay}
                          disabled={cancellingAutoPay}
                          className="h-8 text-xs font-semibold border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          {cancellingAutoPay ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
                          Cancel AutoPay
                        </Button> */}
                      </div>
                    ) : (
                      <span className="px-3 py-1.5 rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-500 font-bold text-xs">
                        AutoPay Inactive
                      </span>
                    )}

                    <div className="px-4 py-1.5 rounded-2xl bg-muted/50 border border-border text-right">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5">
                        {t('plan_validity')}
                      </span>
                      <span className="text-sm font-bold">
                        {new Date(usageData.plan.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {/* Projects */}
                  <div className="space-y-4 p-5 rounded-2xl bg-card border border-border">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          {t('active_projects')}
                        </span>
                        <p className="text-2xl font-black">
                          {usageData.usage.projects}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {t('limit')}: {usageData.plan.limits.project_limit >= 99999 ? (t('unlimited') || 'Unlimited') : usageData.plan.limits.project_limit}
                      </span>
                    </div>
                    <Progress
                      value={
                        usageData.plan.limits.project_limit >= 99999
                          ? 0
                          : (usageData.usage.projects / usageData.plan.limits.project_limit) * 100
                      }
                      className="h-2"
                    />
                  </div>

                  {/* Storage */}
                  <div className="space-y-4 p-5 rounded-2xl bg-card border border-border">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          {t('cloud_storage')}
                        </span>
                        <p className="text-2xl font-black">
                          {formatFileSize(usageData.usage.storage_mb)}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {t('limit')}: {formatFileSize(usageData.usage.storage_limit_mb || usageData.plan.limits.storage_limit_mb)}
                      </span>
                    </div>
                    <Progress
                      value={usageData.usage.storage_percent}
                      className="h-2"
                    />
                    <a href="mailto:support@apexis.in" className="text-[11px] text-orange-500 font-bold hover:underline block">
                      Need extra storage? Contact support@apexis.in
                    </a>
                  </div>

                  {/* Contributors */}
                  <div className="space-y-4 p-5 rounded-2xl bg-card border border-border">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Team Seats
                        </span>
                        <p className="text-2xl font-black">
                          {usageData.usage.seats_used ?? usageData.usage.contributors}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        Limit: {usageData.usage.seats_limit_total ?? usageData.usage.seats_purchased ?? usageData.plan.seats_purchased ?? 1}
                      </span>
                    </div>
                    <Progress
                      value={
                        ((usageData.usage.seats_used ?? usageData.usage.contributors) /
                          Math.max(1, usageData.usage.seats_limit_total ?? usageData.usage.seats_purchased ?? usageData.plan.seats_purchased ?? 1)) *
                        100
                      }
                      className="h-2"
                    />
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-bold text-muted-foreground">
                        {t('clients')}
                      </span>
                    </div>
                    <span className="text-sm font-black">
                      {usageData.usage.clients} /{" "}
                      {usageData.plan.limits.client_limit}
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-bold text-muted-foreground">
                        {t('snags')}
                      </span>
                    </div>
                    <span className="text-sm font-black">
                      {usageData.usage.snags} /{" "}
                      {usageData.plan.limits.max_snags}
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-bold text-muted-foreground">
                        {t('rfis')}
                      </span>
                    </div>
                    <span className="text-sm font-black">
                      {usageData.usage.rfis} / {usageData.plan.limits.max_rfis}
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold text-primary">
                        {t('status')}
                      </span>
                    </div>
                    <span className="text-[10px] font-black uppercase text-primary">
                      {t('active_status')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr className="border-b border-border">
                    <th className="p-4 text-left font-medium">{t('plans_tab')}</th>
                    <th className="p-4 text-left font-medium">Seats</th>
                    <th className="p-4 text-left font-medium">{t('invoice')}</th>
                    <th className="p-4 text-left font-medium">{t('cycle')}</th>
                    <th className="p-4 text-left font-medium">{t('amount')}</th>
                    <th className="p-4 text-left font-medium">{t('status')}</th>
                    <th className="p-4 text-left font-medium">{t('date')}</th>
                    <th className="p-4 text-left font-medium">{t('action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-8 text-center text-muted-foreground">
                        {t('no_payment_history')}
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="p-4 font-semibold">
                          {tx.subscription_tier}
                        </td>
                        <td className="p-4 font-bold text-orange-500">
                          {tx.seats_purchased || 1} seat(s)
                        </td>
                        <td className="p-4 font-mono text-xs">
                          {tx.invoice_number || "-"}
                        </td>
                        <td className="p-4 capitalize">
                          {tx.subscription_cycle}
                        </td>
                        <td className="p-4 font-bold">₹{tx.payment_amount}</td>
                        <td className="p-4">
                          <span
                            className={cn(
                              "px-2.5 py-1 rounded-full text-xs font-bold",
                              tx.payment_status === "success"
                                ? "bg-green-100 text-green-700"
                                : tx.payment_status === "pending"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700",
                            )}>
                            {tx.payment_status}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          {tx.payment_status === "success" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-accent/10 text-accent transition-colors disabled:opacity-50"
                              onClick={() => handleDownloadInvoice(tx)}
                              disabled={downloadingId === tx.id}
                              title="Download PDF"
                            >
                              {downloadingId === tx.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Seat Reduction & Project Member Management Modal */}
      <ProjectMemberManagementModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        targetSeats={selectedSeats}
        projects={validationProjects}
        onRefreshValidation={handleRefreshValidation}
        onProceed={async () => {
          setIsMemberModalOpen(false);
          if (pendingPlan) {
            const activeCycle = usageData?.plan?.subscription_cycle || user?.organization?.subscription_cycle || "monthly";
            const isCycleChanged = activeCycle !== billingCycle;
            const isSeatChanged = selectedSeats !== activeSeats;
            if (isPlanActive && (isCycleChanged || isSeatChanged)) {
              setPendingNoticePlan(pendingPlan);
              setIsNoticeModalOpen(true);
            } else {
              await executeCheckout(pendingPlan);
            }
          }
        }}
      />

      {/* Subscription Update & Email Notice Modal */}
      <SubscriptionNoticeModal
        isOpen={isNoticeModalOpen}
        onClose={() => setIsNoticeModalOpen(false)}
        onConfirm={async () => {
          setIsNoticeModalOpen(false);
          if (pendingNoticePlan) {
            await executeCheckout(pendingNoticePlan);
          }
        }}
        planName={pendingNoticePlan?.name || "Starter"}
        targetSeats={selectedSeats}
        billingCycle={billingCycle}
        currentSeats={activeSeats}
        currentCycle={usageData?.plan?.subscription_cycle || user?.organization?.subscription_cycle || "monthly"}
        isUpgrade={isPlanActive && selectedSeats > activeSeats}
        isDowngrade={isPlanActive && selectedSeats < activeSeats}
        isCycleChanged={isPlanActive && (usageData?.plan?.subscription_cycle || user?.organization?.subscription_cycle || "monthly") !== billingCycle}
        planEndDate={usageData?.plan?.endDate || usageData?.plan?.subscription_plan_end_date || user?.organization?.plan_end_date || user?.organization?.subscription_plan_end_date}
        proratedAmount={(() => {
          if (isPlanActive && selectedSeats > activeSeats) {
            const addedSeats = selectedSeats - activeSeats;
            const fullCycleCost = billingCycle === "annual" ? addedSeats * 99 * 12 : addedSeats * 159;
            const dailyRatePerSeat = billingCycle === "annual" ? (99 * 12) / 365 : 159 / 30;
            const proratedCost = Math.round(addedSeats * dailyRatePerSeat * remainingDays);
            return Math.max(1, Math.min(fullCycleCost, proratedCost));
          }
          return 0;
        })()}
      />
    </div>
  );
};

export default Billing;
