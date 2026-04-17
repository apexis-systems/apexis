import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    TouchableOpacity,
    ScrollView,
    Image,
    ActivityIndicator,
    Alert,
    BackHandler,
} from "react-native";
import { Text } from "@/components/ui/AppText";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Project } from "@/types";
import {
    Snag,
    SnagStatus,
    getSnags,
    updateSnagStatus,
    deleteSnagApi,
} from "@/services/snagService";
import FullScreenImageModal from "@/components/shared/FullScreenImageModal";

interface Props {
    project: Project;
    initialSnagId?: string;
}

const STATUS_CONFIG: Record<
    SnagStatus,
    { icon: keyof typeof Feather.glyphMap; bg: string; label: string }
> = {
    amber: { icon: "minus", bg: "#f59e0b", label: "Waiting for Clearance" },
    green: { icon: "check", bg: "#22c55e", label: "Completed" },
    red: { icon: "x", bg: "#ef4444", label: "No Action Required" },
};
const STATUS_CYCLE: SnagStatus[] = ["amber", "green", "red"];

export default function ProjectSnagList({ project, initialSnagId }: Props) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const projectId = project.id;

    const [snags, setSnags] = useState<Snag[]>([]);
    const [loading, setLoading] = useState(true);
    // Photo viewer
    const [viewPhoto, setViewPhoto] = useState<string | null>(null);

    // ── Fetch data ─────────────────────────────────────────────────────────────

    useFocusEffect(
        useCallback(() => {
            if (projectId) {
                setLoading(true);
                getSnags(projectId)
                    .then((snags) => setSnags(snags))
                    .catch((e) => console.error("fetchSnags error", e))
                    .finally(() => setLoading(false));
            }

            const onBackPress = () => {
                if (viewPhoto) {
                    setViewPhoto(null);
                    return true;
                }
                return false;
            };

            const subscription = BackHandler.addEventListener(
                "hardwareBackPress",
                onBackPress,
            );
            return () => subscription.remove();
        }, [projectId, viewPhoto]),
    );

    // ── Status cycle ───────────────────────────────────────────────────────────

    const handleCycleStatus = async (snag: Snag) => {
        const idx = STATUS_CYCLE.indexOf(snag.status);
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
        setSnags((prev) =>
            prev.map((s) => (s.id === snag.id ? { ...s, status: next } : s)),
        );
        try {
            await updateSnagStatus(snag.id, next);
        } catch {
            setSnags((prev) =>
                prev.map((s) => (s.id === snag.id ? { ...s, status: snag.status } : s)),
            );
        }
    };

    // ── Open Add flow ──────────────────────────────────────────────────────────

    const openAddSnag = () => {
        router.push(`/(tabs)/project/snag-create?projectId=${projectId}`);
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
            {/* Add Snag button */}
            <TouchableOpacity
                onPress={openAddSnag}
                style={{
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 6,
                    marginBottom: 12,
                }}>
                <Feather name="plus" size={15} color="#fff" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "white" }}>
                    Add Snag
                </Text>
            </TouchableOpacity>

            {/* Snag list */}
            {loading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
            ) : (
                <View style={{ gap: 8 }}>
                    {snags.map((snag) => {
                        const cfg = STATUS_CONFIG[snag.status];
                        const isTarget =
                            initialSnagId && String(snag.id) === String(initialSnagId);
                        return (
                            <View
                                key={snag.id}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "flex-start",
                                    gap: 10,
                                    borderRadius: 12,
                                    borderWidth: isTarget ? 2 : 1,
                                    borderColor: isTarget ? colors.primary : colors.border,
                                    backgroundColor: colors.background,
                                    padding: 12,
                                    // Soft shadow if targeted
                                    ...(isTarget
                                        ? {
                                            shadowColor: colors.primary,
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 4,
                                            elevation: 3,
                                        }
                                        : {}),
                                }}>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (String(snag.assigned_to) === String(user?.id)) {
                                            handleCycleStatus(snag);
                                        } else {
                                            Alert.alert("Permission Denied", "Only the assigned person can update the status");
                                        }
                                    }}
                                    style={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: 13,
                                        backgroundColor: cfg.bg,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginTop: 1,
                                        opacity: String(snag.assigned_to) === String(user?.id) ? 1 : 0.6,
                                    }}>
                                    <Feather name={cfg.icon} size={13} color="#fff" />
                                </TouchableOpacity>
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontWeight: "700",
                                            color: colors.text,
                                        }}>
                                        {snag.title}
                                    </Text>
                                    {snag.description ? (
                                        <Text
                                            numberOfLines={2}
                                            style={{
                                                fontSize: 10,
                                                color: colors.textMuted,
                                                marginTop: 2,
                                            }}>
                                            {snag.description}
                                        </Text>
                                    ) : null}
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                                        <Text style={{ fontSize: 10, color: colors.textMuted }}>
                                            To: <Text style={{ color: colors.text, fontWeight: '600' }}>{snag.assignee?.name || "Unassigned"}</Text>
                                        </Text>
                                        <Text style={{ fontSize: 10, color: colors.textMuted }}>
                                            By: <Text style={{ color: colors.text, fontWeight: '600' }}>{snag.creator?.name || "—"}</Text>
                                        </Text>
                                    </View>
                                    <Text
                                        style={{
                                            fontSize: 10,
                                            color: colors.textMuted,
                                            marginTop: 2,
                                        }}>
                                        {cfg.label}
                                    </Text>
                                    {snag.last_comment ? (
                                        <View
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: 4,
                                                marginTop: 4,
                                            }}>
                                            <Feather name="message-square" size={10} color="#555" />
                                            <Text
                                                numberOfLines={1}
                                                style={{ fontSize: 9, color: colors.textMuted }}>
                                                {snag.last_comment}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                                {snag.creator?.id &&
                                    user?.id &&
                                    String(snag.creator.id) === String(user.id) && (
                                        <TouchableOpacity
                                            onPress={async () => {
                                                Alert.alert("Delete", `Remove "${snag.title}"?`, [
                                                    { text: "Cancel", style: "cancel" },
                                                    {
                                                        text: "Delete",
                                                        style: "destructive",
                                                        onPress: async () => {
                                                            try {
                                                                await deleteSnagApi(snag.id);
                                                                setSnags((prev) =>
                                                                    prev.filter((s) => s.id !== snag.id),
                                                                );
                                                            } catch {
                                                                Alert.alert("Error", "Failed to delete");
                                                            }
                                                        },
                                                    },
                                                ]);
                                            }}
                                            style={{ padding: 4 }}>
                                            <Feather name="trash-2" size={14} color="#ef4444" />
                                        </TouchableOpacity>
                                    )}
                                {snag.photoDownloadUrl || snag.photo_url ? (
                                    <TouchableOpacity
                                        onPress={() =>
                                            setViewPhoto(snag.photoDownloadUrl || snag.photo_url!)
                                        }
                                        style={{
                                            width: 56,
                                            height: 56,
                                            borderRadius: 8,
                                            overflow: "hidden",
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                        }}>
                                        <Image
                                            source={{ uri: snag.photoDownloadUrl || snag.photo_url }}
                                            style={{ width: "100%", height: "100%" }}
                                            resizeMode="cover"
                                        />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        );
                    })}
                    {snags.length === 0 && (
                        <View style={{ marginTop: 30, alignItems: "center" }}>
                            <Feather name="check-square" size={32} color={colors.border} />
                            <Text
                                style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
                                No snags yet
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* ── Photo viewer ───────────────────────────────────────────────── */}
            <FullScreenImageModal
                visible={!!viewPhoto}
                onClose={() => setViewPhoto(null)}
                uri={viewPhoto}
            />
        </ScrollView>
    );
}
