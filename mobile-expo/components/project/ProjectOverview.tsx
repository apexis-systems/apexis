import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { Project, UserRole } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { getProjectFiles } from '@/services/fileService';
import { getReports, Report } from '@/services/reportService';
import { useEffect, useState } from 'react';
import EditProjectModal from './EditProjectModal';

interface Props {
    project: Project;
    userRole: UserRole;
    onUpdate?: (updated: Project) => void;
    onActionPress?: (actionId: string) => void;
}

// Get ISO week number from a date string
const getWeekNumber = (dateStr: string): number => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
};

const fmtDate = (d: any): string => {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch { return String(d); }
};

const fmtReportDate = (dateStr: string): string => {
    try {
        return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return dateStr; }
};

const reportTitle = (r: Report): string => {
    if (r.type === 'daily') {
        return `Daily Site Report — ${fmtReportDate(r.period_start)}`;
    }
    const wk = getWeekNumber(r.period_start);
    return `Weekly Progress — Week ${wk}`;
};

export default function ProjectOverview({ project, userRole, onUpdate, onActionPress }: Props) {
    const { colors } = useTheme();
    const projectId = (project as any)?.id;

    const [photosCount, setPhotosCount] = useState<number>(0);
    const [docsCount, setDocsCount] = useState<number>(0);
    const [counting, setCounting] = useState(true);

    const [dailyReports, setDailyReports] = useState<Report[]>([]);
    const [weeklyReports, setWeeklyReports] = useState<Report[]>([]);
    const [reportsLoading, setReportsLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        if (!projectId) return;

        // Load file counts
        setCounting(true);
        getProjectFiles(projectId)
            .then((data) => {
                let photos = 0, docs = 0;
                if (data.fileData) {
                    data.fileData.forEach((file: any) => {
                        if (file.file_type?.startsWith('image/')) photos++;
                        else docs++;
                    });
                }
                setPhotosCount(photos);
                setDocsCount(docs);
            })
            .catch(() => { })
            .finally(() => setCounting(false));

        // Load reports
        setReportsLoading(true);
        getReports(projectId)
            .then((all) => {
                setDailyReports(all.filter((r) => r.type === 'daily'));
                setWeeklyReports(all.filter((r) => r.type === 'weekly'));
            })
            .catch(() => { })
            .finally(() => setReportsLoading(false));
    }, [projectId]);

    const handleCopy = async (text: string, id: string) => {
        if (!text) return;
        await Clipboard.setStringAsync(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 0 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 20 }}>
                {/* Stats Grid — 2×2 */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {[
                        { icon: 'calendar', label: 'Start Date', value: fmtDate((project as any).start_date || (project as any).startDate) },
                        { icon: 'calendar', label: 'End Date', value: fmtDate((project as any).end_date || (project as any).endDate) },
                        { icon: 'file-text', label: 'Documents', value: counting ? '…' : String(docsCount) },
                        { icon: 'camera', label: 'Photos', value: counting ? '…' : String(photosCount) },
                    ].map((item) => (
                        <View
                            key={item.label}
                            style={{
                                flex: 1,
                                minWidth: '45%',
                                borderRadius: 16,
                                backgroundColor: colors.surface,
                                borderWidth: 1,
                                borderColor: colors.border,
                                padding: 16,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.05,
                                shadowRadius: 4,
                                elevation: 1,
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                                    <Feather name={item.icon as any} size={12} color={colors.textMuted} />
                                </View>
                                <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '500' }}>{item.label}</Text>
                            </View>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{item.value}</Text>
                        </View>
                    ))}
                </View>

                {/* Quick Actions */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {[
                        { id: 'reports', icon: 'file-text', label: 'Reports', color: '#f97316', sub: `${dailyReports.length + weeklyReports.length} total` },
                        { id: 'snags', icon: 'alert-triangle', label: 'Snags', color: '#f59e0b', sub: '0 open' },
                        { id: 'sops', icon: 'clipboard', label: 'SOPs', color: '#3b82f6', sub: 'View all' },
                    ].map((action) => (
                        <TouchableOpacity
                            key={action.id}
                            onPress={() => onActionPress && onActionPress(action.id)}
                            style={{
                                flex: 1,
                                alignItems: 'center',
                                gap: 10,
                                padding: 16,
                                borderRadius: 16,
                                backgroundColor: colors.surface,
                                borderWidth: 1,
                                borderColor: colors.border,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.05,
                                shadowRadius: 4,
                                elevation: 1,
                            }}
                        >
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                                <Feather name={action.icon as any} size={20} color={action.color} />
                            </View>
                            <View style={{ alignItems: 'center' }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{action.label}</Text>
                                <Text style={{ fontSize: 10, color: colors.textMuted }}>{action.sub}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>


                {/* Reports Section */}
                <View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Reports</Text>
                        <TouchableOpacity style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: '#f97316',
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 12
                        }}>
                            <Feather name="upload" size={14} color="#fff" />
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Upload Report</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Branded Bar */}
                    <View style={{
                        backgroundColor: '#fff7ed',
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#fed7aa',
                        alignItems: 'center',
                        marginBottom: 20
                    }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#f97316', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                            Generated Via Apexis — Construction Communication Platform
                        </Text>
                    </View>

                    {reportsLoading ? (
                        <ActivityIndicator size="small" color="#f97316" style={{ marginVertical: 12 }} />
                    ) : (
                        <>
                            {/* Daily Site Reports */}
                            {dailyReports.length > 0 && (
                                <View style={{ marginBottom: 20 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMuted, marginBottom: 12 }}>Daily Site Reports</Text>
                                    <View style={{ gap: 10 }}>
                                        {dailyReports.slice(0, 3).map((report) => (
                                            <View
                                                key={report.id}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 14,
                                                    borderRadius: 16,
                                                    backgroundColor: colors.surface,
                                                    borderWidth: 1,
                                                    borderColor: colors.border,
                                                    padding: 16,
                                                }}
                                            >
                                                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                                                    <Feather name="file-text" size={20} color={colors.textMuted} />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                                                        {reportTitle(report)}
                                                    </Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                        <Feather name="clock" size={12} color={colors.textMuted} />
                                                        <Text style={{ fontSize: 12, color: colors.textMuted }}>
                                                            {report.period_start} · Priya Sharma
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Weekly Progress Reports */}
                            {weeklyReports.length > 0 && (
                                <View>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMuted, marginBottom: 12 }}>Weekly Progress Reports</Text>
                                    <View style={{ gap: 10 }}>
                                        {weeklyReports.slice(0, 3).map((report) => (
                                            <View
                                                key={report.id}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 14,
                                                    borderRadius: 16,
                                                    backgroundColor: colors.surface,
                                                    borderWidth: 1,
                                                    borderColor: colors.border,
                                                    padding: 16,
                                                }}
                                            >
                                                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Feather name="file-text" size={20} color="#f97316" />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                                                        {reportTitle(report)}
                                                    </Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                        <Feather name="clock" size={12} color={colors.textMuted} />
                                                        <Text style={{ fontSize: 12, color: colors.textMuted }}>
                                                            {report.period_start} – Rajesh Kumar
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {!reportsLoading && dailyReports.length === 0 && weeklyReports.length === 0 && (
                                <View style={{ alignItems: 'center', paddingVertical: 24, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
                                    <Feather name="file-text" size={32} color={colors.border} />
                                    <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 10 }}>No reports available for this project.</Text>
                                </View>
                            )}
                        </>
                    )}
                </View>

                {/* Handover - admin only */}
                {userRole === 'admin' && (
                    <TouchableOpacity
                        style={{
                            width: '100%',
                            height: 48,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: colors.primary,
                            borderStyle: 'dashed',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            backgroundColor: colors.background,
                            marginBottom: 20
                        }}
                    >
                        <Feather name="download" size={16} color={colors.text} />
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Export Final Handover Package</Text>
                    </TouchableOpacity>
                )}

                {userRole === 'admin' && (
                    <EditProjectModal
                        isOpen={isEditModalOpen}
                        onClose={() => setIsEditModalOpen(false)}
                        project={project}
                        onUpdate={(updated) => {
                            if (onUpdate) onUpdate(updated);
                        }}
                    />
                )}
            </View>
        </ScrollView>
    );
}
