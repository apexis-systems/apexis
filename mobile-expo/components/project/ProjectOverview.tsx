import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
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

export default function ProjectOverview({ project, userRole, onUpdate }: Props) {
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
        <View style={{ gap: 16 }}>
            {/* Project Description — Admin Editable */}
            {(project.description || userRole === 'admin') && (
                <View style={{
                    borderRadius: 14,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 16,
                    gap: 8
                }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>About the Project</Text>
                        {userRole === 'admin' && (
                            <TouchableOpacity
                                onPress={() => setIsEditModalOpen(true)}
                                style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 15,
                                    backgroundColor: colors.background,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1,
                                    borderColor: colors.border
                                }}
                            >
                                <Feather name="edit-2" size={12} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                    </View>
                    {project.description ? (
                        <Text style={{ fontSize: 14, color: colors.text, fontStyle: 'italic', lineHeight: 20 }}>
                            "{project.description}"
                        </Text>
                    ) : (
                        <Text style={{ fontSize: 13, color: colors.textMuted, fontStyle: 'italic' }}>
                            No description provided. Tap the edit icon to add one.
                        </Text>
                    )}
                </View>
            )}

            {/* Stats Grid — 2×2 */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {[
                    { icon: 'calendar', label: 'Start Date', value: fmtDate((project as any).start_date || (project as any).startDate) },
                    { icon: 'calendar', label: 'End Date', value: fmtDate((project as any).end_date || (project as any).endDate) },
                    { icon: 'file-text', label: 'Documents', value: counting ? '…' : String(docsCount) },
                    { icon: 'camera', label: 'Photos', value: counting ? '…' : String(photosCount) },
                ].map((item) => (
                    <View
                        key={item.label}
                        style={{
                            width: '47%',
                            borderRadius: 14,
                            backgroundColor: colors.background,
                            borderWidth: 1,
                            borderColor: colors.border,
                            padding: 14,
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <Feather name={item.icon as any} size={14} color="#888" />
                            <Text style={{ fontSize: 11, color: colors.textMuted }}>{item.label}</Text>
                        </View>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{item.value}</Text>
                    </View>
                ))}
            </View>

            {/* Access Codes Section — Admin Only */}
            {(userRole === 'admin' || userRole === 'superadmin') && (
                <View style={{
                    marginTop: 8,
                    borderRadius: 14,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 16,
                    gap: 12
                }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Access Codes</Text>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1, gap: 6 }}>
                            <Text style={{ fontSize: 10, color: colors.textMuted }}>Contributor Code</Text>
                            <TouchableOpacity
                                onPress={() => handleCopy((project as any).contributor_code, 'contributor')}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    backgroundColor: colors.background,
                                    borderRadius: 10,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    padding: 10,
                                    height: 44
                                }}
                            >
                                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                                    {(project as any).contributor_code || '—'}
                                </Text>
                                <Feather
                                    name={copiedId === 'contributor' ? "check" : "copy"}
                                    size={16}
                                    color={copiedId === 'contributor' ? "#22c55e" : colors.textMuted}
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={{ flex: 1, gap: 6 }}>
                            <Text style={{ fontSize: 10, color: colors.textMuted }}>Client Code</Text>
                            <TouchableOpacity
                                onPress={() => handleCopy((project as any).client_code, 'client')}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    backgroundColor: colors.background,
                                    borderRadius: 10,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    padding: 10,
                                    height: 44
                                }}
                            >
                                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                                    {(project as any).client_code || '—'}
                                </Text>
                                <Feather
                                    name={copiedId === 'client' ? "check" : "copy"}
                                    size={16}
                                    color={copiedId === 'client' ? "#22c55e" : colors.textMuted}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* Reports Section */}
            <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Reports</Text>
                </View>

                {reportsLoading ? (
                    <ActivityIndicator size="small" color="#f97316" style={{ marginVertical: 12 }} />
                ) : (
                    <>
                        {/* Daily Site Reports */}
                        {dailyReports.length > 0 && (
                            <View style={{ marginBottom: 12 }}>
                                <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>Daily Site Reports</Text>
                                <View style={{ gap: 6 }}>
                                    {dailyReports.map((report) => (
                                        <View
                                            key={report.id}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 10,
                                                borderRadius: 12,
                                                backgroundColor: colors.background,
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                                padding: 10,
                                            }}
                                        >
                                            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                                                <Feather name="file-text" size={16} color="#888" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>
                                                    {reportTitle(report)}
                                                </Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                    <Feather name="clock" size={9} color="#555" />
                                                    <Text style={{ fontSize: 9, color: colors.textMuted }}>
                                                        {report.period_start} · Auto-generated
                                                    </Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                                    <Text style={{ fontSize: 9, color: '#f97316' }}>📸 {report.photos_count} photos</Text>
                                                    <Text style={{ fontSize: 9, color: colors.textMuted }}>📄 {report.docs_count} docs</Text>
                                                    <Text style={{ fontSize: 9, color: colors.textMuted }}>💬 {report.comments_count}</Text>
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
                                <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>Weekly Progress Reports</Text>
                                <View style={{ gap: 6 }}>
                                    {weeklyReports.map((report) => (
                                        <View
                                            key={report.id}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 10,
                                                borderRadius: 12,
                                                backgroundColor: colors.background,
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                                padding: 10,
                                            }}
                                        >
                                            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                                <Feather name="file-text" size={16} color="#f97316" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>
                                                    {reportTitle(report)}
                                                </Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                    <Feather name="clock" size={9} color="#555" />
                                                    <Text style={{ fontSize: 9, color: colors.textMuted }}>
                                                        {report.period_start} – {report.period_end} · Auto-generated
                                                    </Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                                    <Text style={{ fontSize: 9, color: '#f97316' }}>📸 {report.photos_count} photos</Text>
                                                    <Text style={{ fontSize: 9, color: colors.textMuted }}>📄 {report.docs_count} docs</Text>
                                                    <Text style={{ fontSize: 9, color: colors.textMuted }}>💬 {report.comments_count}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {!reportsLoading && dailyReports.length === 0 && weeklyReports.length === 0 && (
                            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                                <Feather name="file-text" size={24} color={colors.border} />
                                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>No reports yet. Reports auto-generate each evening.</Text>
                            </View>
                        )}
                    </>
                )}
            </View>

            {/* Export Final Handover Package */}
            {(userRole === 'admin' || userRole === 'superadmin') && (
                <TouchableOpacity
                    style={{
                        height: 44,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderStyle: 'dashed',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 6,
                    }}
                >
                    <Feather name="download" size={15} color="#888" />
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>Export Final Handover Package</Text>
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
    );
}
