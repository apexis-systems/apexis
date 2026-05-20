import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Modal, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getFolders, bulkUpdateFolders, createFolder } from '@/services/folderService';
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
    const [currentParentId, setCurrentParentId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    // New folder states
    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [submittingFolder, setSubmittingFolder] = useState(false);

    useEffect(() => {
        if (visible && project?.id) {
            fetchFolders();
            setTargetFolder(null); // Reset selection to Root when opening
            setCurrentParentId(null);
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

    const submitNewFolder = async () => {
        if (!newFolderName.trim() || !project?.id) return;
        setSubmittingFolder(true);
        try {
            const res = await createFolder({
                project_id: String(project.id),
                name: newFolderName.trim(),
                parent_id: currentParentId,
                folder_type: type || 'photo'
            });
            await fetchFolders();
            if (res?.id) {
                setTargetFolder(res.id);
            }
            setShowNewFolderModal(false);
            setNewFolderName('');
        } catch (err) {
            Alert.alert("Error", "Failed to create folder");
        } finally {
            setSubmittingFolder(false);
        }
    };

    const getValidFolders = () => {
        const invalidSet = new Set<string>();
        
        const isDirectlyInvalid = (folder: any) => {
            const folderNameLower = folder.name.toLowerCase();
            if (folderNameLower === 'archive' || folderNameLower === 'confirmation' || folderNameLower === 'confirmations') {
                return true;
            }
            if (item?.type === 'folder' && String(item.id) === String(folder.id)) {
                return true;
            }
            if (selectedItems?.folders.some(id => String(id) === String(folder.id))) {
                return true;
            }
            return false;
        };

        folders.forEach(folder => {
            if (isDirectlyInvalid(folder)) {
                invalidSet.add(String(folder.id));
            }
        });

        let added = true;
        while (added) {
            added = false;
            folders.forEach(folder => {
                if (folder.parent_id && !invalidSet.has(String(folder.id))) {
                    if (invalidSet.has(String(folder.parent_id))) {
                        invalidSet.add(String(folder.id));
                        added = true;
                    }
                }
            });
        }

        return folders.filter(folder => !invalidSet.has(String(folder.id)));
    };

    const getFoldersInCurrentLevel = () => {
        const valid = getValidFolders();
        return valid.filter(f => String(f.parent_id ?? 'null') === String(currentParentId ?? 'null'));
    };

    const getBreadcrumbs = () => {
        if (currentParentId === null) return "Root Folder";
        const path: string[] = [];
        let current = folders.find(f => String(f.id) === String(currentParentId));
        while (current) {
            path.unshift(current.name);
            current = folders.find(f => String(f.id) === String(current.parent_id));
        }
        return "Root > " + path.join(" > ");
    };

    const goUp = () => {
        if (currentParentId === null) return;
        const currentFolderObj = folders.find(f => String(f.id) === String(currentParentId));
        const parentId = currentFolderObj ? (currentFolderObj.parent_id ?? null) : null;
        setCurrentParentId(parentId);
        setTargetFolder(parentId);
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>Move to Folder</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                            {/* <TouchableOpacity onPress={() => setShowNewFolderModal(true)} style={{ padding: 4 }}>
                                <Feather name="folder-plus" size={20} color={colors.primary} />
                            </TouchableOpacity> */}
                            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                                <Feather name="x" size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView style={styles.scrollContainer}>
                        <View style={[styles.breadcrumbContainer, { backgroundColor: colors.border + '30' }]}>
                            <Feather name="folder" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                            <Text numberOfLines={1} style={[styles.breadcrumbText, { color: colors.textMuted }]}>
                                {getBreadcrumbs()}
                            </Text>
                        </View>

                        <View style={styles.gridContainer}>
                            {currentParentId !== null && (
                                <TouchableOpacity
                                    onPress={goUp}
                                    style={[
                                        styles.folderItem,
                                        { borderColor: colors.border, borderStyle: 'dashed' },
                                    ]}
                                >
                                    <Feather name="corner-left-up" size={22} color={colors.primary} />
                                    <Text 
                                        numberOfLines={1} 
                                        style={[styles.folderName, { color: colors.text }]}
                                    >
                                        Go Up
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {getFoldersInCurrentLevel().map(folder => {
                                return (
                                    <TouchableOpacity
                                        key={folder.id}
                                        onPress={() => {
                                            setCurrentParentId(folder.id);
                                            setTargetFolder(folder.id);
                                        }}
                                        style={[
                                            styles.folderItem,
                                            { borderColor: colors.border },
                                        ]}
                                    >
                                        <Feather name="folder" size={22} color={colors.primary} />
                                        <Text 
                                            numberOfLines={2} 
                                            style={[styles.folderName, { color: colors.text }]}
                                        >
                                            {folder.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}

                            <TouchableOpacity
                                onPress={() => setShowNewFolderModal(true)}
                                style={[
                                    styles.folderItem,
                                    { borderColor: colors.border, borderStyle: 'dashed' },
                                ]}
                            >
                                <Feather name="folder-plus" size={22} color={colors.primary} />
                                <Text 
                                    numberOfLines={1} 
                                    style={[styles.folderName, { color: colors.text }]}
                                >
                                    New Folder
                                </Text>
                            </TouchableOpacity>

                            {getFoldersInCurrentLevel().length === 0 && currentParentId !== null && (
                                <View style={styles.emptyContainer}>
                                    <Feather name="folder-minus" size={32} color={colors.border} />
                                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                                        This folder is empty
                                    </Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity onPress={onClose} style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}>
                            <Text style={{ color: colors.textMuted }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={handleMove} 
                            disabled={loading || targetFolder === undefined || currentParentId === null} 
                            style={[
                                styles.button, 
                                styles.moveButton,
                                (loading || targetFolder === undefined || currentParentId === null) && { opacity: 0.5 }
                            ]}
                        >
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>{loading ? 'Moving...' : 'Move Here'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Create Folder Overlay - absolute sibling avoids multiple nested modals in iOS */}
                {showNewFolderModal && (
                    <View style={[StyleSheet.absoluteFill, { zIndex: 999, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }]}>
                        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border }}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 16 }}>Create New Folder</Text>
                            
                            <TextInput
                                value={newFolderName}
                                onChangeText={setNewFolderName}
                                placeholder="Folder Name"
                                placeholderTextColor={colors.textMuted}
                                autoFocus
                                style={{
                                    height: 44,
                                    borderRadius: 10,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    backgroundColor: colors.background,
                                    paddingHorizontal: 12,
                                    color: colors.text,
                                    fontSize: 14,
                                    marginBottom: 20,
                                }}
                            />

                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity
                                    onPress={() => { setShowNewFolderModal(false); setNewFolderName(''); }}
                                    style={{
                                        flex: 1,
                                        height: 40,
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={submitNewFolder}
                                    disabled={submittingFolder || !newFolderName.trim()}
                                    style={{
                                        flex: 1,
                                        height: 40,
                                        borderRadius: 10,
                                        backgroundColor: colors.primary,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        opacity: (!newFolderName.trim() || submittingFolder) ? 0.5 : 1,
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                                        {submittingFolder ? 'Creating...' : 'Create'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
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
    breadcrumbContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        marginBottom: 16,
    },
    breadcrumbText: {
        fontSize: 11,
        fontWeight: '700',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'flex-start',
        paddingVertical: 4,
    },
    folderItem: {
        width: '23%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 6,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 4,
    },
    folderName: {
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 12,
    },
    emptyContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        gap: 8,
    },
    emptyText: {
        fontSize: 12,
        fontWeight: '600',
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
