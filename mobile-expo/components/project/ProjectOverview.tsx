import { View, TouchableOpacity, ActivityIndicator, Alert, Platform, ScrollView, BackHandler, Linking, Share, Modal, SafeAreaView, Image, RefreshControl } from 'react-native';
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
import { useFocusEffect } from 'expo-router';
import { getSnags } from '@/services/snagService';
import { getSecureFileUrl } from '@/services/fileService';

import { useSocket } from '@/contexts/SocketContext';
import { exportHandoverPackage, getLatestExport, getProjectShareLinks, getProjectMembers, removeProjectMember } from '@/services/projectService';
import { parseApiError } from '@/helpers/apiError';

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
    const canManageMembers = userRole === 'admin' || userRole === 'superadmin';
    const isClient = userRole === 'client';

    const [photosCount, setPhotosCount] = useState<number>(0);
    const [docsCount, setDocsCount] = useState<number>(0);
    const [counting, setCounting] = useState(true);

    const [dailyReports, setDailyReports] = useState<Report[]>([]);
    const [weeklyReports, setWeeklyReports] = useState<Report[]>([]);
    const [snagsCount, setSnagsCount] = useState<number>(0);
    const [reportsLoading, setReportsLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [overallLoading, setOverallLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [memberModalType, setMemberModalType] = useState<'contributor' | 'client' | null>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [removingMemberId, setRemovingMemberId] = useState<string | number | null>(null);

    useEffect(() => {
        if (!memberModalType || !projectId) return;
        setLoadingMembers(true);
        getProjectMembers(projectId)
            .then(async data => {
                const fetchedMembers = data.members.filter((m: any) => m.role === memberModalType);
                const membersWithPics = await Promise.all(fetchedMembers.map(async (m: any) => {
                    if (m.user.profile_pic) {
                        try {
                            const url = await getSecureFileUrl(m.user.profile_pic);
                            return { ...m, secure_pic: url };
                        } catch { return m; }
                    }
                    return m;
                }));
                setMembers(membersWithPics);
            })
            .catch(() => Alert.alert("Error", "Failed to load members"))
            .finally(() => setLoadingMembers(false));
    }, [memberModalType, projectId]);

    const refreshMembers = async () => {
        if (!memberModalType || !projectId) return;
        const data = await getProjectMembers(projectId);
        const fetchedMembers = data.members.filter((m: any) => m.role === memberModalType);
        const membersWithPics = await Promise.all(fetchedMembers.map(async (m: any) => {
            if (m.user.profile_pic) {
                try {
                    const url = await getSecureFileUrl(m.user.profile_pic);
                    return { ...m, secure_pic: url };
                } catch { return m; }
            }
            return m;
        }));
        setMembers(membersWithPics);
    };

    const handleRemoveMember = async (member: any) => {
        if (!projectId || !member?.user?.id) return;
        Alert.alert(
            'Remove project access?',
            `Remove ${member.user.name} from this ${memberModalType} list? Their account will stay in the organization.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setRemovingMemberId(member.user.id);
                            await removeProjectMember(projectId, member.user.id);
                            await refreshMembers();
                            Alert.alert('Success', 'Project access removed.');
                        } catch (e) {
                            const { message } = parseApiError(e, 'Failed to remove project access');
                            Alert.alert('Error', message);
                        } finally {
                            setRemovingMemberId(null);
                        }
                    }
                }
            ]
        );
    };


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
            const data = await getProjectShareLinks(projectId, role);
            const shareUrl = role === 'contributor' ? data.contributorLink : data.clientLink;
            await Share.share({
                title: `Join Project as ${role === 'contributor' ? 'Contributor' : 'Client'}`,
                message: `You've been invited to access the project "${project.name}" on Apexis as a "${role}".\n\nClick the link below to securely login to your project:\n${shareUrl}`,
            });
        } catch (e) {
            console.error('Share error:', e);
            Alert.alert("Error", "Failed to share link");
        }
    };

    // Initial Export Status Fetch
    useEffect(() => {
        if ((userRole !== 'admin' && userRole !== 'superadmin') || !projectId) return;

        // Reset export state when project changes to prevent leakage
        setIsExporting(false);
        setExportStatusText('');
        setExportTimerMs(0);
        setIsCountingDown(false);
        setLatestExport(null);

        getLatestExport(projectId)
            .then(data => {
                if (!data) return; // no export generated yet for this project
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
            }).catch((err) => { console.log('getLatestExport:', err?.message); });
    }, [projectId, userRole]);

    // Socket Listener
    useEffect(() => {
        if (!socket || (userRole !== 'admin' && userRole !== 'superadmin')) return;

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

    // Join project room and listen for real-time stats updates
    useEffect(() => {
        if (!socket || !projectId) return;

        socket.emit('join-project', projectId);

        const handleStatsUpdate = (data: any) => {
            if (String(data.projectId) !== String(projectId)) return;
            // Re-fetch file counts
            setCounting(true);
            getProjectFiles(projectId)
                .then((d) => {
                    let photos = 0, docs = 0;
                    if (d.fileData) {
                        d.fileData.forEach((file: any) => {
                            if (file.file_type?.startsWith('image/')) photos++;
                            else docs++;
                        });
                    }
                    setPhotosCount(photos);
                    setDocsCount(docs);
                })
                .catch(() => { })
                .finally(() => setCounting(false));
        };

        socket.on('project-stats-updated', handleStatsUpdate);

        return () => {
            socket.off('project-stats-updated', handleStatsUpdate);
        };
    }, [socket, projectId]);

    const handleStartExport = async () => {
        try {
            if (!projectId) return;
            setIsExporting(true);
            setExportStatusText('Starting export process...');
            setExportTimerMs(0);
            setIsCountingDown(false);
            await exportHandoverPackage(projectId);
        } catch (e: any) {
            const { message, code } = parseApiError(e, 'Failed to trigger export');
            Alert.alert(code === 'FEATURE_RESTRICTED' ? 'Feature Restricted' : code === 'LIMIT_REACHED' ? 'Limit Reached' : 'Error', message);
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

    const fetchData = async (isRefetch = false) => {
        if (!projectId || projectId === 'undefined') {
            console.log("[ProjectOverview] Skipping fetch: Invalid projectId", projectId);
            return;
        }
        
        if (!isRefetch) setOverallLoading(true);
        setCounting(true);
        setReportsLoading(true);
        
        try {
            console.log("[ProjectOverview] Fetching data for project:", projectId);
            
            // 1. Fetch Files for Counts
            try {
                const data = await getProjectFiles(projectId);
                const fileList = data.fileData || [];
                const photos = fileList.filter((f: any) => f.file_type?.startsWith('image/'));
                const docs = fileList.filter((f: any) => !f.file_type?.startsWith('image/'));
                setPhotosCount(photos.length);
                setDocsCount(docs.length);
            } catch (err) {
                console.error("[ProjectOverview] getProjectFiles failed:", err);
            }

            // 2. Fetch Reports
            try {
                const reports = await getReports(projectId);
                setDailyReports(reports.filter((r: any) => r.type === 'daily'));
                setWeeklyReports(reports.filter((r: any) => r.type === 'weekly'));
            } catch (err) {
                console.error("[ProjectOverview] getReports failed:", err);
            }

            // 3. Fetch Snags
            try {
                const snags = await getSnags(projectId);
                setSnagsCount(snags?.length || 0);
            } catch (err) {
                console.error("[ProjectOverview] getSnags failed:", err);
            }

        } catch (err) {
            console.error("[ProjectOverview] Global fetch error:", err);
        } finally {
            setCounting(false);
            setReportsLoading(false);
            setOverallLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [projectId])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData(true);
        setRefreshing(false);
    };

    const handleCopy = async (text: string, id: string) => {
        if (!text) return;
        await Clipboard.setStringAsync(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 0 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            {overallLoading ? (
                <View style={{ flex: 1, minHeight: 400, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ marginTop: 12, color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>Loading Overview...</Text>
                </View>
            ) : (
                <>
            <View style={{ gap: 20 }}>
                {/* Stats Grid — 2×2 */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {[
                        ...(isClient ? [] : [
                            { icon: 'calendar', label: 'Start Date', value: fmtDate((project as any).start_date || (project as any).startDate), id: 'edit-start' },
                            { icon: 'calendar', label: 'End Date', value: fmtDate((project as any).end_date || (project as any).endDate), id: 'edit-end' },
                        ]),
                        { icon: 'file-text', label: 'Documents', value: counting ? '…' : String(docsCount), id: 'documents' },
                        { icon: 'camera', label: 'Photos', value: counting ? '…' : String(photosCount), id: 'photos' },
                    ].map((item) => {
                        const isClickable = true;
                        const Container = TouchableOpacity;
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

                {isClient && (
                    <View style={{ gap: 12 }}>
                        <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Client Project Code
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 }}>
                                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primary, letterSpacing: 0.5, flex: 1 }}>
                                    {(project as any).client_code || '—'}
                                </Text>
                                {(project as any).client_code && (
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity onPress={() => handleCopy((project as any).client_code, 'client')} style={{ padding: 8, borderRadius: 12, backgroundColor: colors.surface }}>
                                            <Feather name={copiedId === 'client' ? "check" : "copy"} size={16} color={copiedId === 'client' ? "#22c55e" : colors.textMuted} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleShareLink('client', (project as any).client_code)} style={{ padding: 8, borderRadius: 12, backgroundColor: colors.surface }}>
                                            <Feather name="share-2" size={16} color={colors.primary} />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity
                                onPress={() => setMemberModalType('client')}
                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}
                            >
                                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>
                                    {(project as any).totalClients || 0} active {((project as any).totalClients || 0) === 1 ? 'client' : 'clients'}
                                </Text>
                                <Feather name="chevron-right" size={12} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Project Members & Codes */}
                {userRole === 'contributor' && (
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        {[
                            { label: 'Contributor Code', value: (project as any).contributor_code, id: 'cont_code', count: (project as any).totalContributors || 0, type: 'contributor' as const },
                            { label: 'Client List', value: null, id: 'client_list', count: (project as any).totalClients || 0, type: 'client' as const },
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
                                                onPress={() => handleShareLink('contributor', item.value!)}
                                                style={{ padding: 8, borderRadius: 10, backgroundColor: colors.background }}
                                            >
                                                <Feather name="share-2" size={14} color={colors.primary} />
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={{ padding: 8, borderRadius: 10, backgroundColor: colors.background }}>
                                            <Feather name="users" size={14} color={colors.textMuted} />
                                        </View>
                                    )}
                                </View>
                                <TouchableOpacity
                                    onPress={() => setMemberModalType(item.type)}
                                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}
                                >
                                    <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>
                                        {item.count} active {item.type === 'contributor' ? (item.count === 1 ? 'contributor' : 'contributors') : (item.count === 1 ? 'client' : 'clients')}
                                    </Text>
                                    <Feather name="chevron-right" size={12} color={colors.primary} style={{ marginLeft: 2 }} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* Project Access Codes — admin only (contributor/client codes are stripped from API response) */}
                {userRole === 'admin' && (
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        {[
                            { label: 'Contributor Code', value: (project as any).contributor_code, id: 'cont_code', count: (project as any).totalContributors || 0 },
                            { label: 'Client Code', value: (project as any).client_code, id: 'client_code', count: (project as any).totalClients || 0 },
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
                                <TouchableOpacity
                                    onPress={() => setMemberModalType(item.id === 'cont_code' ? 'contributor' : 'client')}
                                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}
                                >
                                    <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>
                                        {item.count} active {item.id === 'cont_code' ? (item.count === 1 ? 'contributor' : 'contributors') : (item.count === 1 ? 'client' : 'clients')}
                                    </Text>
                                    <Feather name="chevron-right" size={12} color={colors.primary} style={{ marginLeft: 2 }} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* Quick Actions */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {(
                        isClient
                            ? [
                                { id: 'reports', icon: 'file-text', label: 'Reports', color: colors.primary, sub: `${dailyReports.length + weeklyReports.length} total` },
                                { id: 'snags', icon: 'alert-triangle', label: 'Snags', color: '#f59e0b', sub: `${snagsCount} open` },
                            ]
                            : [
                                { id: 'reports', icon: 'file-text', label: 'Reports', color: colors.primary, sub: `${dailyReports.length + weeklyReports.length} total` },
                                { id: 'snags', icon: 'alert-triangle', label: 'Snags', color: '#f59e0b', sub: `${snagsCount} open` },
                                { id: 'sops', icon: 'clipboard', label: 'SOPs', color: '#3b82f6', sub: 'View all' },
                            ]
                    ).map((action) => (
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
                </>
            )}

            {/* Member List Modal */}
            <Modal visible={!!memberModalType} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMemberModalType(null)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, textTransform: 'capitalize' }}>
                            {memberModalType}s
                        </Text>
                        <TouchableOpacity onPress={() => setMemberModalType(null)} style={{ padding: 8, backgroundColor: colors.surface, borderRadius: 20 }}>
                            <Feather name="x" size={20} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                        {loadingMembers ? (
                            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                        ) : members.length === 0 ? (
                            <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 40 }}>No active {memberModalType}s found</Text>
                        ) : (
                                members.map((m, idx) => (
                                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                                        {m.secure_pic ? (
                                            <Image source={{ uri: m.secure_pic }} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background }} />
                                    ) : (
                                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary }}>{m.user.name?.charAt(0).toUpperCase()}</Text>
                                        </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{m.user.name} {m.user.is_primary ? '(Primary)' : ''}</Text>
                                        <View style={{ marginTop: 4, gap: 2 }}>
                                            {m.user.email && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Feather name="mail" size={12} color={colors.primary} />
                                                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{m.user.email}</Text>
                                                </View>
                                            )}
                                            {m.user.phone_number && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Feather name="phone" size={12} color={colors.primary} />
                                                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{m.user.phone_number}</Text>
                                                </View>
                                            )}
                                            </View>
                                        </View>
                                        {canManageMembers && (
                                            <TouchableOpacity
                                                onPress={() => handleRemoveMember(m)}
                                                disabled={removingMemberId === m.user.id}
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 20,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                                    borderWidth: 1,
                                                    borderColor: 'rgba(239, 68, 68, 0.18)',
                                                    opacity: removingMemberId === m.user.id ? 0.5 : 1,
                                                }}
                                            >
                                                {removingMemberId === m.user.id ? (
                                                    <ActivityIndicator size="small" color="#ef4444" />
                                                ) : (
                                                    <Feather name="trash-2" size={16} color="#ef4444" />
                                                )}
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))
                            )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </ScrollView>
    );
};
