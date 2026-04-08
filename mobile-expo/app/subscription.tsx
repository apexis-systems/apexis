import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/ui/AppText';
import { useTheme } from '@/contexts/ThemeContext';
import { useUsage } from '@/contexts/UsageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getPlans, createOrder, verifyPayment } from '@/services/subscriptionService';
import { getMe } from '@/services/authService';
import RazorpayCheckout from 'react-native-razorpay';

const PLAN_ORDER = ['One-Time Buy', 'Starter', 'Professional', 'Enterprise'];
const PLAN_PERIOD_MAP: Record<string, string> = {
    'One-Time Buy': '',
    'Starter': '/mo',
    'Professional': '/mo',
    'Enterprise': '',
};

const isEnterprisePlan = (plan: any): boolean => {
    const name = String(plan?.name || '').trim().toLowerCase();
    return name === 'enterprise' || Number(plan?.price) >= 999999;
};

export default function SubscriptionScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const { usageData, loading: usageLoading, refreshUsage } = useUsage();
    const { user, updateUser } = useAuth() as any;

    const [availablePlans, setAvailablePlans] = useState<any[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);
    const [processingPayment, setProcessingPayment] = useState(false);
    const appIconUri = Image.resolveAssetSource(require('../assets/images/app-icon.png')).uri;

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        setPlansLoading(true);
        try {
            const data = await getPlans();
            const filtered = data.filter((p: any) => PLAN_ORDER.includes(p.name));
            const sorted = filtered.sort((a: any, b: any) => PLAN_ORDER.indexOf(a.name) - PLAN_ORDER.indexOf(b.name));
            setAvailablePlans(sorted);
        } catch (error) {
            console.error("Failed to fetch plans mobile:", error);
        } finally {
            setPlansLoading(false);
        }
    };

    const handleUpgrade = async (plan: any) => {
        if (processingPayment) return;
        if (isEnterprisePlan(plan)) {
            Linking.openURL('mailto:support@apexis.in?subject=Enterprise Plan Inquiry');
            return;
        }
        const razorpayKey = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;
        if (!razorpayKey) {
            Alert.alert("Configuration Error", "Razorpay key is missing in app environment.");
            return;
        }
        if (!RazorpayCheckout || typeof (RazorpayCheckout as any).open !== 'function') {
            Alert.alert(
                "Razorpay Unavailable",
                "Razorpay native module is not loaded. Use a native dev build (`expo run:android` / `expo run:ios`), not Expo Go."
            );
            return;
        }

        setProcessingPayment(true);
        try {
            const basePrice = Number(plan.price) || 0;
            const amount = basePrice;

            const orderData = await createOrder({
                amount,
                currency: "INR",
                plan_name: plan.name,
                plan_cycle: 'monthly'
            });

            if (!orderData?.order?.id || !orderData.order.amount) {
                throw new Error("Invalid payment order received from server.");
            }

            const options = {
                description: `${plan.name} Subscription`,
                image: appIconUri,
                currency: 'INR',
                key: razorpayKey,
                amount: orderData.order.amount,
                name: 'Apexis',
                order_id: orderData.order.id,
                prefill: {
                    email: user?.email || '',
                    contact: user?.phone_number || '',
                    name: user?.name || ''
                },
                theme: { color: colors.primary }
            };

            const data: any = await RazorpayCheckout.open(options);
            if (!data?.razorpay_order_id || !data?.razorpay_payment_id || !data?.razorpay_signature) {
                throw new Error("Payment response is missing required details.");
            }
            try {
                await verifyPayment({
                    razorpay_order_id: data.razorpay_order_id,
                    razorpay_payment_id: data.razorpay_payment_id,
                    razorpay_signature: data.razorpay_signature,
                    plan_name: plan.name,
                    plan_cycle: 'monthly'
                });

                try {
                    const refreshed = await getMe();
                    if (refreshed?.user) {
                        updateUser({ ...refreshed.user, organization: refreshed.organization, project_id: refreshed.project_id } as any);
                    }
                } catch (refreshError) {
                    console.error("Failed to refresh user after payment:", refreshError);
                }

                await refreshUsage();
                Alert.alert("Success", "Your plan has been upgraded successfully!");
            } catch (e: any) {
                const message = e?.response?.data?.message || e?.message || "Payment verification failed. Please contact support.";
                Alert.alert("Error", message);
            }
        } catch (error: any) {
            // Razorpay cancellation code in RN SDK.
            if (error?.code === 2) return;
            const rawMessage = String(error?.description || error?.message || '');
            if (
                rawMessage.toLowerCase().includes('native module') ||
                rawMessage.toLowerCase().includes('razorpaycheckout') ||
                rawMessage.toLowerCase().includes("open' of null") ||
                rawMessage.toLowerCase().includes('open of null')
            ) {
                Alert.alert("Razorpay Unavailable", "Razorpay requires a native dev build (Expo Go will not work). Please run the app with `expo run:android` or `expo run:ios`.");
                return;
            }
            const errorMessage = error?.response?.data?.message || error?.response?.data?.error?.description || error?.message || "Failed to initiate payment";
            Alert.alert("Error", errorMessage);
        } finally {
            setProcessingPayment(false);
        }
    };

    if ((usageLoading && !usageData) || plansLoading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!usageData) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <Text>Failed to load subscription data.</Text>
                <TouchableOpacity onPress={refreshUsage} style={{ marginTop: 20 }}>
                    <Text style={{ color: colors.primary }}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const { plan, usage } = usageData;


    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
            <Stack.Screen 
                options={{ 
                    title: 'Subscription & Plans',
                    headerShown: true,
                    headerTransparent: false,
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
                            <Feather name="arrow-left" size={24} color={colors.text} />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <TouchableOpacity onPress={() => router.push('/transactions')} style={{ marginRight: 10 }}>
                            <MaterialCommunityIcons name="history" size={24} color={colors.text} />
                        </TouchableOpacity>
                    )
                }} 
            />
            
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Current Plan Card */}
                <View style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 2 }]}>
                    <View style={styles.planHeader}>
                        <View>
                            <Text style={[styles.planBadge, { fontFamily: 'Montserrat-Bold', color: colors.primary }]}>CURRENT ACTIVE PLAN</Text>
                            <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                        </View>
                        <View style={[styles.iconContainer, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
                            <Feather name="award" size={32} color="#f97316" />
                        </View>
                    </View>

                    <View style={styles.planDates}>
                        <View style={styles.dateItem}>
                            <Text style={styles.dateLabel}>RENEWAL DATE</Text>
                            <Text style={[styles.dateValue, { color: colors.text }]}>
                                {new Date(plan.endDate).toLocaleDateString()}
                            </Text>
                        </View>
                        <View style={styles.dateItem}>
                            <Text style={styles.dateLabel}>DAYS REMAINING</Text>
                            <Text style={[styles.dateValue, { color: plan.daysRemaining < 10 ? '#ef4444' : colors.text }]}>
                                {plan.daysRemaining} Days
                            </Text>
                        </View>
                    </View>
                </View>


                {/* Available Plans */}
                <Text style={styles.sectionTitle}>UPGRADE YOUR EXPERIENCE</Text>

                <View style={styles.plansList}>
                    {availablePlans.map((p) => {
                        const isCurrent = p.name === plan.name;
                        const price = Number(p.price) || 0;
                        const isEnterprise = isEnterprisePlan(p);
                        const period = PLAN_PERIOD_MAP[p.name] || '';
                        const buttonLabel = isCurrent ? 'Current' : isEnterprise ? 'Contact Sales' : 'Upgrade';

                        return (
                            <View key={p.id} style={[styles.availablePlanCard, { backgroundColor: colors.surface, borderColor: isCurrent ? colors.primary : colors.border }]}>
                                <View style={styles.availablePlanInfo}>
                                    <Text style={[styles.availablePlanName, { color: colors.text }]}>{p.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                        <Text style={styles.availablePlanPrice}>
                                            {isEnterprise ? 'Custom' : `₹${price.toLocaleString('en-IN')}`}
                                        </Text>
                                        {!!period && <Text style={{ fontSize: 12, color: colors.textMuted, marginLeft: 4 }}>{period}</Text>}
                                    </View>
                                </View>
                                
                                <TouchableOpacity 
                                    style={[styles.selectBtn, { backgroundColor: isCurrent ? 'transparent' : colors.primary, borderColor: colors.primary, borderWidth: 1 }]}
                                    disabled={(isCurrent && !isEnterprise) || processingPayment}
                                    onPress={() => handleUpgrade(p)}
                                >
                                    {processingPayment ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <Text style={[styles.selectBtnText, { color: isCurrent ? colors.primary : 'white' }]}>
                                            {buttonLabel}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>

                {/* Support */}
                <TouchableOpacity 
                    style={[styles.supportLink, { borderTopColor: colors.border }]}
                    onPress={() => Linking.openURL('mailto:support@apexis.in')}
                >
                    <Feather name="help-circle" size={16} color={colors.textMuted} />
                    <Text style={[styles.supportText, { color: colors.textMuted }]}>Having issues? Contact Support</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    planCard: {
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        marginBottom: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 5,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    planBadge: {
        fontSize: 10,
        letterSpacing: 1,
        marginBottom: 4,
    },
    planName: {
        fontSize: 28,
        fontWeight: '800',
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    planDates: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        paddingTop: 20,
    },
    dateItem: {
        flex: 1,
    },
    dateLabel: {
        fontSize: 10,
        color: '#888',
        fontWeight: '600',
        marginBottom: 4,
    },
    dateValue: {
        fontSize: 15,
        fontWeight: '700',
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#888',
        marginBottom: 12,
        letterSpacing: 1,
        paddingHorizontal: 4,
    },
    usageCard: {
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        marginBottom: 32,
        gap: 20,
    },
    usageItem: {
        width: '100%',
    },
    usageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    usageLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    usageValue: {
        fontSize: 12,
    },
    progressBarBg: {
        height: 6,
        borderRadius: 3,
        width: '100%',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    cycleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
    },
    cycleBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    cycleText: {
        fontSize: 12,
        fontWeight: '700',
    },
    plansList: {
        gap: 12,
        marginBottom: 32,
    },
    availablePlanCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
    },
    availablePlanInfo: {
        flex: 1,
    },
    availablePlanName: {
        fontSize: 16,
        fontWeight: '800',
    },
    availablePlanPrice: {
        fontSize: 20,
        fontWeight: '900',
        color: '#f97316',
        marginTop: 2,
    },
    selectBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
    },
    selectBtnText: {
        fontSize: 13,
        fontWeight: '800',
    },
    supportLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingTop: 24,
        borderTopWidth: 1,
    },
    supportText: {
        fontSize: 12,
    }
});
