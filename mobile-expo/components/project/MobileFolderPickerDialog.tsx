import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Modal, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getFolders } from '@/services/folderService';
import { Alert } from 'react-native';

interface MobileFolderPickerDialogProps {
    visible: boolean;
    onClose: () => void;
    project: any;
    selectedFolderIds: (string | number)[];
    onConfirm: (folderIds: (string | number)[]) => void;
    submitting?: boolean;
}

export default function MobileFolderPickerDialog({
    visible,
    onClose,
    project,
    selectedFolderIds,
    onConfirm,
    submitting = false
}: MobileFolderPickerDialogProps) {
    const { colors, isDark } = useTheme();
    const [docFolders, setDocFolders] = useState<any[]>([]);
    const [photoFolders, setPhotoFolders] = useState<any[]>([]);
    const [tempSelection, setTempSelection] = useState<(string | number)[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'document' | 'photo'>('document');

    useEffect(() => {
        if (visible && project?.id) {
            fetchFolders();
            setTempSelection([...selectedFolderIds]);
        }
    }, [visible, project?.id]);

    const fetchFolders = async () => {
        setLoading(true);
        try {
            const [docData, photoData] = await Promise.all([
                getFolders(project.id, 'document'),
                getFolders(project.id, 'photo')
            ]);
            
            const extract = (data: any) => data.folderData ? data.folderData : (Array.isArray(data) ? data : []);
            setDocFolders(extract(docData));
            setPhotoFolders(extract(photoData));
        } catch (e) {
            Alert.alert("Error", "Failed to load folders");
        } finally {
            setLoading(false);
        }
    };

    const toggleFolder = (folderId: string | number) => {
        setTempSelection(prev => 
            prev.includes(folderId) 
                ? prev.filter(id => id !== folderId) 
                : [...prev, folderId]
        );
    };

    const renderFolderTree = (folders: any[], parentId: string | null = null, depth = 0) => {
        return folders
            .filter(f => String(f.parent_id ?? 'null') === String(parentId ?? 'null'))
            .map(folder => {
                const isSelected = tempSelection.includes(folder.id);
                return (
                    <View key={folder.id}>
                        <TouchableOpacity
                            onPress={() => toggleFolder(folder.id)}
                            style={[
                                styles.folderItem,
                                isSelected && { backgroundColor: colors.primary + '20' },
                                { paddingLeft: depth * 20 + 12 }
                            ]}
                        >
                            <Feather name="folder" size={16} color={isSelected ? colors.primary : colors.textMuted} />
                            <Text style={[styles.folderName, { color: colors.text, flex: 1 }]}>{folder.name}</Text>
                            {isSelected && <Feather name="check-circle" size={16} color={colors.primary} />}
                        </TouchableOpacity>
                        {renderFolderTree(folders, folder.id, depth + 1)}
                    </View>
                );
            });
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                    <View style={styles.header}>
                        <View>
                            <Text style={[styles.title, { color: colors.text }]}>Link Folders</Text>
                            <Text style={{ fontSize: 11, color: colors.textMuted }}>{tempSelection.length} folders selected</Text>
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Feather name="x" size={20} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
                        <TouchableOpacity 
                            onPress={() => setActiveTab('document')}
                            style={[styles.tab, activeTab === 'document' && { borderBottomColor: colors.primary }]}
                        >
                            <Text style={[styles.tabText, { color: activeTab === 'document' ? colors.primary : colors.textMuted }]}>Documents</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setActiveTab('photo')}
                            style={[styles.tab, activeTab === 'photo' && { borderBottomColor: colors.primary }]}
                        >
                            <Text style={[styles.tabText, { color: activeTab === 'photo' ? colors.primary : colors.textMuted }]}>Photos</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollContainer}>
                        {loading ? (
                            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
                        ) : (
                            renderFolderTree(activeTab === 'document' ? docFolders : photoFolders, null)
                        )}
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity onPress={onClose} style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}>
                            <Text style={{ color: colors.textMuted }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => onConfirm(tempSelection)} 
                            disabled={submitting}
                            style={[
                                styles.button, 
                                styles.confirmButton,
                                submitting && { opacity: 0.7 }
                            ]}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Confirm</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '85%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        marginBottom: 10,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
    },
    scrollContainer: {
        minHeight: 200,
        marginBottom: 20,
    },
    folderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 8,
        marginVertical: 1,
    },
    folderName: {
        fontSize: 14,
    },
    footer: {
        flexDirection: 'row',
        gap: 10,
    },
    button: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        borderWidth: 1,
    },
    confirmButton: {
        backgroundColor: '#f97415',
    }
});
