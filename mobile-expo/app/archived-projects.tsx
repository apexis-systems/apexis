import { View, TouchableOpacity, ScrollView, Alert, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, Stack } from 'expo-router';
import {

    getArchivedProjects,
    restoreProjectArchive,
    deleteArchivedProject,
    ArchivedProject,
} from '@/services/archiveService';
import { parseApiError } from '@/helpers/apiError';

export default function ArchivedProjectsScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();

    const [archives, setArchives] = useState<ArchivedProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

    const loadArchives = async () => {
        try {
            const res = await getArchivedProjects();
            setArchives(res.archives || []);
        } catch (err: any) {
            console.error("Failed to load archives:", err);
            const { message } = parseApiError(err, "Failed to load archived projects");
            Alert.alert("Error", message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadArchives();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadArchives();
    };

    const filteredArchives = useMemo(() => {
        if (!search.trim()) return archives;
        const q = search.toLowerCase();
        return archives.filter(
            (a) =>
                a.name.toLowerCase().includes(q) ||
                a.description?.toLowerCase().includes(q) ||
                a.archiver?.name?.toLowerCase().includes(q)
        );
    }, [archives, search]);

    const handleRestore = (item: ArchivedProject) => {
        Alert.alert(
            "Unzip & Restore Project",
            `Do you want to unzip and restore "${item.name}" back into your active workspace?\n\nAll folders, drawings, photos, RFIs, snags, and pins will be fully restored.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Unzip & Restore",
                    onPress: async () => {
                        try {
                            setActionLoadingId(item.id);
                            const res = await restoreProjectArchive(item.id);
                            setActionLoadingId(null);
                            Alert.alert("Success", "Project unzipped and restored successfully!", [
                                {
                                    text: "Open Project",
                                    onPress: () => {
                                        if (res?.project?.id) {
                                            router.push(`/project/${res.project.id}` as any);
                                        } else {
                                            router.replace('/(tabs)');
                                        }
                                    },
                                },
                            ]);
                        } catch (err: any) {
                            setActionLoadingId(null);
                            const { message } = parseApiError(err, "Failed to restore project");
                            Alert.alert("Restore Failed", message);
                        }
                    },
                },
            ]
        );
    };

    const handleDelete = (item: ArchivedProject) => {
        Alert.alert(
            "Delete Archived Project",
            `Permanently delete the archive for "${item.name}"?\n\nThis cannot be undone. All offline ZIP files and database backups will be erased forever.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Forever",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setActionLoadingId(item.id);
                            await deleteArchivedProject(item.id);
                            setActionLoadingId(null);
                            Alert.alert("Deleted", "Archive permanently deleted.");
                            loadArchives();
                        } catch (err: any) {
                            setActionLoadingId(null);
                            const { message } = parseApiError(err, "Failed to delete archive");
                            Alert.alert("Delete Failed", message);
                        }
                    },
                },
            ]
        );
    };

    const handleDownloadZip = (item: ArchivedProject) => {
        if (item.download_url) {
            Linking.openURL(item.download_url);
        } else {
            Alert.alert("Not Available", "Download URL is not available for this archive.");
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{ headerShown: false }} />
            {/* Top App Bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Feather name="arrow-left" size={20} color={colors.text} />
                    </TouchableOpacity>
                    <View>
                        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Archived Projects Vault</Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>Zipped Offline Backups & Restore</Text>
                    </View>
                </View>
            </View>

            {/* Search Input */}
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: colors.border }}>
                    <Feather name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search archived projects..."
                        placeholderTextColor={colors.textMuted}
                        value={search}
                        onChangeText={setSearch}
                        style={{ flex: 1, fontSize: 13, color: colors.text }}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Feather name="x" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* List */}
            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>Loading archives...</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={{ padding: 16, gap: 14 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                >
                    {filteredArchives.length === 0 ? (
                        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 }}>
                            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(249, 116, 22, 0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                <Feather name="archive" size={28} color={colors.primary} />
                            </View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>No Archived Projects</Text>
                            <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 32 }}>
                                Completed projects archived from the Project Overview screen will appear here for download or instant restoration.
                            </Text>
                        </View>
                    ) : (
                        filteredArchives.map((archive) => {
                            const stats = archive.stats_summary || {};
                            const dateStr = archive.archived_at
                                ? new Date(archive.archived_at).toLocaleDateString('en-IN', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                  })
                                : '—';
                            const isBusy = actionLoadingId === archive.id;

                            return (
                                <View
                                    key={archive.id}
                                    style={{
                                        backgroundColor: colors.surface,
                                        borderRadius: 16,
                                        padding: 16,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        gap: 12,
                                    }}
                                >
                                    {/* Top Row: Title & Badge */}
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                        <View style={{ flex: 1, gap: 4 }}>
                                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                                                {archive.name}
                                            </Text>
                                            {archive.description ? (
                                                <Text style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={2}>
                                                    {archive.description}
                                                </Text>
                                            ) : null}
                                        </View>
                                        <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#10b981', textTransform: 'uppercase' }}>Zipped</Text>
                                        </View>
                                    </View>

                                    {/* Sub-info: Date & Archiver */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Feather name="calendar" size={12} color={colors.textMuted} />
                                            <Text style={{ fontSize: 11, color: colors.textMuted }}>{dateStr}</Text>
                                        </View>
                                        {archive.archiver?.name && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Feather name="user" size={12} color={colors.textMuted} />
                                                <Text style={{ fontSize: 11, color: colors.textMuted }}>By {archive.archiver.name}</Text>
                                            </View>
                                        )}
                                        {stats.storage_mb !== undefined && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Feather name="hard-drive" size={12} color={colors.textMuted} />
                                                <Text style={{ fontSize: 11, color: colors.textMuted }}>{stats.storage_mb} MB</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Stats Grid */}
                                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                                        <View style={{ backgroundColor: colors.background, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Feather name="file-text" size={11} color={colors.primary} />
                                            <Text style={{ fontSize: 11, color: colors.textMuted }}>Docs: <Text style={{ fontWeight: '700', color: colors.text }}>{stats.total_docs ?? 0}</Text></Text>
                                        </View>
                                        <View style={{ backgroundColor: colors.background, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Feather name="camera" size={11} color={colors.primary} />
                                            <Text style={{ fontSize: 11, color: colors.textMuted }}>Photos: <Text style={{ fontWeight: '700', color: colors.text }}>{stats.total_photos ?? 0}</Text></Text>
                                        </View>
                                        <View style={{ backgroundColor: colors.background, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Feather name="alert-triangle" size={11} color="#f59e0b" />
                                            <Text style={{ fontSize: 11, color: colors.textMuted }}>Snags: <Text style={{ fontWeight: '700', color: colors.text }}>{stats.total_snags ?? 0}</Text></Text>
                                        </View>
                                        <View style={{ backgroundColor: colors.background, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Feather name="help-circle" size={11} color="#3b82f6" />
                                            <Text style={{ fontSize: 11, color: colors.textMuted }}>RFIs: <Text style={{ fontWeight: '700', color: colors.text }}>{stats.total_rfis ?? 0}</Text></Text>
                                        </View>
                                    </View>

                                    {/* Action Buttons */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
                                        <TouchableOpacity
                                            onPress={() => handleDownloadZip(archive)}
                                            style={{
                                                flex: 1,
                                                height: 38,
                                                backgroundColor: colors.background,
                                                borderRadius: 10,
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 6,
                                            }}
                                        >
                                            <Feather name="download" size={13} color={colors.primary} />
                                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Download ZIP</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => handleRestore(archive)}
                                            disabled={isBusy}
                                            style={{
                                                flex: 1,
                                                height: 38,
                                                backgroundColor: colors.primary,
                                                borderRadius: 10,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 6,
                                            }}
                                        >
                                            {isBusy ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <>
                                                    <Feather name="rotate-ccw" size={13} color="#fff" />
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Unzip & Restore</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => handleDelete(archive)}
                                            disabled={isBusy}
                                            style={{
                                                width: 38,
                                                height: 38,
                                                borderRadius: 10,
                                                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                                borderWidth: 1,
                                                borderColor: 'rgba(239, 68, 68, 0.2)',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Feather name="trash-2" size={14} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}
