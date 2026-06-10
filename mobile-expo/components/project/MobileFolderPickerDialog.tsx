import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Modal, ScrollView, StyleSheet, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { getFolders, createFolder } from '@/services/folderService';

interface MobileFolderPickerDialogProps {
    visible: boolean;
    onClose: () => void;
    project: any;
    selectedFolderIds: (string | number)[];
    onConfirm: (folderIds: (string | number)[]) => void;
    submitting?: boolean;
    onlyTopLevel?: boolean;
    hideCreate?: boolean;
    title?: string;
}

export default function MobileFolderPickerDialog({
    visible,
    onClose,
    project,
    selectedFolderIds,
    onConfirm,
    submitting = false,
    onlyTopLevel = false,
    hideCreate = false,
    title
}: MobileFolderPickerDialogProps) {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const [docFolders, setDocFolders] = useState<any[]>([]);
    const [photoFolders, setPhotoFolders] = useState<any[]>([]);
    const [tempSelection, setTempSelection] = useState<(string | number)[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'document' | 'photo'>('document');
    const [currentParentId, setCurrentParentId] = useState<string | null>(null);

    // New folder creation states
    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [submittingFolder, setSubmittingFolder] = useState(false);

    useEffect(() => {
        if (visible && project?.id) {
            fetchFolders();
            setTempSelection([...selectedFolderIds]);
            setCurrentParentId(null);
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
            Alert.alert(t('projectRfi.error'), t('projectRfi.failedToLoadFolders'));
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

    const submitNewFolder = async () => {
        if (!newFolderName.trim() || !project?.id) return;
        setSubmittingFolder(true);
        try {
            const res = await createFolder({
                project_id: String(project.id),
                name: newFolderName.trim(),
                parent_id: currentParentId,
                folder_type: activeTab
            });
            await fetchFolders();
            // Automatically select newly created folder
            if (res?.id) {
                setTempSelection(prev => [...prev, res.id]);
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
        const folders = activeTab === 'document' ? docFolders : photoFolders;
        return folders.filter(f => {
            const nameLower = f.name.toLowerCase();
            return nameLower !== 'archive' && nameLower !== 'confirmation' && nameLower !== 'confirmations';
        });
    };

    const getFoldersInCurrentLevel = () => {
        const valid = getValidFolders();
        return valid.filter(f => String(f.parent_id ?? 'null') === String(currentParentId ?? 'null'));
    };

    const getBreadcrumbs = () => {
        const tabLabel = activeTab === 'document' ? t('projectRfi.documents') : t('projectRfi.photos');
        if (currentParentId === null) return tabLabel;

        const folders = activeTab === 'document' ? docFolders : photoFolders;
        const path: string[] = [];
        let current = folders.find(f => String(f.id) === String(currentParentId));
        while (current) {
            path.unshift(current.name);
            current = folders.find(f => String(f.id) === String(current.parent_id));
        }
        return tabLabel + " > " + path.join(" > ");
    };

    const goUp = () => {
        if (currentParentId === null) return;
        const folders = activeTab === 'document' ? docFolders : photoFolders;
        const currentFolderObj = folders.find(f => String(f.id) === String(currentParentId));
        const parentId = currentFolderObj ? (currentFolderObj.parent_id ?? null) : null;
        setCurrentParentId(parentId);
    };

    const handleTabChange = (tab: 'document' | 'photo') => {
        setActiveTab(tab);
        setCurrentParentId(null);
    };

    const isAnyDescendantSelected = (parentId: string | number | null): boolean => {
        if (parentId === null) return false;
        const folders = activeTab === 'document' ? docFolders : photoFolders;
        const descendants = new Set<string>();
        const queue = [String(parentId)];
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            folders.forEach(f => {
                if (f.parent_id && String(f.parent_id) === currentId) {
                    const childId = String(f.id);
                    if (!descendants.has(childId)) {
                        descendants.add(childId);
                        queue.push(childId);
                    }
                }
            });
        }
        return tempSelection.some(id => descendants.has(String(id)));
    };

    const shouldIncludeParent = currentParentId !== null && !isAnyDescendantSelected(currentParentId);

    const effectiveSelection = 
        shouldIncludeParent && !tempSelection.some(id => String(id) === String(currentParentId))
            ? [...tempSelection, currentParentId]
            : tempSelection;

    const hasChanges = 
        effectiveSelection.length !== selectedFolderIds.length || 
        !selectedFolderIds.every(id => effectiveSelection.some(tId => String(tId) === String(id)));

    const currentLevelFolders = getFoldersInCurrentLevel();
    const visibleFolderIds = currentLevelFolders.map(f => String(f.id));
    const isAnyVisibleSelected = currentLevelFolders.some(f => 
        effectiveSelection.some(id => String(id) === String(f.id))
    );

    const handleToggleAll = () => {
        if (isAnyVisibleSelected) {
            setTempSelection(prev => prev.filter(id => !visibleFolderIds.includes(String(id))));
        } else {
            setTempSelection(prev => {
                const newSelection = [...prev];
                currentLevelFolders.forEach(f => {
                    if (!newSelection.some(id => String(id) === String(f.id))) {
                        newSelection.push(f.id);
                    }
                });
                return newSelection;
            });
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                    <View style={styles.header}>
                        <View>
                            <Text style={[styles.title, { color: colors.text }]}>{title || t('projectRfi.linkFolders')}</Text>
                            <Text style={{ fontSize: 11, color: colors.textMuted }}>{t('projectRfi.foldersSelected', { count: effectiveSelection.length })}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Feather name="x" size={20} color={colors.text} />
                        </TouchableOpacity>
                    </View>
 
                    <View style={[styles.tabBar, { borderBottomColor: colors.border, marginBottom: 8 }]}>
                        <TouchableOpacity 
                            onPress={() => handleTabChange('document')}
                            style={[styles.tab, activeTab === 'document' && { borderBottomColor: colors.primary }]}
                        >
                            <Text style={[styles.tabText, { color: activeTab === 'document' ? colors.primary : colors.textMuted }]}>{t('projectRfi.documents')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => handleTabChange('photo')}
                            style={[styles.tab, activeTab === 'photo' && { borderBottomColor: colors.primary }]}
                        >
                            <Text style={[styles.tabText, { color: activeTab === 'photo' ? colors.primary : colors.textMuted }]}>{t('projectRfi.photos')}</Text>
                        </TouchableOpacity>
                    </View>

                    {currentLevelFolders.length > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, marginBottom: 12 }}>
                            <TouchableOpacity 
                                onPress={handleToggleAll}
                                activeOpacity={0.7}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 20,
                                    borderWidth: 1,
                                    backgroundColor: isAnyVisibleSelected ? (colors.primary + '15') : (colors.border + '40'),
                                    borderColor: isAnyVisibleSelected ? colors.primary : colors.border,
                                }}
                            >
                                <Feather 
                                    name={isAnyVisibleSelected ? "minus-square" : "check-square"} 
                                    size={12} 
                                    color={isAnyVisibleSelected ? colors.primary : colors.textMuted} 
                                />
                                <Text style={{ 
                                    fontSize: 10, 
                                    fontWeight: 'bold', 
                                    color: isAnyVisibleSelected ? colors.primary : colors.textMuted,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5
                                }}>
                                    {isAnyVisibleSelected ? "Unselect All" : "Select All"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
 
                    <ScrollView style={styles.scrollContainer}>
                        {loading ? (
                            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
                        ) : (
                            <View style={{ flex: 1 }}>
                                {/* Breadcrumbs */}
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
                                        const isSelected = effectiveSelection.some(tId => String(tId) === String(folder.id));
                                        return (
                                            <TouchableOpacity
                                                key={folder.id}
                                                onPress={() => {
                                                    if (onlyTopLevel) {
                                                        toggleFolder(folder.id);
                                                    } else {
                                                        setCurrentParentId(folder.id);
                                                    }
                                                }}
                                                style={[
                                                    styles.folderItem,
                                                    { borderColor: colors.border },
                                                    isSelected && { backgroundColor: colors.primary + '15', borderColor: colors.primary }
                                                ]}
                                            >
                                                {/* Absolute corner selection checkbox */}
                                                {onlyTopLevel ? (
                                                    <View style={styles.checkboxContainer}>
                                                        <Feather 
                                                            name={isSelected ? "check-circle" : "circle"} 
                                                            size={16} 
                                                            color={isSelected ? colors.primary : colors.textMuted} 
                                                        />
                                                    </View>
                                                ) : (
                                                    <TouchableOpacity 
                                                        onPress={() => toggleFolder(folder.id)}
                                                        style={styles.checkboxContainer}
                                                    >
                                                        <Feather 
                                                            name={isSelected ? "check-circle" : "circle"} 
                                                            size={16} 
                                                            color={isSelected ? colors.primary : colors.textMuted} 
                                                        />
                                                    </TouchableOpacity>
                                                )}

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

                                    {!hideCreate && (
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
                                    )}
 
                                    {getFoldersInCurrentLevel().length === 0 && currentParentId !== null && (
                                        <View style={styles.emptyContainer}>
                                            <Feather name="folder-minus" size={32} color={colors.border} />
                                            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                                                This folder is empty
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </ScrollView>
 
                    <View style={styles.footer}>
                        <TouchableOpacity onPress={onClose} style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}>
                            <Text style={{ color: colors.textMuted }}>{t('projectRfi.cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => onConfirm(effectiveSelection)} 
                            disabled={submitting || !hasChanges}
                            style={[
                                styles.button, 
                                styles.confirmButton,
                                (submitting || !hasChanges) && { opacity: 0.5 }
                            ]}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t('projectRfi.confirm')}</Text>
                            )}
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
        marginBottom: 16,
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
        minHeight: 250,
        marginBottom: 20,
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
        position: 'relative',
    },
    checkboxContainer: {
        position: 'absolute',
        top: 6,
        right: 6,
        padding: 4,
        zIndex: 10,
    },
    folderName: {
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 12,
        paddingHorizontal: 2,
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
