import { View, TouchableOpacity, ActivityIndicator, ScrollView, BackHandler } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getReports, triggerReport, getReportShareUrl, type Report } from '@/services/reportService';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

import * as SecureStore from 'expo-secure-store';


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
    const [sharingId, setSharingId] = useState<number | null>(null);


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
            text = 'Waiting for Clearance';
        } else if (s === 'open' || s === 'pending') {
            bgColor = 'rgba(245,158,11,0.1)';
            textColor = '#d97706';
            text = 'OPEN';
        } else if (s === 'green' || s === 'completed') {
            bgColor = 'rgba(16,185,129,0.1)';
            textColor = '#059669';
            text = 'Completed';
        } else if (s === 'resolved' || s === 'closed') {
            bgColor = 'rgba(16,185,129,0.1)';
            textColor = '#059669';
            text = 'RESOLVED';
        } else if (s === 'red') {
            bgColor = 'rgba(239,68,68,0.1)';
            textColor = '#dc2626';
            text = 'No Action Required';
        } else if (s === 'overdue' || s === 'critical') {
            bgColor = 'rgba(239,68,68,0.1)';
            textColor = '#dc2626';
            text = 'OVERDUE';
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
            await triggerReport(project.id, 'weekly');
            await fetchReports();
        } catch (e) {
            console.error('triggerReport weekly error:', e);
        } finally {
            setGenerating(false);
        }
    };

    const handleShare = async (report: Report) => {
        setSharingId(report.id);
        try {
            const token = await SecureStore.getItemAsync('token');
            const url = await getReportShareUrl(report.id);
            const fileUri = `${FileSystem.documentDirectory}report_${report.id}.pdf`;
            
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

    const fmt = (d: string) => {

        const date = new Date(d);
        return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
    };

    if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />;

    return (
        <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ padding: 16 }}>
                {userRole !== 'client' && (
                    <TouchableOpacity
                        onPress={handleGenerate}
                        disabled={generating}
                        style={{
                            backgroundColor: colors.primary,
                            padding: 12,
                            borderRadius: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 16,
                            opacity: generating ? 0.7 : 1
                        }}
                    >
                        {generating ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="trending-up" size={16} color="#fff" />}
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginLeft: 8 }}>
                            {generating ? 'Generating...' : "Generate This Week's Report"}
                        </Text>
                    </TouchableOpacity>
                )}

                {reports.map((report) => (
                    <View key={report.id} style={{ marginBottom: 12, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                        <TouchableOpacity
                            onPress={() => setExpanded(expanded === report.id ? null : report.id)}
                            style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>
                                    Weekly Report — {fmt(report.period_start)} to {fmt(report.period_end)}
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 3 }}>
                                    <Text style={{ fontSize: 10, color: colors.primary }}>📸 {report.photos_count} photos</Text>
                                    <Text style={{ fontSize: 10, color: colors.textMuted }}>📄 {report.docs_count} docs</Text>
                                </View>
                            </View>
                            
                            {(report.photos_count > 0 || report.docs_count > 0 || (report.summary?.rfis?.length || 0) > 0 || (report.summary?.snags?.length || 0) > 0) && (
                                <TouchableOpacity 
                                    onPress={(e) => { e.stopPropagation(); handleShare(report); }}
                                    disabled={sharingId === report.id}
                                    style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
                                >
                                    {sharingId === report.id 
                                        ? <ActivityIndicator size="small" color={colors.primary} />
                                        : <Feather name="share-2" size={14} color={colors.primary} />
                                    }
                                </TouchableOpacity>
                            )}
                            
                            <Feather name={expanded === report.id ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
                        </TouchableOpacity>



                        {/* Expanded detail */}
                        {expanded === report.id && report.summary && (
                            <View style={{ paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                                    <>
                                        {!report.summary.document_titles?.length && !report.summary.photo_summary?.length && !report.summary.photo_details?.length && !report.summary.rfis?.length && !report.summary.snags?.length && (
                                            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 10, textAlign: 'center', fontStyle: 'italic' }}>
                                                No detail records for this period
                                            </Text>
                                        )}
                                        {report.summary.document_titles?.length > 0 && (
                                            <View style={{ marginTop: 8, backgroundColor: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 8 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginBottom: 4 }}>📄 Documents Uploaded</Text>
                                                {report.summary.document_titles.map((title, i) => (
                                                    <Text key={i} style={{ fontSize: 9, color: colors.textMuted, marginBottom: 2 }}>• {title}</Text>
                                                ))}
                                            </View>
                                        )}

                                        {report.summary.photo_summary?.length > 0 ? (
                                            <View style={{ marginTop: 8, backgroundColor: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 8 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginBottom: 4 }}>📸 Photos Uploaded</Text>
                                                {report.summary.photo_summary.map((ps, i) => (
                                                    <Text key={i} style={{ fontSize: 9, color: colors.textMuted, marginBottom: 2 }}>
                                                        • <Text style={{ fontWeight: '600', color: colors.text }}>{ps.count} photos</Text> by {ps.user} in {ps.folder}
                                                    </Text>
                                                ))}
                                            </View>
                                        ) : report.summary.photo_details && report.summary.photo_details.length > 0 && (
                                            <View style={{ marginTop: 8, backgroundColor: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 8 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginBottom: 4 }}>📸 Photos Uploaded (Legacy)</Text>
                                                {(() => {
                                                    const grouped: Record<string, any> = {};
                                                    report.summary.photo_details?.forEach((p: any) => {
                                                        const key = `${p.uploaded_by}_${p.folder}`;
                                                        if (!grouped[key]) grouped[key] = { count: 0, user: p.uploaded_by, folder: p.folder };
                                                        grouped[key].count++;
                                                    });
                                                    return Object.values(grouped).map((ps: any, i) => (
                                                        <Text key={i} style={{ fontSize: 9, color: colors.textMuted, marginBottom: 2 }}>
                                                            • <Text style={{ fontWeight: '600', color: colors.text }}>{ps.count} photos</Text> by {ps.user} in {ps.folder}
                                                        </Text>
                                                    ));
                                                })()}
                                            </View>
                                        )}

                                        {report.summary.released_files && report.summary.released_files.length > 0 && (
                                            <View style={{ marginTop: 8, backgroundColor: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 8 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.text, marginBottom: 4 }}>👁️ Released to Client (Legacy)</Text>
                                                {report.summary.released_files.map((name: string, i: number) => (
                                                    <Text key={i} style={{ fontSize: 9, color: colors.textMuted, marginBottom: 2 }}>• {name}</Text>
                                                ))}
                                            </View>
                                        )}

                                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                            {report.summary.rfis?.length > 0 && (
                                                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 8 }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginBottom: 4 }}>RFIs</Text>
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
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginBottom: 4 }}>Snags</Text>
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
                    </View>
                ))}
            </View>

            {reports.length === 0 && (
                <View style={{ marginTop: 30, alignItems: 'center' }}>
                    <Feather name="calendar" size={32} color={colors.border} />
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No weekly reports yet</Text>
                    <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>Reports are auto-generated every Sunday at 11:59 PM</Text>
                </View>
            )}
        </ScrollView>
    );
}
