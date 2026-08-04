import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Image,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { useUsage } from "@/contexts/UsageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPlans,
  createOrder,
  verifyPayment,
  validateSeatChange,
} from "@/services/subscriptionService";
import { ProjectMemberManagementModal } from "@/components/subscription/ProjectMemberManagementModal";
import { getMe } from "@/services/authService";
let RazorpayCheckout: any = null;
try {
    RazorpayCheckout = require("react-native-razorpay").default;
} catch {
    // Not available in Expo Go — requires a development build
}

const PLAN_ORDER = ["Starter", "Enterprise"];
const GST_RATE = 0.18;

const isEnterprisePlan = (plan: any): boolean => {
  const name = String(plan?.name || "")
    .trim()
    .toLowerCase();
  return name === "enterprise" || Number(plan?.price) >= 999999;
};

const PLAN_DETAILS: Record<
  string,
  {
    subtitleKey: string;
    validity?: string;
    trial?: string;
    featureKeys: string[];
  }
> = {
  Starter: {
    subtitleKey: "Pay Per Seat Subscription",
    featureKeys: [
      "unlimitedProjects",
      "storage5GBPerProject",
      "fullRoleAccess",
      "snagList",
      "drawingsRelease",
      "multilingual",
      "secureStorage",
    ],
  },
  Enterprise: {
    subtitleKey: "Custom Pricing (>100 Seats)",
    featureKeys: [
      "above100Seats",
      "customStorage",
      "dedicatedSupport",
      "customIntegrations",
      "snagList",
      "drawingsRelease",
      "multilingual",
      "secureStorage",
    ],
  },
};


const gstAmount = (baseAmount: number): number =>
  Number((baseAmount * GST_RATE).toFixed(2));
const payableAmount = (baseAmount: number): number =>
  Number((baseAmount + gstAmount(baseAmount)).toFixed(2));

export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { usageData, loading: usageLoading, refreshUsage } = useUsage();
  const { user, updateUser, logout } = useAuth() as any;

  const isLocked = user?.organization?.subscription_locked || usageData?.plan?.access?.isLocked;

  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const appIconUri = Image.resolveAssetSource(
    require("../assets/images/app-icon.png"),
  )?.uri || "";

  useEffect(() => {
    fetchPlans();
  }, []);

  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [selectedSeats, setSelectedSeats] = useState<number>(5);

  // Member management modal state
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [validationProjects, setValidationProjects] = useState<any[]>([]);
  const [pendingPlan, setPendingPlan] = useState<any | null>(null);

  const handleRefreshValidation = async () => {
    try {
      const res = await validateSeatChange(selectedSeats);
      setValidationProjects(res.projects || []);
      return res;
    } catch (error) {
      console.error("Error refreshing mobile seat validation", error);
    }
  };

  const fetchPlans = async () => {
    setPlansLoading(true);
    try {
      const data = await getPlans();
      const filtered = data.filter((p: any) => PLAN_ORDER.includes(p.name));
      const sorted = filtered.sort(
        (a: any, b: any) =>
          PLAN_ORDER.indexOf(a.name) - PLAN_ORDER.indexOf(b.name),
      );
      if (!sorted || sorted.length === 0) {
        setAvailablePlans([
          { id: 1, name: "Starter", price: 159 },
          { id: 2, name: "Enterprise", price: 999999 }
        ]);
      } else {
        setAvailablePlans(sorted);
      }
    } catch (error) {
      console.error("Failed to fetch plans mobile:", error);
      setAvailablePlans([
        { id: 1, name: "Starter", price: 159 },
        { id: 2, name: "Enterprise", price: 999999 }
      ]);
    } finally {
      setPlansLoading(false);
    }
  };

  const getEffectivePrice = (plan: any) => {
    const unitPrice = billingCycle === "annual" ? 99 : 159;
    return unitPrice;
  };

  const executeCheckout = async (plan: any) => {
    const razorpayKey = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;
    if (!razorpayKey) {
      Alert.alert(
        "Configuration Error",
        "Razorpay key is missing in app environment.",
      );
      return;
    }
    if (
      !RazorpayCheckout ||
      typeof (RazorpayCheckout as any).open !== "function"
    ) {
      Alert.alert(
        "Razorpay Unavailable",
        "Razorpay native module is not loaded. Use a native dev build (`expo run:android` / `expo run:ios`), not Expo Go.",
      );
      return;
    }

    setProcessingPayment(true);
    try {
      const currentSeats = usageData?.plan?.seats_purchased || usageData?.usage?.seats_purchased || 1;
      const remainingDays = Math.max(1, usageData?.plan?.daysRemaining || 30);
      const isPlanActive = (usageData?.plan?.daysRemaining || 0) > 0;
      const isUpgrade = isPlanActive && selectedSeats > currentSeats;

      let estimatedAmount = 0;
      if (isUpgrade) {
        const addedSeats = selectedSeats - currentSeats;
        const fullCycleCost = billingCycle === "annual" ? addedSeats * 99 * 12 : addedSeats * 159;
        const dailyRatePerSeat = billingCycle === "annual" ? (99 * 12) / 365 : 159 / 30;
        const proratedCost = Math.round(addedSeats * dailyRatePerSeat * remainingDays);
        estimatedAmount = Math.max(1, Math.min(fullCycleCost, proratedCost));
      } else {
        estimatedAmount = billingCycle === "annual" ? selectedSeats * 99 * 12 : selectedSeats * 159;
      }

      const orderData = await createOrder({
        amount: estimatedAmount,
        currency: "INR",
        plan_name: "Seat Subscription",
        plan_cycle: billingCycle,
        seats: selectedSeats,
      });

      if (orderData?.is_downgrade) {
        Alert.alert(t('common.success') || "Success", orderData.message || `Seats updated to ${selectedSeats} seats.`);
        await refreshUsage();
        try {
          const refreshed = await getMe();
          if (refreshed?.user) {
            updateUser({
              ...refreshed.user,
              organization: refreshed.organization,
              project_id: refreshed.project_id,
            } as any);
          }
        } catch (refreshError) {
          console.error("Failed to refresh user after seat update:", refreshError);
        }
        setProcessingPayment(false);
        return;
      }

      if (!orderData?.order?.id || !orderData.order.amount) {
        throw new Error("Invalid payment order received from server.");
      }

      const options = {
        description: isUpgrade ? `Add ${selectedSeats - currentSeats} Seats (${remainingDays} days remaining)` : `${plan.name} Subscription`,
        image: appIconUri,
        currency: "INR",
        key: razorpayKey,
        amount: orderData.order.amount,
        name: "Apexis",
        order_id: orderData.order.id,
        prefill: {
          email: user?.email || "",
          contact: user?.phone_number || "",
          name: user?.name || "",
        },
        theme: { color: colors.primary },
      };

      const data: any = await RazorpayCheckout.open(options);
      if (
        !data?.razorpay_order_id ||
        !data?.razorpay_payment_id ||
        !data?.razorpay_signature
      ) {
        throw new Error("Payment response is missing required details.");
      }
      try {
        await verifyPayment({
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
          plan_name: plan.name,
          plan_cycle: billingCycle,
        });

        try {
          const refreshed = await getMe();
          if (refreshed?.user) {
            updateUser({
              ...refreshed.user,
              organization: refreshed.organization,
              project_id: refreshed.project_id,
            } as any);
          }
        } catch (refreshError) {
          console.error("Failed to refresh user after payment:", refreshError);
        }

        await refreshUsage();
        Alert.alert(t('common.success') || 'Success', t('subscription.successUpgrade'));
      } catch (e: any) {
        const message =
          e?.response?.data?.message ||
          e?.message ||
          "Payment verification failed. Please contact support.";
        Alert.alert("Error", message);
      }
    } catch (error: any) {
      if (error?.code === 2) return;
      const rawMessage = String(error?.description || error?.message || "");
      if (
        rawMessage.toLowerCase().includes("native module") ||
        rawMessage.toLowerCase().includes("razorpaycheckout") ||
        rawMessage.toLowerCase().includes("open' of null") ||
        rawMessage.toLowerCase().includes("open of null")
      ) {
        Alert.alert(
          "Razorpay Unavailable",
          "Razorpay requires a native dev build (Expo Go will not work). Please run the app with `expo run:android` or `expo run:ios`.",
        );
        return;
      }
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Payment initiation failed. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleUpgrade = async (plan: any) => {
    if (processingPayment) return;
    if (isEnterprisePlan(plan) || selectedSeats > 100) {
      Linking.openURL(
        "mailto:support@apexis.in?subject=Enterprise Plan Inquiry (>100 Seats)",
      );
      return;
    }

    setProcessingPayment(true);
    try {
      const validation = await validateSeatChange(selectedSeats);
      if (!validation.valid) {
        setValidationProjects(validation.projects || []);
        setPendingPlan(plan);
        setIsMemberModalOpen(true);
        setProcessingPayment(false);
        return;
      }

      await executeCheckout(plan);
    } catch (error) {
      console.error("Pre-checkout seat validation error in mobile", error);
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
        <Text>{t('subscription.failedLoad')}</Text>
        <TouchableOpacity onPress={refreshUsage} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.primary }}>{t('subscription.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }


  const { plan, usage } = usageData;
  const selectedPlanDetails = selectedPlan
    ? PLAN_DETAILS[selectedPlan.name] || {
        subtitleKey: "subscription.plans.oneTimeSubtitle",
        featureKeys: [],
      }
    : null;


  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["bottom"]}>
      <View
        style={[
          styles.customHeader,
          { paddingTop: insets.top + 8, backgroundColor: colors.background },
        ]}>
        {isLocked ? (
          <TouchableOpacity
            onPress={async () => {
              await logout();
              router.replace('/(auth)/login');
            }}
            style={styles.headerIconBtn}>
            <Feather name="log-out" size={24} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerIconBtn}>
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('subscription.title')}
        </Text>
        <TouchableOpacity

          onPress={() => router.push("/transactions")}
          style={styles.headerIconBtn}>
          <MaterialCommunityIcons
            name="history"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Current Plan Card */}
        <View
          style={[
            styles.planCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.primary,
              borderWidth: 2,
            },
          ]}>
          <View style={styles.planHeader}>
            <View>
              <Text
                style={[
                  styles.planBadge,
                  { fontFamily: "Montserrat-Bold", color: colors.primary },
                ]}>
                {t('subscription.currentActivePlan')}
              </Text>
              <Text style={[styles.planName, { color: colors.text }]}>

                {plan.name}
              </Text>
            </View>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${colors.primary}1A` },
              ]}>
              <Feather name="award" size={32} color={colors.primary} />
            </View>
          </View>

          <View style={styles.planDates}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>{t('subscription.renewalDate')}</Text>
              <Text style={[styles.dateValue, { color: colors.text }]}>
                {new Date(plan.endDate).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>{t('subscription.daysRemaining')}</Text>
              <Text
                style={[
                  styles.dateValue,
                  {
                    color:
                      plan.daysRemaining < 10 ? colors.primary : colors.text,
                  },
                ]}>
                {plan.daysRemaining} {t('subscription.days')}
              </Text>
            </View>

          </View>
        </View>

        {/* Available Plans */}
        <Text style={styles.sectionTitle}>{t('subscription.upgradeTitle')}</Text>

        <View style={styles.toggleContainer}>
          <Text style={[styles.toggleLabel, billingCycle === "monthly" && { color: colors.primary, fontWeight: "700" }]}>{t('subscription.monthly')}</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
            style={[styles.toggleSwitch, { backgroundColor: colors.primary }]}>
            <View style={[styles.toggleCircle, billingCycle === "annual" ? styles.toggleCircleAnnual : styles.toggleCircleMonthly]} />
          </TouchableOpacity>
          <Text style={[styles.toggleLabel, billingCycle === "annual" && { color: colors.primary, fontWeight: "700" }]}>
            {t('subscription.annual')} <Text style={{ color: colors.primary, fontSize: 10 }}>{t('subscription.save35')}</Text>
          </Text>
        </View>

        <View style={styles.plansList}>
          {availablePlans.map((p) => {
            const isCurrent = p.name === plan.name;
            const effectivePrice = getEffectivePrice(p);
            const isAnnual = billingCycle === "annual" && p.name !== "One-Time Buy";
            const totalAnnual = effectivePrice * 12;

            const isEnterprise = isEnterprisePlan(p);
            const period = p.name === "One-Time Buy" || isEnterprise ? "" : "/mo";
            const buttonLabel = isCurrent
              ? t('subscription.current')
              : isEnterprise
                ? t('subscription.contactSales')
                : t('subscription.viewDetails');


            return (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.9}
                onPress={() => setSelectedPlan(p)}
                style={[
                  styles.availablePlanCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isCurrent ? colors.primary : colors.border,
                  },
                ]}>
                <View style={styles.availablePlanInfo}>
                  <Text
                    style={[styles.availablePlanName, { color: colors.text }]}>
                    {p.name}
                  </Text>
                  <Text
                    style={[
                       styles.availablePlanSubtitle,
                       { color: colors.textMuted },
                     ]}>
                     {t(PLAN_DETAILS[p.name]?.subtitleKey || "subscription.tapToView")}
                   </Text>

                  <View
                    style={{ flexDirection: "column", alignItems: "flex-start" }}>
                    <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                      <Text
                        style={[
                          styles.availablePlanPrice,
                          { color: colors.primary },
                         ]}>
                         {isEnterprise
                           ? t('subscription.customPricing')
                           : `₹${effectivePrice.toLocaleString("en-IN")}`}
                       </Text>

                      {!isEnterprise && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.textMuted,
                            marginLeft: 4,
                          }}>
                          /seat/mo
                        </Text>
                      )}
                    </View>
                     {isAnnual && !isEnterprise && (
                       <Text style={{ fontSize: 10, color: colors.primary, fontWeight: "600" }}>
                         {t('subscription.billedAnnually', { amount: totalAnnual.toLocaleString("en-IN") })}
                       </Text>
                     )}

                  </View>
                  {!isEnterprise && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textMuted,
                        marginTop: 4,
                        fontWeight: "600",
                      }}>
                      {t('subscription.inclGst')}
                    </Text>
                  )}

                </View>

                <View
                  style={[
                    styles.selectBtn,
                    {
                      backgroundColor: isCurrent
                        ? "transparent"
                        : colors.primary,
                      borderColor: colors.primary,
                      borderWidth: 1,
                    },
                  ]}>

                  <Text
                    style={[
                      styles.selectBtnText,
                      { color: isCurrent ? colors.primary : "white" },
                    ]}>
                    {buttonLabel}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Support */}
        <TouchableOpacity
          style={[styles.supportLink, { borderTopColor: colors.border }]}
           onPress={() => Linking.openURL("mailto:support@apexis.in")}>
           <Feather name="help-circle" size={16} color={colors.textMuted} />
           <Text style={[styles.supportText, { color: colors.textMuted }]}>
             {t('subscription.havingIssues')}
           </Text>
         </TouchableOpacity>

      </ScrollView>

      <Modal
        transparent
        animationType="slide"
        visible={!!selectedPlan}
        onRequestClose={() => setSelectedPlan(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSelectedPlan(null)}
          />
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}>
            {selectedPlan && selectedPlanDetails && (
              <>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.modalPlanName, { color: colors.text }]}>
                      {selectedPlan.name}
                    </Text>
                    <Text
                      style={[
                        styles.modalPlanSubtitle,
                        { color: colors.textMuted },
                      ]}>
                      {t(selectedPlanDetails.subtitleKey)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedPlan(null)}
                    style={[
                      styles.modalCloseBtn,
                      { backgroundColor: colors.surface },
                    ]}>
                    <Feather name="x" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalContent}
                  contentContainerStyle={styles.modalContentInner}
                  showsVerticalScrollIndicator={false}>
                  <View
                    style={[
                      styles.modalPriceCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: `${colors.primary}33`,
                      },
                    ]}>
                    <View style={styles.modalPriceRow}>
                      <Text
                        style={[
                           styles.modalPrice,
                           { color: colors.primary },
                         ]}>
                         {isEnterprisePlan(selectedPlan)
                           ? t('subscription.customPricing')
                           : `₹${(billingCycle === "annual" ? 99 : 159).toLocaleString("en-IN")}`}
                       </Text>

                      {!isEnterprisePlan(selectedPlan) && (
                        <Text
                          style={[
                            styles.modalPeriod,
                            { color: colors.textMuted },
                          ]}>
                          /seat/mo
                        </Text>
                      )}
                    </View>

                    {!isEnterprisePlan(selectedPlan) && (() => {
                      const activeSeats = usageData?.plan?.seats_purchased || usageData?.usage?.seats_purchased || 1;
                      const remainingDays = Math.max(1, usageData?.plan?.daysRemaining || 30);
                      const isPlanActive = (usageData?.plan?.daysRemaining || 0) > 0;
                      const isSeatUpgrade = isPlanActive && selectedSeats > activeSeats;
                      const addedSeats = selectedSeats - activeSeats;
                      const fullCycleCost = billingCycle === "annual" ? addedSeats * 99 * 12 : addedSeats * 159;
                      const dailyRatePerSeat = billingCycle === "annual" ? (99 * 12) / 365 : 159 / 30;
                      const proratedCost = Math.round(addedSeats * dailyRatePerSeat * remainingDays);
                      const calcTotal = isSeatUpgrade
                        ? Math.max(1, Math.min(fullCycleCost, proratedCost))
                        : (billingCycle === "annual" ? selectedSeats * 99 * 12 : selectedSeats * 159);

                      return (
                        <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5, marginBottom: 8 }}>
                            SELECT NUMBER OF SEATS
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                              <TouchableOpacity
                                onPress={() => setSelectedSeats(Math.max(1, selectedSeats - 1))}
                                style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.primary, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}10` }}>
                                <Feather name="minus" size={16} color={colors.primary} />
                              </TouchableOpacity>

                              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text, minWidth: 30, textAlign: "center" }}>
                                {selectedSeats}
                              </Text>

                              <TouchableOpacity
                                onPress={() => {
                                  if (selectedSeats >= 100) {
                                    Alert.alert("Custom Pricing", "For more than 100 seats, please contact support@apexis.in.");
                                  } else {
                                    setSelectedSeats(selectedSeats + 1);
                                  }
                                }}
                                style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.primary, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}10` }}>
                                <Feather name="plus" size={16} color={colors.primary} />
                              </TouchableOpacity>
                            </View>

                            <View style={{ alignItems: "flex-end" }}>
                              <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "600" }}>
                                {isSeatUpgrade ? `Prorated (+${addedSeats} seat${addedSeats > 1 ? 's' : ''}, ${remainingDays}d)` : `Total (${billingCycle})`}
                              </Text>
                              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.primary }}>
                                ₹{calcTotal.toLocaleString("en-IN")}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })()}

                    {!isEnterprisePlan(selectedPlan) && (
                      <Text
                        style={{
                          fontSize: 11,
                          color: colors.textMuted,
                          marginTop: 10,
                          fontWeight: "600",
                        }}>
                        (Incl. 18% GST) · 5GB Storage per project
                      </Text>
                    )}
                  </View>


                   <View
                    style={[
                      styles.featureCard,
                      { backgroundColor: colors.surface },
                    ]}>
                    <Text
                      style={[styles.featureTitle, { color: colors.text }]}>
                      {t('subscription.whatYouGet')}
                    </Text>
                    {selectedPlanDetails.featureKeys.map((featureKey) => (
                      <View key={featureKey} style={styles.featureRow}>
                        <View
                          style={[
                            styles.featureIconWrap,
                            { backgroundColor: `${colors.primary}18` },
                          ]}>
                          <Feather
                            name="check"
                            size={14}
                            color={colors.primary}
                          />
                        </View>
                        <Text
                          style={[
                            styles.featureText,
                            { color: colors.textMuted },
                          ]}>
                          {t(`subscription.features.${featureKey}`)}
                        </Text>
                      </View>
                    ))}
                  </View>

                </ScrollView>

                {(() => {
                  const activeSeats = usageData?.plan?.seats_purchased || usageData?.usage?.seats_purchased || 1;
                  const remainingDays = Math.max(1, usageData?.plan?.daysRemaining || 30);
                  const isPlanActive = (usageData?.plan?.daysRemaining || 0) > 0;
                  const isUpgrade = isPlanActive && selectedSeats > activeSeats;
                  const isDowngrade = isPlanActive && selectedSeats < activeSeats;
                  const isSeatChanged = selectedSeats !== activeSeats;
                  const addedSeats = selectedSeats - activeSeats;
                  const fullCycleCost = billingCycle === "annual" ? addedSeats * 99 * 12 : addedSeats * 159;
                  const dailyRatePerSeat = billingCycle === "annual" ? (99 * 12) / 365 : 159 / 30;
                  const proratedCost = Math.round(addedSeats * dailyRatePerSeat * remainingDays);
                  const calcTotal = isUpgrade
                    ? Math.max(1, Math.min(fullCycleCost, proratedCost))
                    : (billingCycle === "annual" ? selectedSeats * 99 * 12 : selectedSeats * 159);

                  const isCurrent = selectedPlan.name === plan.name;
                  const isDisabled = processingPayment || (isCurrent && !isSeatChanged);

                  let btnText = "";
                  if (processingPayment) {
                    btnText = t('subscription.processing') || "Processing...";
                  } else if (isEnterprisePlan(selectedPlan)) {
                    btnText = t('subscription.contactSales');
                  } else if (isUpgrade) {
                    btnText = `Upgrade to ${selectedSeats} Seats (₹${calcTotal.toLocaleString("en-IN")})`;
                  } else if (isDowngrade) {
                    btnText = `Update to ${selectedSeats} Seats (₹${calcTotal.toLocaleString("en-IN")})`;
                  } else if (isCurrent) {
                    btnText = t('subscription.currentPlan');
                  } else {
                    btnText = `Buy Plan (${selectedSeats} Seat${selectedSeats > 1 ? 's' : ''} · ₹${calcTotal.toLocaleString("en-IN")})`;
                  }

                  return (
                    <TouchableOpacity
                      style={[
                        styles.modalActionBtn,
                        {
                          backgroundColor: isDisabled
                            ? colors.surface
                            : colors.primary,
                          borderColor: colors.primary,
                        },
                      ]}
                      disabled={isDisabled}
                      onPress={() => handleUpgrade(selectedPlan)}>
                      {processingPayment ? (
                        <ActivityIndicator
                          size="small"
                          color={isDisabled ? colors.primary : "white"}
                        />
                      ) : (
                        <Text
                          style={[
                            styles.modalActionText,
                            {
                              color: isDisabled
                                ? colors.primary
                                : "white",
                            },
                          ]}>
                          {btnText}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })()}
              </>
            )}
          </View>
        </View>
      </Modal>

      <ProjectMemberManagementModal
        visible={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        targetSeats={selectedSeats}
        projects={validationProjects}
        onRefreshValidation={handleRefreshValidation}
        onProceed={async () => {
          setIsMemberModalOpen(false);
          if (pendingPlan) {
            await executeCheckout(pendingPlan);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  headerIconBtn: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "left",
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 4,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  planBadge: {
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 4,
  },
  planName: {
    fontSize: 28,
    fontWeight: "800",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  planDates: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 20,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 10,
    color: "#888",
    fontWeight: "600",
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#888",
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
    width: "100%",
  },
  usageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  usageLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  usageValue: {
    fontSize: 12,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    width: "100%",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 24,
    backgroundColor: "rgba(0,0,0,0.03)",
    paddingVertical: 12,
    borderRadius: 16,
  },
  toggleSwitch: {
    width: 48,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: "center",
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "white",
  },
  toggleCircleMonthly: {
    alignSelf: "flex-start",
  },
  toggleCircleAnnual: {
    alignSelf: "flex-end",
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  plansList: {
    gap: 12,
    marginBottom: 32,
  },

  availablePlanCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  availablePlanInfo: {
    flex: 1,
  },
  availablePlanName: {
    fontSize: 16,
    fontWeight: "800",
  },
  availablePlanSubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 6,
  },
  availablePlanPrice: {
    fontSize: 20,
    fontWeight: "900",
    color: "#f97316",
    marginTop: 2,
  },
  selectBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  selectBtnText: {
    fontSize: 13,
    fontWeight: "800",
  },
  supportLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 24,
    borderTopWidth: 1,
  },
  supportText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: "82%",
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(127,127,127,0.35)",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  modalPlanName: {
    fontSize: 24,
    fontWeight: "900",
  },
  modalPlanSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    flexGrow: 0,
  },
  modalContentInner: {
    paddingBottom: 12,
    gap: 14,
  },
  modalPriceCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  modalPriceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginBottom: 8,
  },
  modalPrice: {
    fontSize: 28,
    fontWeight: "900",
  },
  modalPeriod: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalMetaText: {
    fontSize: 12,
    marginTop: 4,
  },
  modalPayable: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 6,
  },
  featureCard: {
    borderRadius: 20,
    padding: 18,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 14,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  featureIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  modalActionBtn: {
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modalActionText: {
    fontSize: 15,
    fontWeight: "800",
  },
});
