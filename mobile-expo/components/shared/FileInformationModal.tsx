import React from 'react';
import {
    View,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    StyleSheet,
    Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { formatFileSize } from '@/helpers/format';

interface FileInformationModalProps {
    visible: boolean;
    onClose: () => void;
    file: any;
    folders: any[];
    projectName: string;
}

export default function FileInformationModal({
    visible,
    onClose,
    file,
    folders,
    projectName
}: FileInformationModalProps) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();

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
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.backdrop}>
                    <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                        <View
                            style={[
                                styles.sheetContainer,
                                {
                                    backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
                                    borderTopColor: colors.border,
                                    paddingBottom: Math.max(insets.bottom + 16, 24)
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

                            {/* Main Details Section */}
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
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
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
        borderTopWidth: 1
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
