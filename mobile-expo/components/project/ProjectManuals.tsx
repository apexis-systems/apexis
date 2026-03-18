import { useState, useEffect } from 'react';
import {
    View, TouchableOpacity, Alert, ActivityIndicator, Modal, Share, Platform,
} from 'react-native';
import { Text } from '@/components/ui/AppText';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Manual, ManualType, getManuals, uploadManual, deleteManualApi } from '@/services/manualService';

interface Props { project: any; }

const TYPE_OPTIONS: { label: string; value: ManualType }[] = [
    { label: 'Manual', value: 'manual' },
    { label: 'SOP', value: 'sop' },
];

export default function ProjectManuals({ project }: Props) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const projectId = project?.id;

    const [items, setItems] = useState<Manual[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUpload, setShowUpload] = useState(false);
    const [selectedType, setSelectedType] = useState<ManualType>('manual');
    const [pickedFile, setPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // ── Load ───────────────────────────────────────────────────────────────────

    const load = async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const data = await getManuals(projectId);
            setItems(data);
        } catch (e) {
            console.error('getManuals error', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [projectId]);

    // ── Pick file ──────────────────────────────────────────────────────────────

    const pickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'text/plain'],
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets?.[0]) {
                setPickedFile(result.assets[0]);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to pick document');
        }
    };

    // ── Upload ─────────────────────────────────────────────────────────────────

    const handleUpload = async () => {
        if (!pickedFile) { Alert.alert('Error', 'Please select a file first'); return; }
        setSubmitting(true);
        try {
            const form = new FormData();
            form.append('project_id', String(projectId));
            form.append('type', selectedType);
            form.append('file', {
                uri: pickedFile.uri,
                type: pickedFile.mimeType || 'application/octet-stream',
                name: pickedFile.name,
            } as any);

            const manual = await uploadManual(form);
            setItems((prev) => [manual, ...prev]);
            setShowUpload(false);
            setPickedFile(null);
            setSelectedType('manual');
        } catch (e) {
            Alert.alert('Error', 'Upload failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Delete ─────────────────────────────────────────────────────────────────

    const handleDelete = (item: Manual) => {
        Alert.alert('Delete', `Remove "${item.file_name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteManualApi(item.id);
                        setItems((prev) => prev.filter((m) => m.id !== item.id));
                    } catch { Alert.alert('Error', 'Failed to delete'); }
                },
            },
        ]);
    };

    // ── Helpers ────────────────────────────────────────────────────────────────

    const fmtSize = (mb: number) => mb < 1 ? `${Math.round(mb * 1024)} KB` : `${mb.toFixed(1)} MB`;
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <View>
            {/* Upload button — admins only */}
            {isAdmin && (
                <TouchableOpacity
                    onPress={() => setShowUpload(true)}
                    style={{ height: 38, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, marginBottom: 12 }}
                >
                    <Feather name="upload" size={13} color="#fff" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>Upload Manual / SOP</Text>
                </TouchableOpacity>
            )}

            {/* List */}
            {loading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
                <View style={{ gap: 6 }}>
                    {items.map((item) => (
                        <View
                            key={item.id}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, padding: 10 }}
                        >
                            {/* Icon */}
                            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                <Feather name="book-open" size={16} color={colors.primary} />
                            </View>

                            {/* Info */}
                            <TouchableOpacity style={{ flex: 1 }} onPress={() => item.downloadUrl && WebBrowser.openBrowserAsync(item.downloadUrl)}>
                                <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '600', color: colors.text }}>{item.file_name}</Text>
                                <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 1 }}>
                                    {item.type.toUpperCase()} · {fmtSize(item.file_size_mb)} · {fmtDate(item.createdAt)}
                                </Text>
                                {item.uploader && (
                                    <Text style={{ fontSize: 9, color: colors.textMuted }}>by {item.uploader.name}</Text>
                                )}
                            </TouchableOpacity>

                            {/* Actions */}
                            <View style={{ flexDirection: 'row', gap: 2 }}>
                                <TouchableOpacity
                                    onPress={async () => {
                                        if (!item.downloadUrl) return;
                                        try {
                                            await Share.share({ title: item.file_name, message: `${item.file_name}\n${item.downloadUrl}`, url: item.downloadUrl });
                                        } catch { }
                                    }}
                                    style={{ padding: 6 }}
                                >
                                    <Feather name="share-2" size={14} color="#666" />
                                </TouchableOpacity>
                                {isAdmin && (String(item.uploaded_by) === String(user?.id) || String(item.creator?.id) === String(user?.id)) && (
                                    <TouchableOpacity onPress={() => handleDelete(item)} style={{ padding: 6 }}>
                                        <Feather name="trash-2" size={14} color="#ef4444" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ))}

                    {items.length === 0 && (
                        <View style={{ marginTop: 30, alignItems: 'center' }}>
                            <Feather name="book-open" size={32} color={colors.border} />
                            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No manuals or SOPs yet</Text>
                        </View>
                    )}
                </View>
            )}

            {/* ── Upload Modal ───────────────────────────────────────────────── */}
            <Modal visible={showUpload} transparent animationType="slide" onRequestClose={() => setShowUpload(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20 }}>
                        {/* Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Upload Manual / SOP</Text>
                            <TouchableOpacity onPress={() => { setShowUpload(false); setPickedFile(null); }}>
                                <Feather name="x" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* Type selector */}
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>Type</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                            {TYPE_OPTIONS.map((opt) => (
                                <TouchableOpacity
                                    key={opt.value}
                                    onPress={() => setSelectedType(opt.value)}
                                    style={{
                                        flex: 1, height: 38, borderRadius: 10, borderWidth: 2,
                                        borderColor: selectedType === opt.value ? colors.primary : colors.border,
                                        backgroundColor: selectedType === opt.value ? 'rgba(249,115,22,0.1)' : colors.background,
                                        alignItems: 'center', justifyContent: 'center',
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: selectedType === opt.value ? colors.primary : colors.textMuted }}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* File picker */}
                        <TouchableOpacity
                            onPress={pickFile}
                            style={{
                                height: 80, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed',
                                borderColor: pickedFile ? colors.primary : colors.border,
                                alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16,
                                backgroundColor: pickedFile ? 'rgba(249,115,22,0.05)' : 'transparent',
                            }}
                        >
                            <Feather name={pickedFile ? 'file-text' : 'file-plus'} size={22} color={pickedFile ? colors.primary : colors.textMuted} />
                            <Text style={{ fontSize: 11, color: pickedFile ? colors.primary : colors.textMuted, textAlign: 'center' }}>
                                {pickedFile ? pickedFile.name : 'Tap to select PDF / Word / Excel'}
                            </Text>
                            {pickedFile && (
                                <Text style={{ fontSize: 9, color: colors.textMuted }}>
                                    {pickedFile.size ? `${(pickedFile.size / (1024 * 1024)).toFixed(2)} MB` : ''}
                                </Text>
                            )}
                        </TouchableOpacity>

                        {/* Buttons */}
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                                onPress={() => { setShowUpload(false); setPickedFile(null); }}
                                style={{ flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Text style={{ fontSize: 13, color: colors.textMuted }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleUpload}
                                disabled={submitting || !pickedFile}
                                style={{ flex: 1, height: 42, borderRadius: 10, backgroundColor: submitting || !pickedFile ? colors.primary + '80' : colors.primary, alignItems: 'center', justifyContent: 'center' }}
                            >
                                {submitting
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Upload</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
