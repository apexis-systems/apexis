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
  cancelAutoPay,
} from "@/services/subscriptionService";
import { ProjectMemberManagementModal } from "@/components/subscription/ProjectMemberManagementModal";
import { SubscriptionNoticeModal } from "@/components/subscription/SubscriptionNoticeModal";
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
  const [cancellingAutoPay, setCancellingAutoPay] = useState(false);
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

  // Subscription change notice modal state
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [pendingNoticePlan, setPendingNoticePlan] = useState<any | null>(null);

  const handleRefreshValidation = async () => {
    try {
      const res = await validateSeatChange(selectedSeats);
      setValidationProjects(res.projects || []);
      return res;
    } catch (error) {
      console.error("Error refreshing mobile seat validation", error);
    }
  };

  const handleCancelAutoPay = () => {
    Alert.alert(
      "Cancel AutoPay",
      "Are you sure you want to cancel Razorpay AutoPay? Your current plan will remain active until the end of the billing cycle.",
      [
        { text: "Keep AutoPay", style: "cancel" },
        {
          text: "Cancel AutoPay",
          style: "destructive",
          onPress: async () => {
            setCancellingAutoPay(true);
            try {
              const res = await cancelAutoPay();
              if (res.success) {
                Alert.alert("Success", res.message || "AutoPay cancelled successfully.");
                await refreshUsage();
              } else {
                Alert.alert("Error", res.error || "Failed to cancel AutoPay");
              }
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.error || "Failed to cancel AutoPay");
            } finally {
              setCancellingAutoPay(false);
            }
          },
        },
      ]
    );
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
      const currentPlanName = usageData?.plan?.name || usageData?.usage?.plan_name || "";
      const isPaidPlan = Boolean(currentPlanName && !["freemium", "free"].includes(currentPlanName.toLowerCase()));
      const currentSeats = usageData?.plan?.seats_purchased || usageData?.usage?.seats_purchased || 1;
      const remainingDays = Math.max(1, usageData?.plan?.daysRemaining || 30);
      const isPlanActive = isPaidPlan && (usageData?.plan?.daysRemaining || 0) > 0;
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

      if (orderData?.is_downgrade && !orderData?.is_subscription) {
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

      let options: any = {
        description: isUpgrade ? `Add ${selectedSeats - currentSeats} Seats (${remainingDays} days remaining)` : `${plan.name} AutoPay Subscription`,
        image: appIconUri,
        key: razorpayKey,
        name: "Apexis",
        prefill: {
          email: user?.email || "",
          contact: user?.phone_number || "",
          name: user?.name || "",
        },
        theme: { color: colors.primary },
      };

      if (orderData.is_subscription) {
        // AutoPay Subscription Checkout
        options.subscription_id = orderData.subscriptionId;
      } else if (orderData.order?.id) {
        // One-time order for prorated seat upgrade
        options.order_id = orderData.order.id;
        options.currency = "INR";
        options.amount = orderData.order.amount;
      } else {
        throw new Error("Invalid payment order/subscription response from server.");
      }

      const data: any = await RazorpayCheckout.open(options);

      try {
        await verifyPayment({
          razorpay_order_id: data.razorpay_order_id,
          razorpay_subscription_id: data.razorpay_subscription_id || orderData.subscriptionId,
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
        Alert.alert(t('common.success') || 'Success', t('subscription.successUpgrade') || "Payment verified! Razorpay AutoPay active.");
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

      const currentPlanName = usageData?.plan?.name || usageData?.usage?.plan_name || "";
      const isPaidPlan = Boolean(currentPlanName && !["freemium", "free"].includes(currentPlanName.toLowerCase()));
      const currentSeats = usageData?.plan?.seats_purchased || usageData?.usage?.seats_purchased || 1;
      const isPlanActive = isPaidPlan && (usageData?.plan?.daysRemaining || 0) > 0;
      const activeCycle = usageData?.plan?.subscription_cycle || user?.organization?.subscription_cycle || "monthly";
      const isCycleChanged = activeCycle !== billingCycle;
      const isSeatChanged = selectedSeats !== currentSeats;

      if (isPlanActive && (isCycleChanged || isSeatChanged)) {
        setPendingNoticePlan(plan);
        setIsNoticeModalOpen(true);
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
  const isAutoPayActive = plan.auto_pay_enabled || false;
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

          {/* AutoPay Status & Cancel Button */}
          <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: `${colors.primary}20`, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name={isAutoPayActive ? "refresh-cw" : "minus-circle"} size={14} color={isAutoPayActive ? "#10B981" : colors.textMuted} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: isAutoPayActive ? "#10B981" : colors.textMuted }}>
                {isAutoPayActive ? `AutoPay Active (${plan.subscription_cycle === "annual" ? "Annual" : "Monthly"})` : "AutoPay Inactive"}
              </Text>
            </View>

            {/* {isAutoPayActive && (
              <TouchableOpacity
                disabled={cancellingAutoPay}
                onPress={handleCancelAutoPay}
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "#EF444415", borderWidth: 1, borderColor: "#EF444430" }}>
                {cancellingAutoPay ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#EF4444" }}>Cancel AutoPay</Text>
                )}
              </TouchableOpacity>
            )} */}
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
                      const currentPlanName = usageData?.plan?.name || usageData?.usage?.plan_name || "";
                      const isPaidPlan = Boolean(currentPlanName && !["freemium", "free"].includes(currentPlanName.toLowerCase()));
                      const activeSeats = usageData?.plan?.seats_purchased || usageData?.usage?.seats_purchased || 1;
                      const remainingDays = Math.max(1, usageData?.plan?.daysRemaining || 30);
                      const isPlanActive = isPaidPlan && (usageData?.plan?.daysRemaining || 0) > 0;
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
                  const currentPlanName = usageData?.plan?.name || usageData?.usage?.plan_name || "";
                  const activeCycle = usageData?.plan?.subscription_cycle || "monthly";
                  const isPaidPlan = Boolean(currentPlanName && !["freemium", "free"].includes(currentPlanName.toLowerCase()));
                  const activeSeats = usageData?.plan?.seats_purchased || usageData?.usage?.seats_purchased || 1;
                  const remainingDays = Math.max(1, usageData?.plan?.daysRemaining || 30);
                  const isPlanActive = isPaidPlan && (usageData?.plan?.daysRemaining || 0) > 0;

                  const isCurrentPlanName = selectedPlan.name === plan.name;
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
                  const calcTotal = isUpgrade
                    ? Math.max(1, Math.min(fullCycleCost, proratedCost))
                    : (billingCycle === "annual" ? selectedSeats * 99 * 12 : selectedSeats * 159);

                  const isDisabled = processingPayment || isCurrentPlan;

                  let btnText = "";
                  if (processingPayment) {
                    btnText = t('subscription.processing') || "Processing...";
                  } else if (isEnterprisePlan(selectedPlan)) {
                    btnText = t('subscription.contactSales');
                  } else if (isCurrentPlanName && isCycleChanged) {
                    btnText = billingCycle === "annual"
                      ? `Switch to Annual Plan (₹${(selectedSeats * 99 * 12).toLocaleString("en-IN")}/yr)`
                      : `Switch to Monthly Plan (₹${(selectedSeats * 159).toLocaleString("en-IN")}/mo)`;
                  } else if (isCurrentPlanName && isUpgrade) {
                    btnText = `Upgrade to ${selectedSeats} Seats (₹${calcTotal.toLocaleString("en-IN")})`;
                  } else if (isCurrentPlanName && isDowngrade) {
                    btnText = `Update to ${selectedSeats} Seats (₹${calcTotal.toLocaleString("en-IN")})`;
                  } else if (isCurrentPlan) {
                    btnText = t('subscription.currentPlan');
                  } else {
                    btnText = `Subscribe with AutoPay (${selectedSeats} Seat${selectedSeats > 1 ? 's' : ''} · ₹${calcTotal.toLocaleString("en-IN")})`;
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
        <ProjectMemberManagementModal
          visible={isMemberModalOpen}
          onClose={() => setIsMemberModalOpen(false)}
          targetSeats={selectedSeats}
          projects={validationProjects}
          onRefreshValidation={handleRefreshValidation}
          onProceed={async () => {
            setIsMemberModalOpen(false);
            if (pendingPlan) {
              const currentPlanName = usageData?.plan?.name || usageData?.usage?.plan_name || "";
              const isPaidPlan = Boolean(currentPlanName && !["freemium", "free"].includes(currentPlanName.toLowerCase()));
              const currentSeats = usageData?.plan?.seats_purchased || usageData?.usage?.seats_purchased || 1;
              const isPlanActive = isPaidPlan && (usageData?.plan?.daysRemaining || 0) > 0;
              const activeCycle = usageData?.plan?.subscription_cycle || user?.organization?.subscription_cycle || "monthly";
              const isCycleChanged = activeCycle !== billingCycle;
              const isSeatChanged = selectedSeats !== currentSeats;
              if (isPlanActive && (isCycleChanged || isSeatChanged)) {
                setPendingNoticePlan(pendingPlan);
                setIsNoticeModalOpen(true);
              } else {
                await executeCheckout(pendingPlan);
              }
            }
          }}
        />

        <SubscriptionNoticeModal
          visible={isNoticeModalOpen}
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
          currentSeats={usageData?.plan?.seats_purchased || usageData?.usage?.seats_purchased || 1}
          currentCycle={usageData?.plan?.subscription_cycle || user?.organization?.subscription_cycle || "monthly"}
          isUpgrade={Boolean(usageData?.plan?.daysRemaining && usageData.plan.daysRemaining > 0 && selectedSeats > (usageData?.plan?.seats_purchased || 1))}
          isDowngrade={Boolean(usageData?.plan?.daysRemaining && usageData.plan.daysRemaining > 0 && selectedSeats < (usageData?.plan?.seats_purchased || 1))}
          isCycleChanged={Boolean(usageData?.plan?.daysRemaining && usageData.plan.daysRemaining > 0 && (usageData?.plan?.subscription_cycle || user?.organization?.subscription_cycle || "monthly") !== billingCycle)}
          planEndDate={usageData?.plan?.endDate || usageData?.plan?.subscription_plan_end_date || user?.organization?.plan_end_date || user?.organization?.subscription_plan_end_date}
          proratedAmount={(() => {
            const currentSeats = usageData?.plan?.seats_purchased || usageData?.usage?.seats_purchased || 1;
            const remainingDays = Math.max(1, usageData?.plan?.daysRemaining || 30);
            const isPaidPlan = Boolean(usageData?.plan?.name && !["freemium", "free"].includes(String(usageData.plan.name).toLowerCase()));
            const isPlanActive = isPaidPlan && (usageData?.plan?.daysRemaining || 0) > 0;
            if (isPlanActive && selectedSeats > currentSeats) {
              const addedSeats = selectedSeats - currentSeats;
              const fullCycleCost = billingCycle === "annual" ? addedSeats * 99 * 12 : addedSeats * 159;
              const dailyRatePerSeat = billingCycle === "annual" ? (99 * 12) / 365 : 159 / 30;
              const proratedCost = Math.round(addedSeats * dailyRatePerSeat * remainingDays);
              return Math.max(1, Math.min(fullCycleCost, proratedCost));
            }
            return 0;
          })()}
        />
      </Modal>


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
    alignItems: "flex-start",
  },
  planBadge: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  planName: {
    fontSize: 24,
    fontWeight: "800",
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  planDates: {
    flexDirection: "row",
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.05)",
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    gap: 12,
  },
  toggleLabel: {
    fontSize: 14,
    color: "#64748B",
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: "center",
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "white",
  },
  toggleCircleMonthly: {
    alignSelf: "flex-start",
  },
  toggleCircleAnnual: {
    alignSelf: "flex-end",
  },
  plansList: {
    gap: 16,
  },
  availablePlanCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  availablePlanInfo: {
    flex: 1,
  },
  availablePlanName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  availablePlanSubtitle: {
    fontSize: 12,
    marginBottom: 8,
  },
  availablePlanPrice: {
    fontSize: 22,
    fontWeight: "800",
  },
  selectBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  selectBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  supportLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
  },
  supportText: {
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 20,
    maxHeight: "85%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  modalPlanName: {
    fontSize: 20,
    fontWeight: "800",
  },
  modalPlanSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    flexGrow: 0,
  },
  modalContentInner: {
    paddingBottom: 16,
  },
  modalPriceCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  modalPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  modalPrice: {
    fontSize: 28,
    fontWeight: "800",
  },
  modalPeriod: {
    fontSize: 14,
    marginLeft: 6,
  },
  featureCard: {
    borderRadius: 16,
    padding: 16,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  featureIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 13,
    flex: 1,
  },
  modalActionBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginTop: 16,
  },
  modalActionText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
