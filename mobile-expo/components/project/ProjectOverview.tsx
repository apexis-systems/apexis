import { View, TouchableOpacity, ActivityIndicator, Alert, Platform, ScrollView, BackHandler, Linking, Share, Modal, SafeAreaView, Image, RefreshControl, Switch } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Text, TextInput } from '@/components/ui/AppText';
import * as Clipboard from 'expo-clipboard';
import * as Contacts from 'expo-contacts';
import { Feather } from '@expo/vector-icons';
import { Project, UserRole } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { getReports, Report } from '@/services/reportService';
import { getProjectFiles } from '@/services/fileService';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { inviteUser } from '@/services/userService';
import { getFolders } from '@/services/folderService';
import MobileFolderPickerDialog from './MobileFolderPickerDialog';

import { useFocusEffect } from 'expo-router';
import { getSnags } from '@/services/snagService';
import { getSecureFileUrl } from '@/services/fileService';

import { useSocket } from '@/contexts/SocketContext';
import { exportHandoverPackage, getLatestExport, getProjectShareLinks, getProjectMembers, removeProjectMember, updateProject } from '@/services/projectService';
import { parseApiError } from '@/helpers/apiError';
import CountryCodePicker, { countries, Country } from '@/components/CountryCodePicker';

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
    const { t, i18n } = useTranslation();

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

    // Consultant/Vendor Invite Modal States
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'vendor'>('vendor');
    const [projectFolders, setProjectFolders] = useState<any[]>([]);
    const [selectedFolders, setSelectedFolders] = useState<(string | number)[]>([]);
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);

    const handleSelectContact = async () => {
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') {
                const contact = await Contacts.presentContactPickerAsync();
                if (contact) {
                    const phoneNumbers = contact.phoneNumbers || [];
                    const emails = contact.emails || [];
                    
                    if (phoneNumbers.length > 0) {
                        const number = phoneNumbers[0].number || '';
                        const cleaned = number.replace(/[^\d+]/g, '');
                        
                        if (cleaned.startsWith('+')) {
                            const sortedCountries = [...countries].sort((a, b) => b.code.length - a.code.length);
                            const foundCountry = sortedCountries.find(c => cleaned.startsWith(c.code));
                            if (foundCountry) {
                                setSelectedCountry(foundCountry);
                                setInviteEmail(cleaned.slice(foundCountry.code.length));
                            } else {
                                setInviteEmail(cleaned);
                            }
                        } else {
                            setInviteEmail(cleaned);
                        }
                    } else if (emails.length > 0) {
                        setInviteEmail(emails[0].email || '');
                    } else {
                        Alert.alert('No Contact Info', 'This contact has no phone number or email.');
                    }
                }
            } else {
                Alert.alert('Permission Denied', 'Permission to access contacts was denied. Please allow contact permissions in system settings.');
            }
        } catch (error) {
            console.error('Error selecting contact:', error);
            Alert.alert('Error', 'Could not select contact.');
        }
    };

    useEffect(() => {
        if (!memberModalType || !projectId) return;
        setLoadingMembers(true);
        getProjectMembers(projectId)
            .then(async data => {
                const fetchedMembers = data.members.filter((m: any) => {
                    if (memberModalType === 'contributor') {
                        return m.role === 'contributor' || m.role === 'consultant' || m.role === 'vendor';
                    }
                    return m.role === memberModalType;
                });
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
            .catch(() => Alert.alert(t('projectOverview.error') as string, t('projectOverview.failedLoadMembers') as string))
            .finally(() => setLoadingMembers(false));

    }, [memberModalType, projectId]);

    const refreshMembers = async () => {
        if (!memberModalType || !projectId) return;
        const data = await getProjectMembers(projectId);
        const fetchedMembers = data.members.filter((m: any) => {
            if (memberModalType === 'contributor') {
                return m.role === 'contributor' || m.role === 'consultant' || m.role === 'vendor';
            }
            return m.role === memberModalType;
        });
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
            t('projectOverview.removeAccessTitle') as string,
            t('projectOverview.removeAccessDesc', { name: member.user.name, role: memberModalType }) as string,
            [
                { text: t('projectOverview.cancel') as string, style: 'cancel' },
                {
                    text: t('projectOverview.justRemove') as string,
                    onPress: async () => {
                        try {
                            setRemovingMemberId(member.user.id);
                            await removeProjectMember(projectId, member.user.id, false);
                            await refreshMembers();
                            Alert.alert(t('projectOverview.success') as string, t('projectOverview.accessRemoved') as string);
                        } catch (e) {
                            const { message } = parseApiError(e, t('projectOverview.failedRemoveAccess') as string);
                            Alert.alert(t('projectOverview.error') as string, message);
                        } finally {
                            setRemovingMemberId(null);
                        }
                    }
                },
                {
                    text: t('projectOverview.blockAndRemove') as string,
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert(
                            "Block Scope Selection",
                            "Do you want to block this user from this project only, or from the whole organization?",
                            [
                                { text: "Cancel", style: "cancel" },
                                {
                                    text: "This Project Only",
                                    onPress: async () => {
                                        try {
                                            setRemovingMemberId(member.user.id);
                                            await removeProjectMember(projectId, member.user.id, true, 'project');
                                            await refreshMembers();
                                            Alert.alert(t('projectOverview.success') as string, t('projectOverview.accessRemoved') as string);
                                        } catch (e) {
                                            const { message } = parseApiError(e, t('projectOverview.failedRemoveAccess') as string);
                                            Alert.alert(t('projectOverview.error') as string, message);
                                        } finally {
                                            setRemovingMemberId(null);
                                        }
                                    }
                                },
                                {
                                    text: "Whole Org",
                                    style: 'destructive',
                                    onPress: async () => {
                                        try {
                                            setRemovingMemberId(member.user.id);
                                            await removeProjectMember(projectId, member.user.id, true, 'org');
                                            await refreshMembers();
                                            Alert.alert(t('projectOverview.success') as string, t('projectOverview.accessRemoved') as string);
                                        } catch (e) {
                                            const { message } = parseApiError(e, t('projectOverview.failedRemoveAccess') as string);
                                            Alert.alert(t('projectOverview.error') as string, message);
                                        } finally {
                                            setRemovingMemberId(null);
                                        }
                                    }
                                }
                            ]
                        );
                    }
                }
            ]
        );

    };

    useEffect(() => {
        if (isInviteModalOpen && projectId) {
            setLoadingFolders(true);
            getFolders(projectId)
                .then((data: any) => {
                    setProjectFolders(Array.isArray(data) ? data : []);
                    setSelectedFolders([]);
                })
                .catch((err) => {
                    console.error("Failed to fetch folders mobile", err);
                    Alert.alert(t('projectOverview.error') as string, "Failed to load folders");
                })
                .finally(() => setLoadingFolders(false));
        } else {
            setInviteEmail('');
            setInviteRole('vendor');
            setProjectFolders([]);
            setSelectedFolders([]);
            setGeneratedInviteUrl(null);
            setSelectedCountry(countries[0]);
        }
    }, [isInviteModalOpen, projectId]);

    const handleInviteSubmit = async () => {
        const inputVal = inviteEmail.trim();
        if (!inputVal) {
            Alert.alert(t('projectOverview.error') as string, "Please enter an email address or phone number");
            return;
        }

        const isEmail = inputVal.includes('@');
        let payload: any = {
            role: inviteRole,
            project_id: projectId,
            folders: selectedFolders
        };

        if (isEmail) {
            payload.email = inputVal;
        } else {
            const cleanPhone = inputVal.replace(selectedCountry.code, "").trim();
            if (!/^\d{10}$/.test(cleanPhone)) {
                Alert.alert(t('projectOverview.error') as string, "Please enter a valid 10-digit phone number");
                return;
            }
            payload.phone_number = `${selectedCountry.code}${cleanPhone}`;
        }

        try {
            setInviting(true);
            const res = await inviteUser(payload);
            Alert.alert("Success", "Vendor invited successfully");
            if (res.inviteUrl) {
                setGeneratedInviteUrl(res.inviteUrl);
            } else {
                setIsInviteModalOpen(false);
            }
        } catch (error: any) {
            console.error(error);
            const { message } = parseApiError(error, "Failed to send invitation");
            Alert.alert(t('projectOverview.error') as string, message);
        } finally {
            setInviting(false);
        }
    };


    // Export State
    const { socket } = useSocket();
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatusText, setExportStatusText] = useState('');
    const [exportTimerMs, setExportTimerMs] = useState(0);
    const [isCountingDown, setIsCountingDown] = useState(false);
    const [latestExport, setLatestExport] = useState<{ url: string, date: string } | null>(null);
    const handleShareFile = async (url: string) => {
        let uri = '';
        try {
            if (!url) return;

            const fileName = `Final_Handover_Report_${new Date().getTime()}.pdf`;
            const localUri = `${(FileSystem as any).cacheDirectory}${fileName}`;

            Alert.alert("Preparing...", "Downloading report to share...");
            const downloadResult = await FileSystem.downloadAsync(url, localUri);
            uri = downloadResult.uri;

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Final Handover Report',
                    UTI: 'com.adobe.pdf'
                });
            } else {
                await Share.share({
                    title: 'Final Handover Report',
                    message: Platform.OS === 'android' ? `Final Handover Report\n${url}` : 'Final Handover Report',
                    url: url,
                });
            }
        } catch (e) {
            console.error('Share error:', e);
            Alert.alert("Error", "Failed to share report");
        } finally {
            if (uri && uri.startsWith('file://')) {
                FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
            }
        }
    };

    const handleShareLink = async (role: string, code: string) => {
        try {
            const data = await getProjectShareLinks(projectId, role);
            const shareUrl = role === 'contributor' ? data.contributorLink : data.clientLink;
            await Share.share({
                title: `Join Project as ${role === 'contributor' ? 'Contributor' : 'Client'}`,
                message: Platform.OS === 'android'
                    ? `You've been invited to access the project "${project.name}" on Apexis as a "${role}".\n\nClick the link below to securely login to your project:\n${shareUrl}`
                    : `You've been invited to access the project "${project.name}" on Apexis as a "${role}".\n\nClick the link below to securely login to your project:`,
                url: shareUrl,
            });
        } catch (e) {
            console.error('Share error:', e);
            Alert.alert(t('projectOverview.error') as string, t('projectOverview.failedShareLink') as string);
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
                Alert.alert(t('projectOverview.success') as string, t('projectOverview.exportCompleted', { time: Math.round(data.totalTimeMs / 1000) }) as string);
            } else if (data.statusType === 'failed') {
                setIsExporting(false);
                Alert.alert(t('projectOverview.error') as string, t('projectOverview.exportFailed') + data.status);
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
            setExportStatusText(t('projectOverview.exportStarted') as string);
            setExportTimerMs(0);
            setIsCountingDown(false);
            await exportHandoverPackage(projectId);
        } catch (e: any) {
            const { message, code } = parseApiError(e, t('projectOverview.failedTriggerExport') as string);
            Alert.alert(code === 'FEATURE_RESTRICTED' ? 'Feature Restricted' : code === 'LIMIT_REACHED' ? 'Limit Reached' : t('projectOverview.error') as string, message);
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

        // Only show full-screen loader if we have NO data yet (initial load)
        const hasSomeData = docsCount > 0 || photosCount > 0 || dailyReports.length > 0 || weeklyReports.length > 0;
        if (!isRefetch && !hasSomeData) {
            setOverallLoading(true);
        }

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
            // Don't show overallLoading spinner when just switching back to the tab
            fetchData(true);
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
                    <Text style={{ marginTop: 12, color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>{t('projectOverview.loading')}</Text>
                </View>

            ) : (
                <>
                    <View style={{ gap: 20 }}>
                        {/* Stats Grid — 2×2 */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                            {[
                                ...(isClient ? [] : [
                                    { icon: 'calendar', label: t('projectOverview.startDate'), value: fmtDate((project as any).start_date || (project as any).startDate), id: 'edit-start' },
                                    { icon: 'calendar', label: t('projectOverview.endDate'), value: fmtDate((project as any).end_date || (project as any).endDate), id: 'edit-end' },
                                ]),
                                { icon: 'file-text', label: t('projectOverview.documents'), value: counting ? '…' : String(docsCount), id: 'documents' },
                                { icon: 'camera', label: t('projectOverview.photos'), value: counting ? '…' : String(photosCount), id: 'photos' },
                            ].map((item) => {

                                const isClickable = item.id !== 'edit-start' && item.id !== 'edit-end' || canManageMembers;
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
                                        {t('projectOverview.clientProjectCode')}
                                    </Text>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 }}>
                                        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primary, letterSpacing: 0.5, flexShrink: 1 }}>
                                            {(project as any).client_code || '—'}
                                        </Text>
                                        {(project as any).client_code ? (
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                <TouchableOpacity onPress={() => handleCopy((project as any).client_code, 'client')} style={{ padding: 8, borderRadius: 12, backgroundColor: colors.surface }}>
                                                    <Feather name={copiedId === 'client' ? "check" : "copy"} size={16} color={copiedId === 'client' ? "#22c55e" : colors.textMuted} />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleShareLink('client', (project as any).client_code)} style={{ padding: 8, borderRadius: 12, backgroundColor: colors.surface }}>
                                                    <Feather name="share-2" size={16} color={colors.primary} />
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic', paddingRight: 4 }}>Restricted</Text>
                                        )}
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setMemberModalType('client')}
                                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}
                                    >
                                        <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>
                                            {(project as any).totalClients || 0} {((project as any).totalClients || 0) === 1 ? t('projectOverview.activeClient') : t('projectOverview.activeClients')}
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
                                    { label: t('projectOverview.contributorCode'), value: (project as any).contributor_code, id: 'cont_code', count: (project as any).totalContributors || 0, type: 'contributor' as const },
                                    { label: t('projectOverview.clientList'), value: null, id: 'client_list', count: (project as any).totalClients || 0, type: 'client' as const },
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
                                                    <Feather name={item.id === 'client_list' ? "users" : "lock"} size={14} color={colors.textMuted} />
                                                </View>
                                            )}
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => setMemberModalType(item.type)}
                                            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}
                                        >
                                            <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>
                                                {item.count} {item.type === 'contributor' ? (item.count === 1 ? t('projectOverview.activeContributor') : t('projectOverview.activeContributors')) : (item.count === 1 ? t('projectOverview.activeClient') : t('projectOverview.activeClients'))}
                                            </Text>
                                            <Feather name="chevron-right" size={12} color={colors.primary} style={{ marginLeft: 2 }} />
                                        </TouchableOpacity>

                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Project Access Codes — admin only (contributor/client codes are stripped from API response) */}
                        {userRole === 'admin' && (
                            <View style={{ gap: 12 }}>
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    {[
                                        { label: t('projectOverview.contributorCode'), value: (project as any).contributor_code, id: 'cont_code', count: (project as any).totalContributors || 0 },
                                        { label: t('projectOverview.clientProjectCode'), value: (project as any).client_code, id: 'client_code', count: (project as any).totalClients || 0 },
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
                                                    {item.count} {item.id === 'cont_code' ? (item.count === 1 ? t('projectOverview.activeContributor') : t('projectOverview.activeContributors')) : (item.count === 1 ? t('projectOverview.activeClient') : t('projectOverview.activeClients'))}
                                                </Text>
                                                <Feather name="chevron-right" size={12} color={colors.primary} style={{ marginLeft: 2 }} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>

                                <TouchableOpacity
                                    onPress={() => setIsInviteModalOpen(true)}
                                    style={{
                                        width: '100%',
                                        height: 44,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: colors.primary,
                                        backgroundColor: colors.surface,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                    }}
                                >
                                    <Feather name="user-plus" size={16} color={colors.primary} />
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                                        {t('projectOverview.inviteVendor')}
                                    </Text>
                                </TouchableOpacity>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginTop: 12,
                                        paddingTop: 12,
                                        borderTopWidth: 1,
                                        borderTopColor: colors.border,
                                    }}
                                >
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Restrict Onboarding</Text>
                                        <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>Only admins can invite contributors/clients to this project</Text>
                                    </View>
                                    <Switch
                                        value={!!project.restrict_onboarding}
                                        onValueChange={async (value) => {
                                            try {
                                                await updateProject(projectId, { restrict_onboarding: value });
                                                if (onUpdate) {
                                                    onUpdate({ ...project, restrict_onboarding: value });
                                                }
                                                Alert.alert('Success', value ? 'Onboarding restricted to Admins for this project' : 'Onboarding restriction removed for this project');
                                            } catch (error) {
                                                Alert.alert('Error', 'Failed to update onboarding preference');
                                            }
                                        }}
                                        trackColor={{ false: colors.border, true: colors.primary }}
                                        thumbColor={Platform.OS === 'ios' ? undefined : (project.restrict_onboarding ? '#fff' : '#f4f3f4')}
                                    />
                                </View>
                            </View>
                        )}

                        {/* Quick Actions */}
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            {(
                                userRole === 'consultant' || userRole === 'vendor'
                                    ? [
                                        { id: 'sops', icon: 'clipboard', label: t('projectOverview.checklists'), color: '#3b82f6', sub: t('projectOverview.viewAll') },
                                    ]
                                    : isClient
                                        ? [
                                            { id: 'reports', icon: 'file-text', label: t('projectOverview.reports'), color: colors.primary, sub: `${dailyReports.length + weeklyReports.length} ${t('projectOverview.total')}` },
                                            { id: 'snags', icon: 'alert-triangle', label: t('projectOverview.snags'), color: '#f59e0b', sub: `${snagsCount} ${t('projectOverview.open')}` },
                                        ]
                                        : [
                                            { id: 'reports', icon: 'file-text', label: t('projectOverview.reports'), color: colors.primary, sub: `${dailyReports.length + weeklyReports.length} ${t('projectOverview.total')}` },
                                            { id: 'snags', icon: 'alert-triangle', label: t('projectOverview.snags'), color: '#f59e0b', sub: `${snagsCount} ${t('projectOverview.open')}` },
                                            { id: 'sops', icon: 'clipboard', label: t('projectOverview.checklists'), color: '#3b82f6', sub: t('projectOverview.viewAll') },
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
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{t('projectOverview.finalHandoverReport')}</Text>


                                {isExporting ? (
                                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 12, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                                        <ActivityIndicator size="large" color={colors.primary} />
                                        <View style={{ alignItems: 'center', gap: 4 }}>
                                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{exportStatusText || t('projectOverview.exporting')}</Text>
                                            {isCountingDown && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                                                    <Feather name="clock" size={12} color={colors.textMuted} />
                                                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                                                        {formatElapsed(exportTimerMs)} {t('projectOverview.left')}
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
                                                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 }}>{t('projectOverview.reportReady')}</Text>
                                                        <Text style={{ fontSize: 11, color: colors.textMuted }}>{t('projectOverview.generated')} {new Date(latestExport.date).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                                                    </View>

                                                </View>

                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    <TouchableOpacity
                                                        onPress={() => handleShareFile(latestExport.url)}
                                                        style={{ flex: 1, backgroundColor: colors.background, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                                    >
                                                        <Feather name="share" size={14} color={colors.text} />
                                                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{t('projectOverview.share')}</Text>
                                                    </TouchableOpacity>


                                                    <TouchableOpacity
                                                        onPress={() => Linking.openURL(latestExport.url)}
                                                        style={{ flex: 1, backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                                    >
                                                        <Feather name="download" size={14} color="#fff" />
                                                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{t('projectOverview.download')}</Text>
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
                                                {latestExport ? t('projectOverview.generateNew') : t('projectOverview.exportButton')}
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
                        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                            {memberModalType === 'contributor' ? t('projectOverview.contributors') : t('projectOverview.clients')}
                        </Text>
                        <TouchableOpacity onPress={() => setMemberModalType(null)} style={{ padding: 8, backgroundColor: colors.surface, borderRadius: 20 }}>
                            <Feather name="x" size={20} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                        {loadingMembers ? (
                            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                        ) : members.length === 0 ? (
                            <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 40 }}>{t('projectOverview.noMembersFound', { role: memberModalType })}</Text>
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
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{m.user.name} {m.user.is_primary ? t('projectOverview.primary') : ''}</Text>
                                            {m.role === 'consultant' && (
                                                <View style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                                                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#a855f7', textTransform: 'uppercase' }}>Consultant</Text>
                                                </View>
                                            )}
                                            {m.role === 'vendor' && (
                                                <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                                                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase' }}>Vendor</Text>
                                                </View>
                                            )}
                                            {m.role === 'contributor' && (
                                                <View style={{ backgroundColor: 'rgba(249, 116, 22, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                                                    <Text style={{ fontSize: 9, fontWeight: '700', color: colors.primary, textTransform: 'uppercase' }}>Contributor</Text>
                                                </View>
                                            )}
                                        </View>
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

            {/* Invite Consultant/Vendor Modal */}
            <Modal visible={isInviteModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsInviteModalOpen(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{t('projectOverview.inviteVendor')}</Text>
                        <TouchableOpacity onPress={() => setIsInviteModalOpen(false)} style={{ padding: 8, backgroundColor: colors.surface, borderRadius: 20 }}>
                            <Feather name="x" size={20} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {generatedInviteUrl ? (
                        <View style={{ padding: 20, gap: 20, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(16, 185, 129, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                                <Feather name="check" size={36} color="#10b981" />
                            </View>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{t('projectOverview.invitationLinkGenerated')}</Text>
                            <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 10 }}>
                                {t('projectOverview.shareInviteSub')}
                            </Text>

                            <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginTop: 10 }}>
                                <Text style={{ fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: colors.text, flex: 1 }} numberOfLines={3}>
                                    {generatedInviteUrl}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => handleCopy(generatedInviteUrl, 'invite-link')}
                                    style={{ padding: 10, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                                >
                                    <Feather name={copiedId === 'invite-link' ? "check" : "copy"} size={16} color={copiedId === 'invite-link' ? "#22c55e" : colors.textMuted} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={async () => {
                                        try {
                                            await Share.share({
                                                title: 'Join Project as Vendor',
                                                message: Platform.OS === 'android'
                                                    ? `You've been invited to access the project "${project.name}" on Apexis as a "Vendor".\n\nClick the link below to securely login to your project:\n${generatedInviteUrl}`
                                                    : `You've been invited to access the project "${project.name}" on Apexis as a "Vendor".\n\nClick the link below to securely login to your project:`,
                                                url: generatedInviteUrl,
                                            });
                                        } catch (e) {
                                            console.error('Share error:', e);
                                        }
                                    }}
                                    style={{ padding: 10, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                                >
                                    <Feather name="share-2" size={16} color={colors.primary} />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                onPress={() => setIsInviteModalOpen(false)}
                                style={{ width: '100%', height: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 20 }}
                            >
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{t('projectOverview.close')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
                            <View style={{ gap: 8 }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>{t('projectOverview.emailOrPhone')}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {(inviteEmail.trim().length > 0 && /^\d/.test(inviteEmail.trim())) && (
                                        <CountryCodePicker
                                            selectedCountry={selectedCountry}
                                            onSelect={setSelectedCountry}
                                        />
                                    )}
                                    <TextInput
                                        placeholder={t('projectOverview.emailOrPhone') as string}
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType={inviteEmail.includes('@') ? "email-address" : "default"}
                                        autoCapitalize="none"
                                        value={inviteEmail}
                                        onChangeText={setInviteEmail}
                                        style={{
                                            flex: 1,
                                            height: 48,
                                            backgroundColor: colors.surface,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            borderRadius: 12,
                                            paddingHorizontal: 16,
                                            color: colors.text,
                                            fontSize: 14,
                                        }}
                                    />
                                    <TouchableOpacity
                                        onPress={handleSelectContact}
                                        style={{
                                            height: 48,
                                            width: 48,
                                            backgroundColor: colors.surface,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            borderRadius: 12,
                                            marginLeft: 8,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Feather name="users" size={20} color={colors.primary} />
                                    </TouchableOpacity>
                                </View>
                            </View>



                            <View style={{ gap: 8 }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Folder Permissions</Text>
                                <TouchableOpacity
                                    onPress={() => setShowFolderPicker(true)}
                                    activeOpacity={0.7}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: 14,
                                        backgroundColor: colors.surface,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        borderRadius: 16,
                                    }}
                                >
                                    <Feather name="folder" size={18} color={colors.primary} />
                                    <Text style={{ fontSize: 14, color: colors.text, flex: 1, fontWeight: '600' }}>
                                        {selectedFolders.length > 0
                                            ? t('projectOverview.manageFolderPermissionsCount', { count: selectedFolders.length })
                                            : t('projectOverview.selectFolders')}
                                    </Text>
                                    <Feather name="chevron-right" size={16} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                onPress={handleInviteSubmit}
                                disabled={inviting || !inviteEmail.trim()}
                                style={{
                                    height: 50,
                                    borderRadius: 12,
                                    backgroundColor: colors.primary,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexDirection: 'row',
                                    gap: 8,
                                    opacity: (inviting || !inviteEmail.trim()) ? 0.6 : 1,
                                    marginTop: 10
                                }}
                            >
                                {inviting && <ActivityIndicator size="small" color="#fff" />}
                                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{t('projectOverview.sendInvitation')}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </SafeAreaView>
                <MobileFolderPickerDialog
                    visible={showFolderPicker}
                    onClose={() => setShowFolderPicker(false)}
                    project={project}
                    selectedFolderIds={selectedFolders}
                    onlyTopLevel={true}
                    hideCreate={true}
                    title={t('projectOverview.folderPermissions') as string}
                    onConfirm={(ids) => {
                        setSelectedFolders(ids);
                        setShowFolderPicker(false);
                    }}
                />
            </Modal>


        </ScrollView>
    );
};
