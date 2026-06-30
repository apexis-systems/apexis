import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    StyleSheet,
    Platform,
    ScrollView,
    ActivityIndicator,
    Alert,
    Dimensions
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { formatFileSize } from '@/helpers/format';
import { useAuth } from '@/contexts/AuthContext';
import { getFileVersions, promoteFile, deleteFile, getFileFlagHistory } from '../../services/fileService';

interface FileInformationModalProps {
    visible: boolean;
    onClose: () => void;
    file: any;
    folders: any[];
    projectName: string;
    onUpdate?: (updatedFile: any) => void;
}

export default function FileInformationModal({
    visible,
    onClose,
    file,
    folders,
    projectName,
    onUpdate
}: FileInformationModalProps) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { t } = useTranslation();

    const [versions, setVersions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [promotingVersionId, setPromotingVersionId] = useState<number | null>(null);
    const [deletingVersionId, setDeletingVersionId] = useState<number | null>(null);
    const [flagHistory, setFlagHistory] = useState<any[]>([]);
    const [loadingFlagHistory, setLoadingFlagHistory] = useState(false);

    const fetchVersions = useCallback(async () => {
        if (file?.id) {
            setLoading(true);
            try {
                const data = await getFileVersions(file.id);
                setVersions(data.versions || []);
            } catch (err) {
                console.error("fetchVersions mobile Error", err);
            } finally {
                setLoading(false);
            }
        }
    }, [file?.id]);

    const fetchFlagHistory = useCallback(async () => {
        if (file?.id) {
            setLoadingFlagHistory(true);
            try {
                const data = await getFileFlagHistory(file.id);
                setFlagHistory(data.history || []);
            } catch (err) {
                console.error("fetchFlagHistory mobile Error", err);
            } finally {
                setLoadingFlagHistory(false);
            }
        }
    }, [file?.id]);

    useEffect(() => {
        if (visible && file?.id) {
            fetchVersions();
            fetchFlagHistory();
        }
        return () => {
            setVersions([]);
            setFlagHistory([]);
        };
    }, [visible, file?.id, fetchVersions, fetchFlagHistory]);

    const handlePromote = async (versionId: number) => {
        try {
            setPromotingVersionId(versionId);
            await promoteFile(versionId);
            Alert.alert(t('common.success'), t('projectDocuments.versionPromotedSuccess'));
            fetchVersions();
            const promoted = versions.find(v => v.id === versionId);
            if (promoted && onUpdate) {
                onUpdate({ ...promoted, is_current: true });
            }
        } catch (err) {
            console.error(err);
            Alert.alert(t('common.error'), t('projectDocuments.failedPromoteVersion'));
        } finally {
            setPromotingVersionId(null);
        }
    };

    const handleDelete = async (versionId: number) => {
        Alert.alert(
            t('projectDocuments.deleteVersion'),
            t('projectDocuments.confirmDeleteVersion'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setDeletingVersionId(versionId);
                            await deleteFile(versionId);
                            Alert.alert(t('common.success'), t('projectDocuments.versionDeletedSuccess'));
                            if (versionId === file.id) {
                                const remaining = versions.filter(v => v.id !== versionId);
                                if (remaining.length > 0) {
                                    if (onUpdate) {
                                        onUpdate({ ...remaining[0], is_current: true });
                                    }
                                } else {
                                    onClose();
                                }
                            }
                            fetchVersions();
                        } catch (err) {
                            console.error(err);
                            Alert.alert(t('common.error'), t('projectDocuments.failedDeleteVersion'));
                        } finally {
                            setDeletingVersionId(null);
                        }
                    }
                }
            ]
        );
    };

    if (!file) return null;

    // Derive file format
    const getFileFormat = () => {
        if (file.file_type) {
            const parts = file.file_type.split('/');
            if (parts.length > 1) {
                const type = parts[1].toUpperCase();
                // If it's a long MIME subtype, trim it or keep it simple
                return type.length > 5 ? type.slice(0, 4) : type;
            }
        }
        const ext = file.file_name?.split('.').pop();
        return ext ? ext.toUpperCase() : 'UNKNOWN';
    };

    // Format uploaded date/time
    const formatUploadedDate = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;

        const day = date.getDate();
        const months = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${day} ${month} ${year} at ${hours}:${minutes}`;
    };

    // Construct folder path
    const getFolderPath = () => {
        if (!file.folder_id) return projectName;
        const path: string[] = [];
        let currentId: any = file.folder_id;
        let limit = 50; // Safety break

        while (currentId && limit > 0) {
            const folder = folders.find(f => String(f.id) === String(currentId));
            if (folder) {
                path.unshift(folder.name);
                currentId = folder.parent_id;
            } else {
                break;
            }
            limit--;
        }
        return [projectName, ...path].join(' / ');
    };

    console.log(file);



    const fileSizeStr = file.file_size_mb != null ? formatFileSize(file.file_size_mb) : '';
    const fileFormatStr = getFileFormat();
    const folderPathStr = getFolderPath();
    const uploadedDateStr = formatUploadedDate(file.createdAt);

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={StyleSheet.absoluteFillObject} />
                </TouchableWithoutFeedback>
                <View
                    style={[
                        styles.sheetContainer,
                        {
                            backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
                            borderTopColor: colors.border,
                            paddingBottom: Platform.OS === 'ios' ? 0 : Math.max(insets.bottom + 16, 24)
                        }
                    ]}
                >
                    {/* Drag Indicator */}
                    <View style={[styles.dragIndicator, { backgroundColor: isDark ? '#3a3a3c' : '#e5e5ea' }]} />

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>
                            File Details
                        </Text>
                        <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}>
                            <Feather name="x" size={18} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Scrollable Content */}
                    <ScrollView 
                        showsVerticalScrollIndicator={false} 
                        style={{ maxHeight: Dimensions.get('window').height * 0.65 }}
                        contentContainerStyle={{ paddingBottom: 50 }}
                    >
                        <View style={styles.content}>
                            {/* Date and Time */}
                            <Text style={[styles.dateText, { color: colors.text }]}>
                                {uploadedDateStr || 'Unknown date'}
                            </Text>

                            {/* File Name */}
                            <Text style={[styles.fileNameText, { color: isDark ? '#a2a2a7' : '#8e8e93' }]}>
                                {file.file_name}
                            </Text>

                            {/* Size and Format Details */}
                            <View style={[styles.detailsRow, { borderColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}>
                                <View style={styles.detailItem}>
                                    <Text style={[styles.detailLabel, { color: isDark ? '#a2a2a7' : '#8e8e93' }]}>Format</Text>
                                    <Text style={[styles.detailValue, { color: colors.text }]}>{fileFormatStr}</Text>
                                </View>
                                <View style={[styles.verticalDivider, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' }]} />
                                <View style={styles.detailItem}>
                                    <Text style={[styles.detailLabel, { color: isDark ? '#a2a2a7' : '#8e8e93' }]}>Size</Text>
                                    <Text style={[styles.detailValue, { color: colors.text }]}>{fileSizeStr || '—'}</Text>
                                </View>
                            </View>

                            {/* Location/Folder Path */}
                            <View style={styles.pathContainer}>
                                <View style={[styles.iconContainer, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}>
                                    <Feather name="folder" size={18} color={colors.primary} />
                                </View>
                                <View style={styles.pathTextContainer}>
                                    <Text style={[styles.pathLabel, { color: isDark ? '#a2a2a7' : '#8e8e93' }]}>Folder Path</Text>
                                    <Text style={[styles.pathValue, { color: colors.text }]} numberOfLines={2}>
                                        {folderPathStr}
                                    </Text>
                                </View>
                            </View>

                            {/* Version History Section */}
                            {file.file_type && !file.file_type.startsWith('image/') && (
                                <View style={[styles.versionsSection, { borderTopColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}>
                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Version History</Text>
                                    {loading ? (
                                        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 10 }} />
                                    ) : versions.length === 0 ? (
                                        <Text style={{ color: colors.textMuted, fontSize: 13, marginVertical: 10 }}>No other versions found</Text>
                                    ) : (
                                        <View style={styles.versionsList}>
                                            {versions.map((v, idx) => {
                                                const isActive = file.id === v.id;
                                                const isCurrent = v.is_current;
                                                return (
                                                    <View 
                                                        key={v.id} 
                                                        style={[
                                                            styles.versionItem, 
                                                            { 
                                                                borderColor: isActive ? colors.primary : (isDark ? '#2c2c2e' : '#f2f2f7'),
                                                                backgroundColor: isActive ? (isDark ? 'rgba(0,122,255,0.15)' : 'rgba(0,122,255,0.05)') : 'transparent'
                                                            }
                                                        ]}
                                                    >
                                                        <View style={{ flex: 1 }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                                                                    V{versions.length - idx}
                                                                </Text>
                                                                {isCurrent && (
                                                                    <View style={{ backgroundColor: isDark ? 'rgba(52, 199, 89, 0.2)' : 'rgba(52, 199, 89, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                                        <Text style={{ color: '#34c759', fontSize: 9, fontWeight: '700' }}>ACTIVE</Text>
                                                                    </View>
                                                                )}
                                                                {v.do_not_follow && (
                                                                    <View style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                                        <Text style={{ color: '#ef4444', fontSize: 9, fontWeight: '700' }}>DNF</Text>
                                                                    </View>
                                                                )}
                                                                {v.only_for_reference && (
                                                                    <View style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                                        <Text style={{ color: '#3b82f6', fontSize: 9, fontWeight: '700' }}>OFR</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 2 }}>{v.file_name}</Text>
                                                            <Text style={{ fontSize: 10, color: colors.textMuted }}>
                                                                {formatUploadedDate(v.createdAt)}
                                                            </Text>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                            {!isActive && (
                                                                <TouchableOpacity onPress={() => onUpdate && onUpdate(v)} style={{ padding: 6 }}>
                                                                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>VIEW</Text>
                                                                </TouchableOpacity>
                                                            )}
                                                            {!isCurrent && (user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'contributor') && (
                                                                <TouchableOpacity 
                                                                    onPress={() => handlePromote(v.id)} 
                                                                    style={{ padding: 6 }}
                                                                    disabled={promotingVersionId !== null || deletingVersionId !== null}
                                                                >
                                                                    {promotingVersionId === v.id ? (
                                                                        <ActivityIndicator size="small" color={colors.primary} />
                                                                    ) : (
                                                                        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                                                                            {t('projectDocuments.makeActive') || 'ACTIVATE'}
                                                                        </Text>
                                                                    )}
                                                                </TouchableOpacity>
                                                            )}
                                                            {/* {(user?.role === 'admin' || user?.role === 'superadmin' || String(v.created_by) === String(user?.id)) && (
                                                                <TouchableOpacity 
                                                                    onPress={() => handleDelete(v.id)} 
                                                                    style={{ padding: 6 }}
                                                                    disabled={promotingVersionId !== null || deletingVersionId !== null}
                                                                >
                                                                    {deletingVersionId === v.id ? (
                                                                        <ActivityIndicator size="small" color="#ef4444" />
                                                                    ) : (
                                                                        <Feather name="trash-2" size={16} color="#ef4444" />
                                                                    )}
                                                                </TouchableOpacity>
                                                            )} */}
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* DNF / OFR Flag History Section */}
                            {(file.file_type && !file.file_type.startsWith('image/')) && (
                                <View style={[styles.versionsSection, { borderTopColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}>
                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Flag History</Text>
                                    {loadingFlagHistory ? (
                                        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 10 }} />
                                    ) : flagHistory.length === 0 ? (
                                        <Text style={{ color: colors.textMuted, fontSize: 13, marginVertical: 10 }}>No flag changes recorded yet.</Text>
                                    ) : (
                                        <View style={{ gap: 10 }}>
                                            {flagHistory.map((entry: any, idx: number) => {
                                                const isDnf = entry.flag === 'do_not_follow';
                                                const isOn = entry.value === true;
                                                const dotColor = isDnf ? '#ef4444' : '#3b82f6';
                                                const cardBg = isDnf
                                                    ? (isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.07)')
                                                    : (isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.07)');
                                                const cardBorder = isDnf ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)';
                                                const flagLabel = isDnf ? 'DO NOT FOLLOW' : 'ONLY FOR REFERENCE';
                                                const actionLabel = isOn ? 'Enabled' : 'Disabled';
                                                const date = new Date(entry.createdAt);
                                                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                                const dateStr = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
                                                const timeStr = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
                                                return (
                                                    <View key={idx} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                                                        <View style={{ alignItems: 'center', paddingTop: 4 }}>
                                                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor }} />
                                                            {idx < flagHistory.length - 1 && (
                                                                <View style={{ width: 1, flex: 1, backgroundColor: isDark ? '#3a3a3c' : '#e5e5ea', marginTop: 4, minHeight: 24 }} />
                                                            )}
                                                        </View>
                                                        <View style={{ flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 2, backgroundColor: cardBg, borderColor: cardBorder }}>
                                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                                                                <Text style={{ fontSize: 9, fontWeight: '800', color: dotColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>{flagLabel}</Text>
                                                                <View style={{ backgroundColor: isOn ? dotColor + '33' : (isDark ? '#2c2c2e' : '#f2f2f7'), paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: isOn ? dotColor + '55' : (isDark ? '#3a3a3c' : '#e5e5ea') }}>
                                                                    <Text style={{ fontSize: 9, fontWeight: '800', color: isOn ? dotColor : colors.textMuted, textTransform: 'uppercase' }}>{isOn ? '▲ ON' : '▼ OFF'}</Text>
                                                                </View>
                                                            </View>
                                                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{actionLabel} by {entry.changer?.name || 'Unknown'}</Text>
                                                            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{dateStr} at {timeStr}</Text>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end'
    },
    sheetContainer: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 8,
        borderTopWidth: 1,
        maxHeight: Dimensions.get('window').height * 0.85,
    },
    versionsSection: {
        marginTop: 20,
        borderTopWidth: 1,
        paddingTop: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
    },
    versionsList: {
        gap: 10,
    },
    versionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    dragIndicator: {
        width: 36,
        height: 5,
        borderRadius: 2.5,
        alignSelf: 'center',
        marginBottom: 16
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    title: {
        fontSize: 18,
        fontWeight: '700'
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center'
    },
    content: {
        gap: 12
    },
    dateText: {
        fontSize: 20,
        fontWeight: '700',
        lineHeight: 26
    },
    fileNameText: {
        fontSize: 14,
        lineHeight: 18,
        marginBottom: 8
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        marginBottom: 8
    },
    detailItem: {
        flex: 1
    },
    detailLabel: {
        fontSize: 12,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    detailValue: {
        fontSize: 15,
        fontWeight: '600'
    },
    verticalDivider: {
        width: 1,
        height: 32,
        marginHorizontal: 16
    },
    pathContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 4
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center'
    },
    pathTextContainer: {
        flex: 1
    },
    pathLabel: {
        fontSize: 12,
        marginBottom: 2
    },
    pathValue: {
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 18
    }
});
