import React, { useState, useEffect } from "react";
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
} from "@/services/subscriptionService";
import { getMe } from "@/services/authService";
let RazorpayCheckout: any = null;
try {
    RazorpayCheckout = require("react-native-razorpay").default;
} catch {
    // Not available in Expo Go — requires a development build
}

const PLAN_ORDER = ["One-Time Buy", "Starter", "Professional", "Enterprise"];
const GST_RATE = 0.18;
const PLAN_PERIOD_MAP: Record<string, string> = {
  "One-Time Buy": "",
  Starter: "/mo",
  Professional: "/mo",
  Enterprise: "",
};

const isEnterprisePlan = (plan: any): boolean => {
  const name = String(plan?.name || "")
    .trim()
    .toLowerCase();
  return name === "enterprise" || Number(plan?.price) >= 999999;
};

const PLAN_DETAILS: Record<
  string,
  {
    subtitle: string;
    validity?: string;
    trial?: string;
    features: string[];
  }
> = {
  "One-Time Buy": {
    subtitle: "Single project access",
    validity: "Valid for 90 days",
    trial: "14 Day Free Trial",
    features: [
      "Single Project Access",
      "Client Viewership",
      "Basic Reporting",
      "5GB Cloud Storage",
      "One-time purchase",
      "Snag List Feature",
      "Drawings Release to Site",
      "Multi-lingual Support (English, Hindi & Telugu)",
      "14-Day Free Trial",
      "Secure Data Storage",
    ],
  },
  Starter: {
    subtitle: "Up to 5 projects",
    trial: "14 Day Free Trial",
    features: [
      "Up to 5 Projects",
      "Client Viewership",
      "Structured Reporting",
      "25GB Cloud Storage",
      "Basic Project Dashboard",
      "Snag List Feature",
      "Drawings Release to Site",
      "Multi-lingual Support (English, Hindi & Telugu)",
      "14-Day Free Trial",
      "Secure Data Storage",
    ],
  },
  Professional: {
    subtitle: "Up to 10 projects",
    trial: "14 Day Free Trial",
    features: [
      "Up to 10 Projects",
      "Client Viewership",
      "AI-Assisted Reports",
      "Role-Based Access",
      "100GB Cloud Storage",
      "Media Documentation",
      "Priority Support",
      "Snag List Feature",
      "Drawings Release to Site",
      "Multi-lingual Support (English, Hindi & Telugu)",
      "14-Day Free Trial",
      "Secure Data Storage",
    ],
  },
  Enterprise: {
    subtitle: "Above 10 projects",
    trial: "14 Day Free Trial",
    features: [
      "Above 10 Projects",
      "Client Viewership",
      "Custom Workflows",
      "Custom Onboarding",
      "Dedicated Support",
      "Custom Integrations",
      "Above 100GB Cloud Storage",
      "Snag List Feature",
      "Drawings Release to Site",
      "Multi-lingual Support (English, Hindi & Telugu)",
      "14-Day Free Trial",
      "Secure Data Storage",
    ],
  },
};

const gstAmount = (baseAmount: number): number =>
  Number((baseAmount * GST_RATE).toFixed(2));
const payableAmount = (baseAmount: number): number =>
  Number((baseAmount + gstAmount(baseAmount)).toFixed(2));

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { usageData, loading: usageLoading, refreshUsage } = useUsage();
  const { user, updateUser } = useAuth() as any;

  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const appIconUri = Image.resolveAssetSource(
    require("../assets/images/app-icon.png"),
  ).uri;

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setPlansLoading(true);
    try {
      const data = await getPlans();
      const filtered = data.filter((p: any) => PLAN_ORDER.includes(p.name));
      const sorted = filtered.sort(
        (a: any, b: any) =>
          PLAN_ORDER.indexOf(a.name) - PLAN_ORDER.indexOf(b.name),
      );
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
      Linking.openURL(
        "mailto:support@apexis.in?subject=Enterprise Plan Inquiry",
      );
      return;
    }
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
      const basePrice = Number(plan.price) || 0;
      const amount = basePrice;

      const orderData = await createOrder({
        amount,
        currency: "INR",
        plan_name: plan.name,
        plan_cycle: "monthly",
      });

      if (!orderData?.order?.id || !orderData.order.amount) {
        throw new Error("Invalid payment order received from server.");
      }

      const options = {
        description: `${plan.name} Subscription`,
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
          plan_cycle: "monthly",
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
        Alert.alert("Success", "Your plan has been upgraded successfully!");
      } catch (e: any) {
        const message =
          e?.response?.data?.message ||
          e?.message ||
          "Payment verification failed. Please contact support.";
        Alert.alert("Error", message);
      }
    } catch (error: any) {
      // Razorpay cancellation code in RN SDK.
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
        error?.response?.data?.error?.description ||
        error?.message ||
        "Failed to initiate payment";
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
  const selectedPlanDetails = selectedPlan
    ? PLAN_DETAILS[selectedPlan.name] || {
        subtitle: "Subscription plan",
        features: [],
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
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerIconBtn}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Subscription & Plans
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
                CURRENT ACTIVE PLAN
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
              <Text style={styles.dateLabel}>RENEWAL DATE</Text>
              <Text style={[styles.dateValue, { color: colors.text }]}>
                {new Date(plan.endDate).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>DAYS REMAINING</Text>
              <Text
                style={[
                  styles.dateValue,
                  {
                    color:
                      plan.daysRemaining < 10 ? colors.primary : colors.text,
                  },
                ]}>
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
            const basePrice = Number(p.price) || 0;
            const price = basePrice;
            const isEnterprise = isEnterprisePlan(p);
            const period = PLAN_PERIOD_MAP[p.name] || "";
            const buttonLabel = isCurrent
              ? "Current"
              : isEnterprise
                ? "Contact Sales"
                : "View Details";

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
                    {PLAN_DETAILS[p.name]?.subtitle || "Tap to view benefits"}
                  </Text>
                  <View
                    style={{ flexDirection: "row", alignItems: "baseline" }}>
                    <Text
                      style={[
                        styles.availablePlanPrice,
                        { color: colors.primary },
                      ]}>
                      {isEnterprise
                        ? "Custom"
                        : `₹${price.toLocaleString("en-IN")}`}
                    </Text>
                    {!!period && (
                      <Text
                        style={{
                          fontSize: 12,
                          color: colors.textMuted,
                          marginLeft: 4,
                        }}>
                        {period}
                      </Text>
                    )}
                  </View>
                  {!isEnterprise && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textMuted,
                        marginTop: 2,
                      }}>
                      ₹{basePrice.toLocaleString("en-IN")} + 18% GST
                    </Text>
                  )}
                  {!isEnterprise && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.text,
                        marginTop: 2,
                        fontWeight: "700",
                      }}>
                      Payable: ₹
                      {payableAmount(basePrice).toLocaleString("en-IN")}
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
            Having issues? Contact Support
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
                      {selectedPlanDetails.subtitle}
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
                          ? "Custom Pricing"
                          : `₹${Number(selectedPlan.price || 0).toLocaleString("en-IN")}`}
                      </Text>
                      {!!PLAN_PERIOD_MAP[selectedPlan.name] &&
                        !isEnterprisePlan(selectedPlan) && (
                          <Text
                            style={[
                              styles.modalPeriod,
                              { color: colors.textMuted },
                            ]}>
                            {PLAN_PERIOD_MAP[selectedPlan.name]}
                          </Text>
                        )}
                    </View>
                    {!!selectedPlanDetails.validity && (
                      <Text
                        style={[
                          styles.modalMetaText,
                          { color: colors.textMuted },
                        ]}>
                        {selectedPlanDetails.validity}
                      </Text>
                    )}
                    {!!selectedPlanDetails.trial && (
                      <Text
                        style={[
                          styles.modalMetaText,
                          { color: colors.textMuted },
                        ]}>
                        {selectedPlanDetails.trial}
                      </Text>
                    )}
                    {!isEnterprisePlan(selectedPlan) && (
                      <>
                        <Text
                          style={[
                            styles.modalMetaText,
                            { color: colors.textMuted },
                          ]}>
                          Base: ₹
                          {Number(selectedPlan.price || 0).toLocaleString(
                            "en-IN",
                          )}{" "}
                          + 18% GST
                        </Text>
                        <Text
                          style={[styles.modalPayable, { color: colors.text }]}>
                          Payable: ₹
                          {payableAmount(
                            Number(selectedPlan.price || 0),
                          ).toLocaleString("en-IN")}
                        </Text>
                      </>
                    )}
                  </View>

                  <View
                    style={[
                      styles.featureCard,
                      { backgroundColor: colors.surface },
                    ]}>
                    <Text
                      style={[styles.featureTitle, { color: colors.text }]}>
                      What you get
                    </Text>
                    {selectedPlanDetails.features.map((feature) => (
                      <View key={feature} style={styles.featureRow}>
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
                          {feature}
                        </Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={[
                    styles.modalActionBtn,
                    {
                      backgroundColor:
                        selectedPlan.name === plan.name
                          ? colors.surface
                          : colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                  disabled={
                    processingPayment || selectedPlan.name === plan.name
                  }
                  onPress={() => handleUpgrade(selectedPlan)}>
                  {processingPayment ? (
                    <ActivityIndicator
                      size="small"
                      color={selectedPlan.name === plan.name ? colors.primary : "white"}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.modalActionText,
                        {
                          color:
                            selectedPlan.name === plan.name
                              ? colors.primary
                              : "white",
                        },
                      ]}>
                      {selectedPlan.name === plan.name
                        ? "Current Plan"
                        : isEnterprisePlan(selectedPlan)
                          ? "Contact Sales"
                          : "Buy Plan"}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
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
  cycleContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  cycleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  cycleText: {
    fontSize: 12,
    fontWeight: "700",
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
