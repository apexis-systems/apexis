import { View, TouchableOpacity, ActivityIndicator, ScrollView, BackHandler, Alert, Modal } from 'react-native';

import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from "react-i18next";
import { useTheme } from '@/contexts/ThemeContext';

import { getReports, triggerReport, getReportShareUrl, regenerateReport, type Report } from '@/services/reportService';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

import * as SecureStore from 'expo-secure-store';
import { parseApiError } from '@/helpers/apiError';



interface Props {
    project: any;
    userRole: string;
}

export default function ProjectDailyReports({ project, userRole }: Props) {
    const { colors } = useTheme();
    const { t } = useTranslation();

    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<number | null>(null);
    const [generating, setGenerating] = useState(false);
    const [sharingId, setSharingId] = useState<number | null>(null);
    const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);

    const handleRegenerate = async (reportId: number) => {
        setRegeneratingId(reportId);
        try {
            await regenerateReport(reportId, project.id);
            Alert.alert(t('projectReports.weekly.success') || 'Success', t('projectReports.daily.regenerateSuccess') || 'Report regenerated successfully');
            await fetchReports();
        } catch (e: any) {
            console.error('regenerateReport error:', e);
            const { message, code } = parseApiError(e, t('projectReports.daily.failedGenerate'));
            const alertTitle = code === 'FEATURE_RESTRICTED' ? t('projectReports.weekly.featureRestricted') : code === 'LIMIT_REACHED' ? t('projectReports.weekly.limitReached') : t('projectReports.weekly.error');
            Alert.alert(alertTitle as string, message);
        } finally {
            setRegeneratingId(null);
        }
    };
    const [shareOptions, setShareOptions] = useState({
        snag: true,
        rfi: true,
        photos: true,
        files: true
    });




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

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (expanded !== null) {
                    setExpanded(null);
                    return true;
                }
                return false;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [expanded])
    );

    const StatusBadge = ({ status }: { status: string }) => {
        const s = status?.toLowerCase();
        let bgColor = 'rgba(0,0,0,0.05)';
        let textColor = colors.textMuted;
        let text = s;

        if (s === 'amber') {
            bgColor = 'rgba(245,158,11,0.1)';
            textColor = '#d97706';
            text = t('projectReports.status.waiting');
        } else if (s === 'open' || s === 'pending') {
            bgColor = 'rgba(245,158,11,0.1)';
            textColor = '#d97706';
            text = t('projectReports.status.open');
        } else if (s === 'green' || s === 'completed') {
            bgColor = 'rgba(16,185,129,0.1)';
            textColor = '#059669';
            text = t('projectReports.status.completed');
        } else if (s === 'resolved' || s === 'closed') {
            bgColor = 'rgba(16,185,129,0.1)';
            textColor = '#059669';
            text = t('projectReports.status.resolved');
        } else if (s === 'red') {
            bgColor = 'rgba(239,68,68,0.1)';
            textColor = '#dc2626';
            text = t('projectReports.status.noAction');
        } else if (s === 'overdue' || s === 'critical') {
            bgColor = 'rgba(239,68,68,0.1)';
            textColor = '#dc2626';
            text = t('projectReports.status.overdue');
        }


        return (
            <View style={{ backgroundColor: bgColor, paddingHorizontal: 4, borderRadius: 2 }}>
                <Text style={{ fontSize: 7, fontWeight: '700', color: textColor }}>{text.toUpperCase()}</Text>
            </View>
        );
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            await triggerReport(project.id, 'daily');
            await fetchReports();
        } catch (e) {
            console.error('triggerReport error:', e);
            const { message, code } = parseApiError(e, t('projectReports.daily.failedGenerate'));
            const alertTitle = code === 'FEATURE_RESTRICTED' ? t('projectReports.weekly.featureRestricted') : code === 'LIMIT_REACHED' ? t('projectReports.weekly.limitReached') : t('projectReports.weekly.error');
            Alert.alert(alertTitle as string, message);
        } finally {

            setGenerating(false);
        }
    };

    const handleShare = (report: Report) => {
        setSelectedReport(report);
        setShowShareModal(true);
    };

    const confirmShare = async () => {
        if (!selectedReport) return;
        const report = selectedReport;
        setShowShareModal(false);

        setSharingId(report.id);
        try {
            const token = await SecureStore.getItemAsync('token');
            const baseUrl = await getReportShareUrl(report.id);

            // Construct query parameters
            const query = [
                `snag=${shareOptions.snag}`,
                `rfi=${shareOptions.rfi}`,
                `photos=${shareOptions.photos}`,
                `Files=${shareOptions.files}`
            ].join('&');

            const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${query}`;

            const pad = (n: number) => n.toString().padStart(2, '0');

            const d = new Date(report.period_start);
            const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
            const sanitize = (name?: string | number) => {
                const raw = String(name ?? project?.name ?? project?.id ?? 'project');
                return raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_');
            };
            const base = `${sanitize(project?.name ?? project?.id)}`;
            const fileName = `${base}_daily_report_${dateStr}.pdf`;
            const fileUri = `${FileSystem.documentDirectory}${fileName}`;

            const { uri } = await FileSystem.downloadAsync(
                url,
                fileUri,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            }
        } catch (e) {
            console.error('handleShare error:', e);
        } finally {
            setSharingId(null);
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
                        {generating ? t('projectReports.daily.generating') : t('projectReports.daily.generate')}
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
                                    {t('projectReports.daily.title')} — {formatDate(report.period_start)}
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 3 }}>
                                    <Text style={{ fontSize: 10, color: colors.primary }}>📸 {report.photos_count} {t('projectReports.weekly.photos')}</Text>
                                    <Text style={{ fontSize: 10, color: colors.textMuted }}>📄 {report.docs_count} {t('projectReports.weekly.docs')}</Text>
                                </View>
                            </View>
                            
                            {userRole !== 'client' && (
                                <TouchableOpacity 
                                    onPress={(e) => { e.stopPropagation(); handleRegenerate(report.id); }}
                                    disabled={regeneratingId === report.id || sharingId === report.id}
                                    style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 4 }}
                                >
                                    {regeneratingId === report.id 
                                        ? <ActivityIndicator size="small" color={colors.primary} />
                                        : <Feather name="refresh-cw" size={14} color={colors.primary} />
                                    }
                                </TouchableOpacity>
                            )}
                            
                            {(report.photos_count > 0 || report.docs_count > 0 || (report.summary?.rfis?.length || 0) > 0 || (report.summary?.snags?.length || 0) > 0) && (
                                <TouchableOpacity 
                                    onPress={(e) => { e.stopPropagation(); handleShare(report); }}
                                    disabled={sharingId === report.id || regeneratingId === report.id}
                                    style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    {sharingId === report.id 
                                        ? <ActivityIndicator size="small" color={colors.primary} />
                                        : <Feather name="share-2" size={14} color={colors.primary} />
                                    }
                                </TouchableOpacity>
                            )}
                            
                            <Feather name={expanded === report.id ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
                        </View>


                        {/* Expanded detail */}
                        {expanded === report.id && report.summary && (
                            <View style={{ paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                                    <>
                                        {!report.summary.document_titles?.length && !report.summary.photo_summary?.length && !report.summary.rfis?.length && !report.summary.snags?.length && (
                                            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 10, textAlign: 'center', fontStyle: 'italic' }}>
                                                {t('projectReports.weekly.noDetail')}
                                            </Text>
                                        )}

                                        {report.summary.document_titles?.length > 0 && (
                                            <View style={{ marginTop: 8, backgroundColor: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 8 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginBottom: 4 }}>📄 {t('projectReports.weekly.docsUploaded')}</Text>
                                                {report.summary.document_titles.map((doc: any, i) => (
                                                    <Text key={i} style={{ fontSize: 9, color: colors.textMuted, marginBottom: 2 }}>
                                                        • <Text style={{ fontWeight: '600' }}>{typeof doc === 'object' ? doc.title : doc}</Text>
                                                        {typeof doc === 'object' && doc.user && ` (${t('projectReports.weekly.by')} ${doc.user} ${t('projectReports.weekly.in')} ${doc.folder})`}
                                                    </Text>
                                                ))}
                                            </View>
                                        )}


                                        {report.summary.photo_summary?.length > 0 ? (
                                            <View style={{ marginTop: 8, backgroundColor: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 8 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginBottom: 4 }}>📸 {t('projectReports.weekly.photosUploaded')}</Text>
                                                {report.summary.photo_summary.map((ps, i) => (
                                                    <Text key={i} style={{ fontSize: 9, color: colors.textMuted, marginBottom: 2 }}>
                                                        • <Text style={{ fontWeight: '600' }}>{ps.count} {t('projectReports.weekly.photos')}</Text> {t('projectReports.weekly.by')} {ps.user} {t('projectReports.weekly.in')} {ps.folder}
                                                    </Text>
                                                ))}
                                            </View>

                                        ) : report.summary.photo_details && report.summary.photo_details.length > 0 && (
                                            <View style={{ marginTop: 8, backgroundColor: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 8 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginBottom: 4 }}>📸 {t('projectReports.weekly.legacyPhotos')}</Text>
                                                {(() => {
                                                    const grouped: Record<string, any> = {};
                                                    report.summary.photo_details?.forEach((p: any) => {
                                                        const key = `${p.uploaded_by}_${p.folder}`;
                                                        if (!grouped[key]) grouped[key] = { count: 0, user: p.uploaded_by, folder: p.folder };
                                                        grouped[key].count++;
                                                    });
                                                    return Object.values(grouped).map((ps: any, i) => (
                                                        <Text key={i} style={{ fontSize: 9, color: colors.textMuted, marginBottom: 2 }}>
                                                            • <Text style={{ fontWeight: '600' }}>{ps.count} {t('projectReports.weekly.photos')}</Text> {t('projectReports.weekly.by')} {ps.user} {t('projectReports.weekly.in')} {ps.folder}
                                                        </Text>
                                                    ));
                                                })()}
                                            </View>
                                        )}


                                        {report.summary.released_files && report.summary.released_files.length > 0 && (
                                            <View style={{ marginTop: 8, backgroundColor: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 8 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.text, marginBottom: 4 }}>👁️ {t('projectReports.weekly.legacyReleased')}</Text>
                                                {report.summary.released_files.map((name: string, i: number) => (
                                                    <Text key={i} style={{ fontSize: 9, color: colors.textMuted, marginBottom: 2 }}>• {name}</Text>
                                                ))}
                                            </View>
                                        )}


                                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                            {report.summary.rfis?.length > 0 && (
                                                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 8 }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginBottom: 4 }}>{t('projectReports.weekly.rfis')}</Text>
                                                    {report.summary.rfis.map((rfi, i) => (
                                                        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                                            <Text numberOfLines={1} style={{ fontSize: 9, color: colors.textMuted, flex: 1, marginRight: 4 }}>{rfi.title}</Text>
                                                            <StatusBadge status={rfi.status} />
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                            {report.summary.snags?.length > 0 && (
                                                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 8 }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginBottom: 4 }}>{t('projectReports.weekly.snags')}</Text>
                                                    {report.summary.snags.map((snag, i) => (
                                                        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                                            <Text numberOfLines={1} style={{ fontSize: 9, color: colors.textMuted, flex: 1, marginRight: 4 }}>{snag.title}</Text>
                                                            <StatusBadge status={snag.status} />
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                        </View>

                                    </>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            {reports.length === 0 && (
                <View style={{ marginTop: 30, alignItems: 'center' }}>
                    <Feather name="file-text" size={32} color={colors.border} />
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>{t('projectReports.daily.noReports')}</Text>
                    <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>{t('projectReports.daily.autoGenerateHint')}</Text>
                </View>
            )}


            {/* Share Options Modal */}
            <Modal
                visible={showShareModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowShareModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View style={{ width: '100%', maxWidth: 320, backgroundColor: colors.surface, borderRadius: 16, padding: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 }}>{t('projectReports.shareOptions.title', 'Export Options')}</Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 20 }}>{t('projectReports.shareOptions.subtitle', 'Select sections to include in your report')}</Text>

                        <View style={{ gap: 12, marginBottom: 24 }}>
                            {[
                                { key: 'snag', label: t('projectReports.weekly.snags', 'Snags'), icon: 'alert-circle' },
                                { key: 'rfi', label: t('projectReports.weekly.rfis', 'RFIs'), icon: 'help-circle' },
                                { key: 'photos', label: t('projectReports.weekly.photos', 'Photos'), icon: 'image' },
                                { key: 'files', label: t('projectReports.weekly.docs', 'Files'), icon: 'file' },
                            ].map((opt) => (
                                <TouchableOpacity
                                    key={opt.key}
                                    onPress={() => setShareOptions(prev => ({ ...prev, [opt.key]: !prev[opt.key as keyof typeof prev] }))}
                                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border + '40' }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <Feather name={opt.icon as any} size={16} color={colors.primary} />
                                        <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text }}>{opt.label}</Text>
                                    </View>
                                    <View style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: shareOptions[opt.key as keyof typeof shareOptions] ? colors.primary : colors.border, justifyContent: 'center', paddingHorizontal: 2 }}>
                                        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', transform: [{ translateX: shareOptions[opt.key as keyof typeof shareOptions] ? 18 : 0 }] }} />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => setShowShareModal(false)}
                                style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMuted }}>{t('common.cancel', 'Cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={confirmShare}
                                style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{t('common.share', 'Share')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

