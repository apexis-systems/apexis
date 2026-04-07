"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Check, Clock, CreditCard, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import * as subscriptionService from '@/services/subscriptionService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const plans = [
    {
        name: 'One-Time Buy',
        key: 'onetime',
        subtitle: 'Single project access',
        validity: 'Valid for 90 days',
        trial: '14 Day Free Trial',
        monthlyPrice: '₹10,000',
        yearlyPrice: '₹10,000',
        monthlyValue: 10000,
        yearlyValue: 10000,
        isSubscription: false,
        recommended: false,
        buttonText: 'Buy Now',
        features: [
            'Single Project Access', 'Client Viewership', 'Basic Reporting', '5GB Cloud Storage', 
            'One-time purchase', 'Snag List Feature', 'Drawings Release to Site', 
            'Multi-lingual Support (English, Hindi & Telugu)', '14-Day Free Trial', 'Secure Data Storage'
        ],
    },
    {
        name: 'Starter',
        key: 'starter',
        subtitle: 'Up to 5 projects',
        trial: '14 Day Free Trial',
        monthlyPrice: '₹40,000',
        yearlyPrice: '₹32,000',
        monthlyValue: 40000,
        yearlyValue: 32000 * 12,
        period: '/month',
        recommended: false,
        buttonText: 'Get Started',
        features: [
            'Up to 5 Projects', 'Client Viewership', 'Structured Reporting', '25GB Cloud Storage', 
            'Basic Project Dashboard', 'Snag List Feature', 'Drawings Release to Site', 
            'Multi-lingual Support (English, Hindi & Telugu)', '14-Day Free Trial', 'Secure Data Storage'
        ],
    },
    {
        name: 'Professional',
        key: 'pro',
        subtitle: 'Up to 10 projects',
        trial: '14 Day Free Trial',
        monthlyPrice: '₹60,000',
        yearlyPrice: '₹48,000',
        monthlyValue: 60000,
        yearlyValue: 48000 * 12,
        period: '/month',
        recommended: true,
        buttonText: 'Upgrade to Pro',
        features: [
            'Up to 10 Projects', 'Client Viewership', 'AI-Assisted Reports', 'Role-Based Access', 
            '100GB Cloud Storage', 'Media Documentation', 'Priority Support', 'Snag List Feature', 
            'Drawings Release to Site', 'Multi-lingual Support (English, Hindi & Telugu)', 
            '14-Day Free Trial', 'Secure Data Storage'
        ],
    },
    {
        name: 'Enterprise',
        key: 'enterprise',
        subtitle: 'Above 10 projects',
        trial: '14 Day Free Trial',
        monthlyPrice: 'Custom',
        yearlyPrice: 'Custom',
        monthlyValue: 0,
        yearlyValue: 0,
        recommended: false,
        buttonText: 'Contact Sales',
        features: [
            'Above 10 Projects', 'Client Viewership', 'Custom Workflows', 'Custom Onboarding', 
            'Dedicated Support', 'Custom Integrations', 'Above 100GB Cloud Storage', 
            'Snag List Feature', 'Drawings Release to Site', 'Multi-lingual Support (English, Hindi & Telugu)', 
            '14-Day Free Trial', 'Secure Data Storage'
        ],
    },
];

const Billing = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [loading, setLoading] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isYearly, setIsYearly] = useState(false);

    useEffect(() => {
        if (user && (user.role === 'admin' || user.role === 'superadmin')) {
            loadTransactions();
        }
    }, [user]);

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
            script.src = process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_URL || "https://checkout.razorpay.com/v1/checkout.js";
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handlePayment = async (plan: any) => {
        if (plan.key === 'enterprise') {
            window.location.href = "mailto:sales@apexis.in?subject=Enterprise Plan Inquiry";
            return;
        }

        setLoading(plan.key);
        try {
            const isScriptLoaded = await loadRazorpayScript();
            if (!isScriptLoaded) {
                toast.error("Razorpay SDK failed to load. Please check your internet connection.");
                setLoading(null);
                return;
            }

            const orderData = await subscriptionService.createOrder({
                amount: isYearly ? plan.yearlyValue : plan.monthlyValue,
                currency: "INR",
                plan_name: plan.name,
                plan_cycle: (isYearly ? "annual" : "monthly") as 'monthly' | 'annual'
            });

            const { order } = orderData;

            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                amount: order.amount,
                currency: order.currency,
                name: "Apexis",
                description: `${plan.name} Subscription`,
                order_id: order.id,
                handler: async (response: any) => {
                    try {
                        const verifyData = {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            plan_name: plan.name,
                            plan_cycle: (isYearly ? 'annual' : 'monthly') as 'monthly' | 'annual'
                        };
                        await subscriptionService.verifyPayment(verifyData);
                        toast.success("Payment successful! Your plan has been upgraded.");
                        loadTransactions();
                    } catch (error) {
                        toast.error("Payment verification failed. Please contact support.");
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

            const rzp = new (window as any).Razorpay(options);
            rzp.on("payment.failed", (response: any) => {
                toast.error(`Payment failed: ${response.error.description}`);
            });
            rzp.open();
        } catch (error: any) {
            console.error("Payment error:", error);
            toast.error(error.response?.data?.message || "Something went wrong with the payment.");
        } finally {
            setLoading(null);
        }
    };

    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return (
            <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground">You do not have permission to view plan/upgrade.</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold text-foreground">{t('billing')}</h1>
                <p className="mt-1 text-sm text-muted-foreground">Choose the plan that fits your team</p>
            </div>

            {/* Monthly/Yearly Toggle */}
            <div className="flex items-center justify-center gap-4 mb-10">
                <span className={cn("text-sm transition-colors", !isYearly ? "text-foreground font-bold" : "text-muted-foreground")}>Monthly</span>
                <button
                    onClick={() => setIsYearly(!isYearly)}
                    className="relative w-12 h-6 rounded-full bg-secondary transition-colors focus:outline-none"
                    aria-label="Toggle billing cycle"
                >
                    <div className={cn(
                        "absolute top-1 left-1 w-4 h-4 rounded-full bg-foreground transition-transform duration-200 ease-in-out shadow-sm",
                        isYearly ? "translate-x-6" : "translate-x-0"
                    )} />
                </button>
                <div className="flex items-center gap-2">
                    <span className={cn("text-sm transition-colors", isYearly ? "text-foreground font-bold" : "text-muted-foreground")}>Yearly</span>
                    {isYearly && (
                        <span className="bg-orange-100 text-orange-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                            Save 20%
                        </span>
                    )}
                </div>
            </div>

            <Tabs defaultValue="plans" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px] mx-auto mb-10 text-foreground">
                    <TabsTrigger value="plans" className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Plans
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="plans">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {plans.map((plan) => (
                            <div
                                key={plan.key}
                                className={cn(
                                    'relative rounded-3xl border p-6 flex flex-col transition-all duration-300 hover:shadow-xl',
                                    plan.recommended ? 'border-orange-500 bg-orange-50/10 shadow-lg scale-105 z-10' : 'border-border bg-card'
                                )}
                            >
                                {plan.recommended && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <span className="rounded-full bg-black px-4 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                                            Most Popular
                                        </span>
                                    </div>
                                )}

                                <div className="text-center mb-6">
                                    <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                                    <p className="text-xs text-muted-foreground mb-3">{plan.subtitle}</p>
                                    
                                    {plan.validity && (
                                        <p className="text-[11px] text-orange-500 font-semibold mb-1">{plan.validity}</p>
                                    )}
                                    <p className="text-[11px] text-orange-500 font-semibold mb-4">{plan.trial}</p>

                                    <div className="flex items-baseline justify-center gap-1">
                                        <span className="text-3xl font-black text-foreground">
                                            {isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                                        </span>
                                        {plan.period && (
                                            <span className="text-xs text-muted-foreground">{plan.period}</span>
                                        )}
                                    </div>
                                    
                                    {isYearly && plan.key !== 'enterprise' && plan.key !== 'onetime' && (
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Billed ₹{(plan.yearlyValue).toLocaleString('en-IN')} annually
                                        </p>
                                    )}
                                </div>

                                <ul className="space-y-4 flex-1 mb-8">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-start gap-2.5 text-xs">
                                            <Check className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
                                            <span className="text-foreground/80 leading-relaxed">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {(() => {
                                    const isCurrentPlan = user?.organization?.plan_name === plan.name;
                                    const isNotExpired = user?.organization?.plan_end_date ? new Date(user.organization.plan_end_date) > new Date() : false;
                                    const isActive = isCurrentPlan && isNotExpired;

                                    return (
                                        <Button
                                            onClick={() => handlePayment(plan)}
                                            disabled={loading !== null || isActive}
                                            className={cn(
                                                'w-full h-12 rounded-xl font-bold transition-all',
                                                isActive 
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-100 border border-green-200' 
                                                    : plan.key === 'enterprise'
                                                        ? 'bg-transparent border border-muted-foreground/30 text-foreground hover:bg-secondary'
                                                        : 'bg-[#FF8A3D] text-white hover:bg-[#FF8A3D]/90'
                                            )}
                                        >
                                            {loading === plan.key ? "Processing..." : isActive ? "Current Plan" : plan.buttonText}
                                        </Button>
                                    );
                                })()}
                            </div>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="history">
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted">
                                    <tr className="border-b border-border">
                                        <th className="p-4 text-left font-medium">Plan</th>
                                        <th className="p-4 text-left font-medium">Cycle</th>
                                        <th className="p-4 text-left font-medium">Amount</th>
                                        <th className="p-4 text-left font-medium">Status</th>
                                        <th className="p-4 text-left font-medium">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                                No payment history found.
                                            </td>
                                        </tr>
                                    ) : (
                                        transactions.map((tx) => (
                                            <tr key={tx.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                                                <td className="p-4 font-semibold">{tx.subscription_tier}</td>
                                                <td className="p-4 capitalize">{tx.subscription_cycle}</td>
                                                <td className="p-4">₹{tx.payment_amount}</td>
                                                <td className="p-4">
                                                    <span className={cn(
                                                        "px-2 py-1 rounded-full text-xs font-bold",
                                                        tx.payment_status === 'success' ? "bg-green-100 text-green-700" : 
                                                        tx.payment_status === 'pending' ? "bg-yellow-100 text-yellow-700" : 
                                                        "bg-red-100 text-red-700"
                                                    )}>
                                                        {tx.payment_status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-muted-foreground">
                                                    {new Date(tx.created_at).toLocaleDateString()}
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
        </div>
    );
};

export default Billing;
