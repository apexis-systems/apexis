import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getFolders, bulkUpdateFolders } from '@/services/folderService';
import { bulkUpdateFiles } from '@/services/fileService';
import { Alert } from 'react-native';

interface MoveToFolderDialogProps {
    visible: boolean;
    onClose: () => void;
    project: any;
    item?: { type: 'file' | 'folder', id: string | number } | null;
    selectedItems?: { folders: (string | number)[], files: (string | number)[] };
    onMoveComplete: (folderId: string | null) => void;
    type?: 'photo' | 'document';
    hideSuccessAlert?: boolean;
    onConfirm?: (targetFolderId: string | null) => Promise<void>;
}

export default function MobileMoveToFolderDialog({
    visible,
    onClose,
    project,
    item,
    selectedItems,
    onMoveComplete,
    type,
    hideSuccessAlert,
    onConfirm
}: MoveToFolderDialogProps) {
    const { colors } = useTheme();
    const [folders, setFolders] = useState<any[]>([]);
    const [targetFolder, setTargetFolder] = useState<string | null | undefined>(undefined);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible && project?.id) {
            fetchFolders();
            setTargetFolder(undefined); // Reset selection when opening
        }
    }, [visible, project?.id]);

    const fetchFolders = async () => {
        try {
            const data = await getFolders(project.id, type); // Fetch filtered to show tree
            if (data.folderData) setFolders(data.folderData);
            else if (Array.isArray(data)) setFolders(data);
        } catch (e) {
            Alert.alert("Error", "Failed to load folders");
        }
    };

    const handleMove = async () => {
        setLoading(true);
        try {
            if (onConfirm) {
                await onConfirm(targetFolder as string | null);
            } else {
                const promises = [];

                if (item) {
                    if (item.type === 'folder') {
                        promises.push(bulkUpdateFolders({ ids: [item.id], parent_id: targetFolder as string | null }));
                    } else {
                        promises.push(bulkUpdateFiles({ ids: [item.id], folder_id: targetFolder as string | null }));
                    }
                } else if (selectedItems) {
                    if (selectedItems.folders.length > 0) {
                        promises.push(bulkUpdateFolders({ ids: selectedItems.folders, parent_id: targetFolder as string | null }));
                    }
                    if (selectedItems.files.length > 0) {
                        promises.push(bulkUpdateFiles({ ids: selectedItems.files, folder_id: targetFolder as string | null }));
                    }
                }

                await Promise.all(promises);
                if (!hideSuccessAlert) {
                    Alert.alert("Success", "Items moved successfully");
                }
            }
            onMoveComplete(targetFolder as string | null);
            onClose();
        } catch (e) {
            Alert.alert("Error", "Failed to move items");
        } finally {
            setLoading(false);
        }
    };

    const renderFolderTree = (parentId: string | null = null, depth = 0) => {
        return folders
            .filter(f => String(f.parent_id ?? 'null') === String(parentId ?? 'null'))
            .map(folder => {
                // If moving a folder, don't allow moving it into itself or its children
                if (item?.type === 'folder' && String(item.id) === String(folder.id)) return null;
                if (selectedItems?.folders.some(id => String(id) === String(folder.id))) return null;

                const isSelected = targetFolder === folder.id;
                return (
                    <View key={folder.id}>
                        <TouchableOpacity
                            onPress={() => setTargetFolder(folder.id)}
                            style={[
                                styles.folderItem,
                                isSelected && { backgroundColor: colors.primary },
                                { paddingLeft: depth * 20 + 12 }
                            ]}
                        >
                            <Feather name="folder" size={16} color={isSelected ? "#fff" : colors.primary} />
                            <Text style={[styles.folderName, { color: isSelected ? "#fff" : colors.text }]}>{folder.name}</Text>
                        </TouchableOpacity>
                        {renderFolderTree(folder.id, depth + 1)}
                    </View>
                );
            });
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>Move to Folder</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Feather name="x" size={20} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollContainer}>
                        <TouchableOpacity
                            onPress={() => setTargetFolder(null)}
                            style={[
                                styles.folderItem,
                                targetFolder === null && { backgroundColor: colors.primary }
                            ]}
                        >
                            <Feather name="folder" size={16} color={targetFolder === null ? "#fff" : colors.primary} />
                            <Text style={[styles.folderName, { color: targetFolder === null ? "#fff" : colors.text }]}>Root Folder</Text>
                        </TouchableOpacity>
                        {renderFolderTree(null)}
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity onPress={onClose} style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}>
                            <Text style={{ color: colors.textMuted }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={handleMove} 
                            disabled={loading || targetFolder === undefined} 
                            style={[
                                styles.button, 
                                styles.moveButton,
                                (loading || targetFolder === undefined) && { opacity: 0.5 }
                            ]}
                        >
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>{loading ? 'Moving...' : 'Move Here'}</Text>
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
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    scrollContainer: {
        marginBottom: 20,
    },
    folderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 8,
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
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        borderWidth: 1,
    },
    moveButton: {
        backgroundColor: '#f97415',
    }
});
