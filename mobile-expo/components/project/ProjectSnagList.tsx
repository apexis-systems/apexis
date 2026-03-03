import { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, Modal, TextInput, ScrollView,
    Image, ActivityIndicator, Alert, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Project } from '@/types';
import {
    Snag, Assignee, SnagStatus,
    getSnags, getAssignees, createSnag, updateSnagStatus, deleteSnagApi,
} from '@/services/snagService';

interface Props { project: Project; }

const STATUS_CONFIG: Record<SnagStatus, { icon: keyof typeof Feather.glyphMap; bg: string; label: string }> = {
    amber: { icon: 'minus', bg: '#f59e0b', label: 'Waiting clearance' },
    green: { icon: 'check', bg: '#22c55e', label: 'Completed' },
    red: { icon: 'x', bg: '#ef4444', label: 'No action needed' },
};
const STATUS_CYCLE: SnagStatus[] = ['amber', 'green', 'red'];

export default function ProjectSnagList({ project }: Props) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const projectId = (project as any)?.id;

    const [snags, setSnags] = useState<Snag[]>([]);
    const [loading, setLoading] = useState(true);
    const [assignees, setAssignees] = useState<Assignee[]>([]);

    // Add snag form
    const [showAdd, setShowAdd] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [assigneeId, setAssigneeId] = useState<number | null>(null);
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [photoMime, setPhotoMime] = useState<string>('image/jpeg');
    const [photoName, setPhotoName] = useState<string>('photo.jpg');
    const [submitting, setSubmitting] = useState(false);

    // Assignee dropdown
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Photo viewer
    const [viewPhoto, setViewPhoto] = useState<string | null>(null);

    // ── Fetch data ─────────────────────────────────────────────────────────────

    const load = async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const [data, members] = await Promise.all([getSnags(projectId), getAssignees(projectId)]);
            setSnags(data);
            setAssignees(members);
        } catch (e) {
            console.error('loadSnags', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [projectId]);

    // ── Status cycle ───────────────────────────────────────────────────────────

    const handleCycleStatus = async (snag: Snag) => {
        const idx = STATUS_CYCLE.indexOf(snag.status);
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
        // Optimistic update
        setSnags((prev) => prev.map((s) => s.id === snag.id ? { ...s, status: next } : s));
        try { await updateSnagStatus(snag.id, next); }
        catch { setSnags((prev) => prev.map((s) => s.id === snag.id ? { ...s, status: snag.status } : s)); }
    };

    // ── Pick photo ─────────────────────────────────────────────────────────────

    const pickPhoto = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission required', 'Allow photo access to attach images.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: false,
        });
        if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            setPhotoUri(asset.uri);
            setPhotoMime(asset.mimeType || 'image/jpeg');
            setPhotoName(asset.fileName || `snag_${Date.now()}.jpg`);
        }
    };

    // ── Submit new snag ────────────────────────────────────────────────────────

    const handleAdd = async () => {
        if (!title.trim()) { Alert.alert('Error', 'Title is required'); return; }
        setSubmitting(true);
        try {
            const form = new FormData();
            form.append('project_id', String(projectId));
            form.append('title', title.trim());
            if (description.trim()) form.append('description', description.trim());
            if (assigneeId) form.append('assigned_to', String(assigneeId));
            if (photoUri) {
                form.append('photo', { uri: photoUri, type: photoMime, name: photoName } as any);
            }
            const snag = await createSnag(form);
            setSnags((prev) => [snag, ...prev]);
            setShowAdd(false);
            setTitle(''); setDescription(''); setAssigneeId(null); setPhotoUri(null);
        } catch (e) {
            Alert.alert('Error', 'Failed to add snag. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const selectedAssignee = assignees.find((a) => a.id === assigneeId);

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <View>
            {/* Add Snag button */}
            {user?.role !== 'client' && (
                <TouchableOpacity
                    onPress={() => setShowAdd(true)}
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
                                {/* Status circle */}
                                <TouchableOpacity
                                    onPress={() => handleCycleStatus(snag)}
                                    style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: cfg.bg, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}
                                >
                                    <Feather name={cfg.icon} size={13} color="#fff" />
                                </TouchableOpacity>

                                {/* Content */}
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

                                {/* Photo thumbnail */}
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

            {/* ── Add Snag Modal ─────────────────────────────────────────────── */}
            <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20 }}>
                        {/* Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Add Snag</Text>
                            <TouchableOpacity onPress={() => setShowAdd(false)}>
                                <Feather name="x" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* Title */}
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Snag title"
                            placeholderTextColor={colors.textMuted}
                            maxLength={200}
                            style={{ height: 42, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 12, fontSize: 13, marginBottom: 10 }}
                        />

                        {/* Description */}
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Description (optional)"
                            placeholderTextColor={colors.textMuted}
                            multiline
                            maxLength={500}
                            style={{ height: 72, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 12, paddingTop: 10, fontSize: 13, marginBottom: 10, textAlignVertical: 'top' }}
                        />

                        {/* Attach Photo */}
                        {photoUri ? (
                            <View style={{ height: 110, borderRadius: 10, overflow: 'hidden', marginBottom: 10, position: 'relative' }}>
                                <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                <TouchableOpacity
                                    onPress={() => setPhotoUri(null)}
                                    style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}
                                >
                                    <Feather name="x" size={12} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={pickPhoto}
                                style={{ height: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, marginBottom: 10 }}
                            >
                                <Feather name="image" size={15} color={colors.textMuted} />
                                <Text style={{ fontSize: 12, color: colors.textMuted }}>Attach Photo</Text>
                            </TouchableOpacity>
                        )}

                        {/* Assignee dropdown */}
                        <TouchableOpacity
                            onPress={() => setDropdownOpen(true)}
                            style={{ height: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 16 }}
                        >
                            <Text style={{ fontSize: 13, color: selectedAssignee ? colors.text : colors.textMuted }}>
                                {selectedAssignee ? selectedAssignee.name : 'Assign to…'}
                            </Text>
                            <Feather name="chevron-down" size={16} color={colors.textMuted} />
                        </TouchableOpacity>

                        {/* Buttons */}
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => setShowAdd(false)} style={{ flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, color: colors.textMuted }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleAdd} disabled={submitting} style={{ flex: 1, height: 42, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}>
                                {submitting
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Add</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Assignee picker ────────────────────────────────────────────── */}
            <Modal visible={dropdownOpen} transparent animationType="fade" onRequestClose={() => setDropdownOpen(false)}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setDropdownOpen(false)}>
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 16 }}>
                        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Assign to</Text>
                        </View>
                        <ScrollView>
                            {assignees.map((a) => (
                                <TouchableOpacity
                                    key={a.id}
                                    onPress={() => { setAssigneeId(a.id); setDropdownOpen(false); }}
                                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                                >
                                    <View>
                                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{a.name}</Text>
                                        <Text style={{ fontSize: 10, color: colors.textMuted }}>{a.role}</Text>
                                    </View>
                                    {assigneeId === a.id && <Feather name="check" size={16} color="#f97316" />}
                                </TouchableOpacity>
                            ))}
                            {assignees.length === 0 && (
                                <Text style={{ fontSize: 12, color: colors.textMuted, padding: 16, textAlign: 'center' }}>No team members found. Add members to this project first.</Text>
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

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
        </View>
    );
}
