import { View, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getReports, triggerReport, type Report } from '@/services/reportService';
import { useEffect, useState } from 'react';

interface Props {
    project: any;
    userRole: string;
}

export default function ProjectDailyReports({ project, userRole }: Props) {
    const { colors } = useTheme();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<number | null>(null);
    const [generating, setGenerating] = useState(false);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const data = await getReports(project.id, 'daily');
            setReports(data);
        } catch (e) {
            console.error('getReports daily error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (project?.id) fetchReports(); }, [project?.id]);

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            await triggerReport(project.id, 'daily');
            await fetchReports();
        } catch (e) {
            console.error('triggerReport error:', e);
        } finally {
            setGenerating(false);
        }
    };

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />;

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
            {userRole !== 'client' && (
                <TouchableOpacity
                    onPress={handleGenerate}
                    disabled={generating}
                    style={{ height: 38, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, marginBottom: 12 }}
                >
                    {generating
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Feather name="refresh-cw" size={13} color="#fff" />
                    }
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>
                        {generating ? 'Generating…' : 'Generate Today\'s Report'}
                    </Text>
                </TouchableOpacity>
            )}

            <View style={{ gap: 8 }}>
                {reports.map((report) => (
                    <TouchableOpacity
                        key={report.id}
                        onPress={() => setExpanded(expanded === report.id ? null : report.id)}
                        style={{ borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}
                    >
                        {/* Header row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                                <Feather name="file-text" size={18} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                                    Daily Report — {formatDate(report.period_start)}
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 3 }}>
                                    <Text style={{ fontSize: 10, color: colors.primary }}>📸 {report.photos_count} photos</Text>
                                    <Text style={{ fontSize: 10, color: colors.textMuted }}>📄 {report.docs_count} docs</Text>
                                    <Text style={{ fontSize: 10, color: colors.textMuted }}>👁️ {report.releases_count} released</Text>
                                    <Text style={{ fontSize: 10, color: colors.textMuted }}>💬 {report.comments_count}</Text>
                                </View>
                            </View>
                            <Feather name={expanded === report.id ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
                        </View>

                        {/* Expanded detail */}
                        {expanded === report.id && report.summary && (
                            <View style={{ paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                                {report.summary.by_folder?.length === 0 && report.summary.by_user?.length === 0 && report.summary.released_files?.length === 0 ? (
                                    <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 10, textAlign: 'center' }}>
                                        No uploads or releases recorded today.{'\n'}Comments: {report.comments_count}
                                    </Text>
                                ) : (
                                    <>
                                        {report.summary.by_folder?.length > 0 && (
                                            <View style={{ marginTop: 8 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.text, marginBottom: 4 }}>By Folder</Text>
                                                {report.summary.by_folder.map((f, i) => (
                                                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                                                        <Text style={{ fontSize: 10, color: colors.textMuted }}>{f.name}</Text>
                                                        <Text style={{ fontSize: 10, color: colors.text }}>📸 {f.photos}  📄 {f.docs}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                        {report.summary.by_user?.length > 0 && (
                                            <View style={{ marginTop: 8 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.text, marginBottom: 4 }}>By Member</Text>
                                                {report.summary.by_user.map((u, i) => (
                                                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                                                        <Text style={{ fontSize: 10, color: colors.textMuted }}>👤 {u.name}</Text>
                                                        <Text style={{ fontSize: 10, color: colors.text }}>{u.uploads} uploads</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                        {report.summary.released_files?.length > 0 && (
                                            <View style={{ marginTop: 8 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.text, marginBottom: 4 }}>Released to Client</Text>
                                                {report.summary.released_files.map((name, i) => (
                                                    <Text key={i} style={{ fontSize: 10, color: colors.primary, marginBottom: 2 }}>• {name}</Text>
                                                ))}
                                            </View>
                                        )}
                                    </>
                                )}
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            {reports.length === 0 && (
                <View style={{ marginTop: 30, alignItems: 'center' }}>
                    <Feather name="file-text" size={32} color={colors.border} />
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No daily reports yet</Text>
                    <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>Reports are auto-generated daily at 11:59 PM</Text>
                </View>
            )}
        </ScrollView>
    );
}
