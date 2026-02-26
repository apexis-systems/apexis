"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const plans = [
    {
        name: 'Standard',
        key: 'standard',
        price: '$29',
        period: '/month',
        recommended: false,
        features: [
            'Up to 5 projects',
            '10 GB storage',
            '3 team members',
            'Email support',
            'Basic reporting',
            'Document uploads',
            'Photo uploads',
        ],
    },
    {
        name: 'Intermediate',
        key: 'intermediate',
        price: '$79',
        period: '/month',
        recommended: true,
        features: [
            'Up to 25 projects',
            '100 GB storage',
            '15 team members',
            'Priority support',
            'Advanced reporting',
            'Document uploads',
            'Photo uploads',
            'Snag list management',
            'Manuals & SOPs',
            'Comment threads',
        ],
    },
    {
        name: 'Pro',
        key: 'pro',
        price: '$199',
        period: '/month',
        recommended: false,
        features: [
            'Unlimited projects',
            '1 TB storage',
            'Unlimited team members',
            '24/7 dedicated support',
            'Custom reporting',
            'Document uploads',
            'Photo uploads',
            'Snag list management',
            'Manuals & SOPs',
            'Comment threads',
            'SSO integration',
            'API access',
        ],
    },
];

const BillingPage = () => {
    const { user } = useAuth();
    const { t } = useLanguage();

    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return (
            <div className="p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground">You do not have permission to view billing.</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold text-foreground">{t('billing')}</h1>
                <p className="mt-1 text-sm text-muted-foreground">Choose the plan that fits your team</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => (
                    <div
                        key={plan.key}
                        className={cn(
                            'relative rounded-2xl border p-6 flex flex-col',
                            plan.recommended
                                ? 'border-accent bg-accent/5 shadow-lg'
                                : 'border-border bg-card'
                        )}
                    >
                        {plan.recommended && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                                    {t('recommended')}
                                </span>
                            </div>
                        )}

                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                            <div className="mt-3">
                                <span className="text-4xl font-black text-foreground">{plan.price}</span>
                                <span className="text-sm text-muted-foreground">{plan.period}</span>
                            </div>
                        </div>

                        <ul className="space-y-3 flex-1 mb-6">
                            {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                    <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                                    <span className="text-foreground">{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <Button
                            onClick={() => toast.success(`${plan.name} plan selected`)}
                            className={cn(
                                'w-full h-11 rounded-xl font-semibold',
                                plan.recommended
                                    ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                            )}
                        >
                            {t('choose_plan')}
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BillingPage;
