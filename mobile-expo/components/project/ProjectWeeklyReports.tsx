import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getReports, triggerReport, type Report } from '@/services/reportService';
import { useEffect, useState } from 'react';

interface Props {
    project: any;
    userRole: string;
}

export default function ProjectWeeklyReports({ project, userRole }: Props) {
    const { colors } = useTheme();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<number | null>(null);
    const [generating, setGenerating] = useState(false);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const data = await getReports(project.id, 'weekly');
            setReports(data);
        } catch (e) {
            console.error('getReports weekly error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (project?.id) fetchReports(); }, [project?.id]);

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            await triggerReport(project.id, 'weekly');
            await fetchReports();
        } catch (e) {
            console.error('triggerReport weekly error:', e);
        } finally {
            setGenerating(false);
        }
    };

    const formatRange = (start: string, end: string) => {
        const s = new Date(start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const e = new Date(end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        return `${s} – ${e}`;
    };

    if (loading) return <ActivityIndicator color="#f97316" style={{ marginTop: 30 }} />;

    return (
        <View>
            {userRole !== 'client' && (
                <TouchableOpacity
                    onPress={handleGenerate}
                    disabled={generating}
                    style={{ height: 38, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, marginBottom: 12 }}
                >
                    {generating
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Feather name="refresh-cw" size={13} color="#fff" />
                    }
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>
                        {generating ? 'Generating…' : 'Generate This Week\'s Report'}
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Feather name="calendar" size={18} color={colors.text} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                                    Week of {formatRange(report.period_start, report.period_end)}
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 3 }}>
                                    <Text style={{ fontSize: 10, color: '#f97316' }}>📸 {report.photos_count} photos</Text>
                                    <Text style={{ fontSize: 10, color: colors.textMuted }}>📄 {report.docs_count} docs</Text>
                                    <Text style={{ fontSize: 10, color: colors.textMuted }}>👁️ {report.releases_count} released</Text>
                                    <Text style={{ fontSize: 10, color: colors.textMuted }}>💬 {report.comments_count}</Text>
                                </View>
                            </View>
                            <Feather name={expanded === report.id ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
                        </View>

                        {expanded === report.id && report.summary && (
                            <View style={{ paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
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
                                            <Text key={i} style={{ fontSize: 10, color: '#f97316', marginBottom: 2 }}>• {name}</Text>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            {reports.length === 0 && (
                <View style={{ marginTop: 30, alignItems: 'center' }}>
                    <Feather name="calendar" size={32} color={colors.border} />
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No weekly reports yet</Text>
                    <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>Reports are auto-generated every Sunday at 11:59 PM</Text>
                </View>
            )}
        </View>
    );
}
