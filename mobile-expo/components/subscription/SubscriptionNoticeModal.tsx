import React from "react";
import {
  Modal,
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";

interface SubscriptionNoticeModalProps {
  visible: boolean;
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
  visible,
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
  const { colors, isDark } = useTheme();

  if (!visible) return null;

  const formattedEndDate = planEndDate
    ? new Date(planEndDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "the end of your current cycle";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              borderColor: isDark ? "#334155" : "#E2E8F0",
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={[styles.iconWrap, { backgroundColor: "rgba(255, 138, 61, 0.15)" }]}>
              <Feather name="info" size={24} color="#FF8A3D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: isDark ? "#F8FAFC" : "#0F172A" }]}>
                Subscription Update Notice
              </Text>
              <Text style={[styles.subtitle, { color: isDark ? "#94A3B8" : "#64748B" }]}>
                Please review how Razorpay processes plan updates
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={isDark ? "#94A3B8" : "#64748B"} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {/* Target Plan Summary */}
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                },
              ]}
            >
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: isDark ? "#94A3B8" : "#64748B" }]}>
                  New Target Plan:
                </Text>
                <Text style={[styles.infoValue, { color: isDark ? "#F8FAFC" : "#0F172A" }]}>
                  {planName} ({targetSeats} Seats · {billingCycle === "annual" ? "Annual" : "Monthly"})
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: isDark ? "#94A3B8" : "#64748B" }]}>
                  Current Status:
                </Text>
                <Text style={[styles.infoValue, { color: isDark ? "#94A3B8" : "#64748B" }]}>
                  {currentSeats} Seats ({currentCycle})
                </Text>
              </View>
              {isUpgrade && proratedAmount && proratedAmount > 0 ? (
                <View style={[styles.infoRow, styles.proratedRow]}>
                  <Text style={{ color: "#FF8A3D", fontSize: 13, fontWeight: "600" }}>
                    Prorated Mid-Cycle Charge:
                  </Text>
                  <Text style={{ color: "#FF8A3D", fontSize: 14, fontWeight: "800" }}>
                    ₹{proratedAmount.toLocaleString("en-IN")}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Expected Razorpay Emails Alert */}
            <View style={[styles.alertBanner, { backgroundColor: "rgba(245, 158, 11, 0.12)", borderColor: "rgba(245, 158, 11, 0.3)" }]}>
              <View style={styles.alertHeader}>
                <Feather name="mail" size={16} color="#D97706" />
                <Text style={styles.alertTitle}>Expected Razorpay Emails</Text>
              </View>
              <Text style={[styles.alertText, { color: isDark ? "#CBD5E1" : "#334155" }]}>
                Razorpay will send you <Text style={{ fontWeight: "700" }}>two automated emails</Text>:
              </Text>
              <View style={styles.bulletList}>
                <Text style={[styles.bulletItem, { color: isDark ? "#CBD5E1" : "#475569" }]}>
                  • <Text style={{ fontWeight: "700" }}>1. Cancellation Email:</Text> Confirms that your previous AutoPay mandate was updated/replaced.
                </Text>
                <Text style={[styles.bulletItem, { color: isDark ? "#CBD5E1" : "#475569" }]}>
                  • <Text style={{ fontWeight: "700" }}>2. Activation Email:</Text> Confirms your new AutoPay mandate for {targetSeats} seats.
                </Text>
              </View>
              <Text style={styles.alertFooter}>
                ✨ Don't worry—your active days are safe and won't be lost!
              </Text>
            </View>

            {/* Renewal Note */}
            <View style={[styles.noteBanner, { backgroundColor: "rgba(59, 130, 246, 0.12)", borderColor: "rgba(59, 130, 246, 0.25)" }]}>
              <Feather name="clock" size={16} color="#3B82F6" style={{ marginTop: 2 }} />
              <Text style={[styles.noteText, { color: isDark ? "#93C5FD" : "#1D4ED8" }]}>
                {isUpgrade
                  ? `Your new ${billingCycle} plan will automatically renew starting ${formattedEndDate}.`
                  : `Your updated plan & seat mandate will take effect automatically on ${formattedEndDate} when your current period completes.`}
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.btnCancel,
                {
                  borderColor: isDark ? "#334155" : "#CBD5E1",
                  backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                },
              ]}
            >
              <Text style={[styles.btnCancelText, { color: isDark ? "#F8FAFC" : "#0F172A" }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onConfirm} style={styles.btnConfirm}>
              <Text style={styles.btnConfirmText}>Proceed to Payment</Text>
              <Feather name="arrow-right" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  proratedRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 138, 61, 0.2)",
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  alertBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#D97706",
  },
  alertText: {
    fontSize: 12,
    marginBottom: 6,
  },
  bulletList: {
    gap: 4,
    marginBottom: 8,
  },
  bulletItem: {
    fontSize: 12,
    lineHeight: 16,
  },
  alertFooter: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
  },
  noteBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 14,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  btnCancel: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  btnCancelText: {
    fontSize: 13,
    fontWeight: "700",
  },
  btnConfirm: {
    backgroundColor: "#FF8A3D",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnConfirmText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
