import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
    View, Text, TouchableOpacity, Modal, TextInput, ScrollView,
    Image, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Project } from '@/types';
import {
    Snag, Assignee, SnagStatus,
    getSnags, getAssignees, updateSnagStatus, deleteSnagApi,
} from '@/services/snagService';

interface Props { project: Project; }

const STATUS_CONFIG: Record<SnagStatus, { icon: keyof typeof Feather.glyphMap; bg: string; label: string }> = {
    amber: { icon: 'minus', bg: '#f59e0b', label: 'Waiting clearance' },
    green: { icon: 'check', bg: '#22c55e', label: 'Completed' },
    red: { icon: 'x', bg: '#ef4444', label: 'No action needed' },
};
const STATUS_CYCLE: SnagStatus[] = ['amber', 'green', 'red'];

// Step: 'camera' = show full-screen camera, 'details' = show snag form
type SnagStep = 'camera' | 'details';

export default function ProjectSnagList({ project }: Props) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const projectId = (project as any)?.id;

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
                    .then(snags => setSnags(snags))
                    .catch(e => console.error('fetchSnags error', e))
                    .finally(() => setLoading(false));
            }
        }, [projectId])
    );

    // ── Status cycle ───────────────────────────────────────────────────────────

    const handleCycleStatus = async (snag: Snag) => {
        const idx = STATUS_CYCLE.indexOf(snag.status);
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
        setSnags((prev) => prev.map((s) => s.id === snag.id ? { ...s, status: next } : s));
        try { await updateSnagStatus(snag.id, next); }
        catch { setSnags((prev) => prev.map((s) => s.id === snag.id ? { ...s, status: snag.status } : s)); }
    };

    // ── Open Add flow ──────────────────────────────────────────────────────────

    const openAddSnag = () => {
        router.push(`/(tabs)/project/snag-create?projectId=${projectId}`);
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
            {/* Add Snag button */}
            {user?.role !== 'client' && (
                <TouchableOpacity
                    onPress={openAddSnag}
                    style={{ height: 38, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, marginBottom: 12 }}
                >
                    <Feather name="plus" size={15} color="#fff" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>Add Snag</Text>
                </TouchableOpacity>
            )}

            {/* Snag list */}
            {loading ? (
                <ActivityIndicator color="#f97316" style={{ marginTop: 30 }} />
            ) : (
                <View style={{ gap: 8 }}>
                    {snags.map((snag) => {
                        const cfg = STATUS_CONFIG[snag.status];
                        return (
                            <View
                                key={snag.id}
                                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 12 }}
                            >
                                <TouchableOpacity
                                    onPress={() => handleCycleStatus(snag)}
                                    style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: cfg.bg, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}
                                >
                                    <Feather name={cfg.icon} size={13} color="#fff" />
                                </TouchableOpacity>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{snag.title}</Text>
                                    {snag.description ? (
                                        <Text numberOfLines={2} style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{snag.description}</Text>
                                    ) : null}
                                    <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                                        Assigned: {snag.assignee?.name || 'Unassigned'} · {cfg.label}
                                    </Text>
                                    {snag.last_comment ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                            <Feather name="message-square" size={10} color="#555" />
                                            <Text numberOfLines={1} style={{ fontSize: 9, color: colors.textMuted }}>{snag.last_comment}</Text>
                                        </View>
                                    ) : null}
                                </View>
                                {(String(snag.creator?.id) === String(user?.id)) && (
                                    <TouchableOpacity
                                        onPress={async () => {
                                            Alert.alert('Delete', `Remove "${snag.title}"?`, [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'Delete', style: 'destructive',
                                                    onPress: async () => {
                                                        try {
                                                            await deleteSnagApi(snag.id);
                                                            setSnags((prev) => prev.filter((s) => s.id !== snag.id));
                                                        } catch { Alert.alert('Error', 'Failed to delete'); }
                                                    }
                                                }
                                            ]);
                                        }}
                                        style={{ padding: 4 }}
                                    >
                                        <Feather name="trash-2" size={14} color="#ef4444" />
                                    </TouchableOpacity>
                                )}
                                {(snag.photoDownloadUrl || snag.photo_url) ? (
                                    <TouchableOpacity
                                        onPress={() => setViewPhoto(snag.photoDownloadUrl || snag.photo_url!)}
                                        style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}
                                    >
                                        <Image
                                            source={{ uri: snag.photoDownloadUrl || snag.photo_url }}
                                            style={{ width: '100%', height: '100%' }}
                                            resizeMode="cover"
                                        />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        );
                    })}
                    {snags.length === 0 && (
                        <View style={{ marginTop: 30, alignItems: 'center' }}>
                            <Feather name="check-square" size={32} color={colors.border} />
                            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No snags yet</Text>
                        </View>
                    )}
                </View>
            )}



            {/* ── Photo viewer ───────────────────────────────────────────────── */}
            <Modal visible={!!viewPhoto} transparent animationType="fade" onRequestClose={() => setViewPhoto(null)}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={1} onPress={() => setViewPhoto(null)}>
                    {viewPhoto && (
                        <Image source={{ uri: viewPhoto }} style={{ width: '90%', aspectRatio: 1 }} resizeMode="contain" />
                    )}
                    <TouchableOpacity onPress={() => setViewPhoto(null)} style={{ position: 'absolute', top: 48, right: 16, padding: 8 }}>
                        <Feather name="x" size={24} color="#fff" />
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </ScrollView>
    );
}
