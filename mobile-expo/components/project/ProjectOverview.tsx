import { View, TouchableOpacity, ActivityIndicator, Alert, Platform, ScrollView, BackHandler, Linking, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Text } from '@/components/ui/AppText';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { Project, UserRole } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { getProjectFiles } from '@/services/fileService';
import { getReports, Report } from '@/services/reportService';
import { useEffect, useState, useCallback } from 'react';
import { getSnags } from '@/services/snagService';

import { useSocket } from '@/contexts/SocketContext';
import { exportHandoverPackage, getLatestExport } from '@/services/projectService';

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


export default function ProjectOverview({ project, userRole, onUpdate, onActionPress }: Props) {
    const { colors } = useTheme();
    const projectId = (project as any)?.id;

    const [photosCount, setPhotosCount] = useState<number>(0);
    const [docsCount, setDocsCount] = useState<number>(0);
    const [counting, setCounting] = useState(true);

    const [dailyReports, setDailyReports] = useState<Report[]>([]);
    const [weeklyReports, setWeeklyReports] = useState<Report[]>([]);
    const [snagsCount, setSnagsCount] = useState<number>(0);
    const [reportsLoading, setReportsLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);


    // Export State
    const { socket } = useSocket();
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatusText, setExportStatusText] = useState('');
    const [exportTimerMs, setExportTimerMs] = useState(0);
    const [isCountingDown, setIsCountingDown] = useState(false);
    const [latestExport, setLatestExport] = useState<{ url: string, date: string } | null>(null);
    const handleShareFile = async (url: string) => {
        try {
            if (!url) return;

            const fileName = `Final_Handover_Report_${new Date().getTime()}.pdf`;
            const localUri = `${(FileSystem as any).cacheDirectory}${fileName}`;

            Alert.alert("Preparing...", "Downloading report to share...");
            const { uri } = await FileSystem.downloadAsync(url, localUri);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Final Handover Report',
                    UTI: 'com.adobe.pdf'
                });
            } else {
                await Share.share({
                    title: 'Final Handover Report',
                    message: `Final Handover Report\n${url}`,
                    url: url,
                });
            }
        } catch (e) {
            console.error('Share error:', e);
            Alert.alert("Error", "Failed to share report");
        }
    };

    const handleShareLink = async (role: string, code: string) => {
        try {
            // Generates a universal web link which routes to the mobile deep-link on the device
            const shareUrl = `https://apexis-web.vercel.app/auth/login-redirect?role=${role}&code=${code}`;
            await Share.share({
                title: `Join Project as ${role === 'contributor' ? 'Contributor' : 'Client'}`,
                message: `You've been invited to access a project on Apexis!\nClick the link below to securely login to your project:\n\n${shareUrl}`,
            });
        } catch (e) {
            console.error('Share error:', e);
            Alert.alert("Error", "Failed to share link");
        }
    };

    // Initial Export Status Fetch
    useEffect(() => {
        if (userRole !== 'admin' || !projectId) return;

        // Reset export state when project changes to prevent leakage
        setIsExporting(false);
        setExportStatusText('');
        setExportTimerMs(0);
        setIsCountingDown(false);
        setLatestExport(null);

        getLatestExport(projectId)
            .then(data => {
                if (data.downloadUrl) {
                    setLatestExport({ url: data.downloadUrl, date: data.last_export_date });
                }
                if (data.activeExport) {
                    setIsExporting(true);
                    setExportStatusText(data.activeExport.statusText);
                    if (data.activeExport.etaMs !== undefined) {
                        setIsCountingDown(true);
                        setExportTimerMs(data.activeExport.etaMs);
                    } else {
                        setIsCountingDown(false);
                        setExportTimerMs(Date.now() - data.activeExport.startTime);
                    }
                }
            }).catch(() => {});
    }, [projectId, userRole]);

    // Socket Listener
    useEffect(() => {
        if (!socket || userRole !== 'admin') return;

        let timerInterval: ReturnType<typeof setInterval>;

        const handleExportStatus = (data: any) => {
            if (data.projectId !== projectId) return;
            
            if (!isExporting && data.statusType === 'progress') {
                setIsExporting(true);
                setExportTimerMs(0);
                setIsCountingDown(false);
            }

            setExportStatusText(data.status);

            if (data.etaMs !== undefined) {
               setIsCountingDown(true);
               setExportTimerMs(data.etaMs);
            }

            if (data.statusType === 'success') {
                setIsExporting(false);
                setLatestExport({ url: data.presignedUrl, date: new Date().toISOString() });
                Alert.alert("Success", `Export completed in ${Math.round(data.totalTimeMs / 1000)}s!`);
            } else if (data.statusType === 'failed') {
                setIsExporting(false);
                Alert.alert("Error", 'Export failed: ' + data.status);
            }
        };

        socket.on('export-status', handleExportStatus);

        if (isExporting) {
            timerInterval = setInterval(() => {
                setExportTimerMs(prev => isCountingDown ? Math.max(0, prev - 1000) : prev + 1000);
            }, 1000);
        }

        return () => {
            socket.off('export-status', handleExportStatus);
            if (timerInterval) clearInterval(timerInterval);
        };
    }, [socket, isExporting, isCountingDown, projectId, userRole]);

    const handleStartExport = async () => {
        try {
            if (!projectId) return;
            setIsExporting(true);
            setExportStatusText('Starting export process...');
            setExportTimerMs(0);
            setIsCountingDown(false);
            await exportHandoverPackage(projectId);
        } catch (e: any) {
            Alert.alert("Error", 'Failed to trigger export');
            setIsExporting(false);
        }
    };

    const formatElapsed = (ms: number) => {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    };

    /**
     * Helper to format dates correctly for Indian locale
     */
    const fmtDate = (d: any): string => {
        if (!d) return '—';
        try {
            return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
        } catch { return String(d); }
    };

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

        // Load snags count
        getSnags(projectId)
            .then((snags) => {
                setSnagsCount(snags?.length || 0);
            })
            .catch(() => { });
    }, [projectId]);

        useCallback(() => {
            return () => {};
        }, [])


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
                        { icon: 'file-text', label: 'Documents', value: counting ? '…' : String(docsCount), id: 'documents' },
                        { icon: 'camera', label: 'Photos', value: counting ? '…' : String(photosCount), id: 'photos' },
                    ].map((item) => {
                        const isClickable = item.id === 'documents' || item.id === 'photos';
                        const Container = isClickable ? TouchableOpacity : View;
                        return (
                            <Container
                                key={item.label}
                                onPress={isClickable ? () => onActionPress?.(item.id!) : undefined}
                                activeOpacity={0.7}
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
                                        <Feather name={item.icon as any} size={12} color={item.id ? colors.primary : colors.textMuted} />
                                    </View>
                                    <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '500' }}>{item.label}</Text>
                                </View>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{item.value}</Text>
                            </Container>
                        );
                    })}
                </View>

                {/* Project Access Codes — admin only (contributor/client codes are stripped from API response) */}
                {userRole === 'admin' && (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    {[
                        { label: 'Contributor Code', value: (project as any).contributor_code, id: 'cont_code' },
                        { label: 'Client Code', value: (project as any).client_code, id: 'client_code' },
                    ].map((item) => (
                        <View
                            key={item.id}
                            style={{
                                flex: 1,
                                borderRadius: 16,
                                backgroundColor: colors.surface,
                                borderWidth: 1,
                                borderColor: colors.border,
                                padding: 12,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.05,
                                shadowRadius: 4,
                                elevation: 1,
                            }}
                        >
                            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' }}>
                                {item.label}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 }}>
                                    {item.value || '—'}
                                </Text>
                                {item.value ? (
                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                        <TouchableOpacity
                                            onPress={() => handleCopy(item.value!, item.id)}
                                            style={{ padding: 8, borderRadius: 10, backgroundColor: colors.background }}
                                        >
                                            <Feather
                                                name={copiedId === item.id ? "check" : "copy"}
                                                size={14}
                                                color={copiedId === item.id ? "#22c55e" : colors.textMuted}
                                            />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleShareLink(item.id === 'cont_code' ? 'contributor' : 'client', item.value!)}
                                            style={{ padding: 8, borderRadius: 10, backgroundColor: colors.background }}
                                        >
                                            <Feather name="share-2" size={14} color={colors.primary} />
                                        </TouchableOpacity>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    ))}
                </View>
                )}

                {/* Quick Actions */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {[
                        { id: 'reports', icon: 'file-text', label: 'Reports', color: colors.primary, sub: `${dailyReports.length + weeklyReports.length} total` },
                        { id: 'snags', icon: 'alert-triangle', label: 'Snags', color: '#f59e0b', sub: `${snagsCount} open` },
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



                {/* Handover - admin only */}
                {userRole === 'admin' && (
                    <View style={{
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                        padding: 16,
                        marginBottom: 20,
                        gap: 16
                    }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Final Handover Report</Text>

                        {isExporting ? (
                            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 12, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <View style={{ alignItems: 'center', gap: 4 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{exportStatusText || 'Exporting...'}</Text>
                                    {isCountingDown && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                                            <Feather name="clock" size={12} color={colors.textMuted} />
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                                                {formatElapsed(exportTimerMs)} left
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        ) : (
                            <View style={{ gap: 12 }}>
                                {latestExport && (
                                    <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(16, 185, 129, 0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                                <Feather name="check" size={16} color="#10b981" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 }}>Report Ready</Text>
                                                <Text style={{ fontSize: 11, color: colors.textMuted }}>Generated {new Date(latestExport.date).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                                            </View>
                                        </View>
                                        
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <TouchableOpacity
                                                onPress={() => handleShareFile(latestExport.url)}
                                                style={{ flex: 1, backgroundColor: colors.background, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                            >
                                                <Feather name="share" size={14} color={colors.text} />
                                                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Share</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => Linking.openURL(latestExport.url)}
                                                style={{ flex: 1, backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                            >
                                                <Feather name="download" size={14} color="#fff" />
                                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Download</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                                <TouchableOpacity
                                    onPress={handleStartExport}
                                    style={{
                                        width: '100%',
                                        height: 48,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: colors.primary,
                                        borderStyle: 'dashed',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                        backgroundColor: colors.background,
                                    }}
                                >
                                    <Feather name={latestExport ? "refresh-cw" : "play-circle"} size={16} color={colors.text} />
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                                        {latestExport ? 'Generate New Report' : 'Export Final Handover Report'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}

                {/* EditProjectModal moved to [id].tsx */}
            </View>
        </ScrollView>
    );
}

