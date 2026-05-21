import React, { useState, useEffect } from 'react';
import {
    View,
    Modal,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { getProjectFiles, getLinkedItems, deleteLink } from '@/services/fileService';

interface LinkFileModalProps {
    visible: boolean;
    onClose: () => void;
    onLink: (fileId: number) => Promise<void>;
    projectId: string | number;
    currentFileId?: number;
}

export default function LinkFileModal({ visible, onClose, onLink, projectId, currentFileId }: LinkFileModalProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    
    const [files, setFiles] = useState<any[]>([]);
    const [folders, setFolders] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [linkingId, setLinkingId] = useState<number | null>(null);
    const [unlinkingId, setUnlinkingId] = useState<number | string | null>(null);
    const [activeTab, setActiveTab] = useState<'document' | 'photo'>('document');
    const [currentParentId, setCurrentParentId] = useState<string | number | null>(null);
    const [linkedItems, setLinkedItems] = useState<any[]>([]);

    useEffect(() => {
        if (visible && projectId) {
            loadFiles();
        } else {
            setSearchQuery('');
            setCurrentParentId(null);
            setLinkedItems([]);
        }
    }, [visible, projectId]);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const data = await getProjectFiles(projectId);
            if (data.fileData) {
                setFiles(data.fileData);
            }
            if (data.folderData) {
                setFolders(data.folderData);
            }

            if (currentFileId) {
                const linkData = await getLinkedItems(currentFileId);
                setLinkedItems(linkData.links || []);
            }
        } catch (error) {
            console.error('Error loading files:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLink = async (fileId: number) => {
        setLinkingId(fileId);
        try {
            await onLink(fileId);
            if (currentFileId) {
                const linkData = await getLinkedItems(currentFileId);
                setLinkedItems(linkData.links || []);
            }
        } finally {
            setLinkingId(null);
        }
    };

    const handleRemoveLink = async (item: any) => {
        if (!currentFileId) return;
        const targetType = item.type || item.target_type;
        const targetId = item.id || item.target_id;
        
        setUnlinkingId(targetId);
        try {
            await deleteLink(currentFileId, targetType, targetId);
            const linkData = await getLinkedItems(currentFileId);
            setLinkedItems(linkData.links || []);
        } catch (error) {
            console.error("Failed to remove link:", error);
        } finally {
            setUnlinkingId(null);
        }
    };

    const handleTabChange = (tab: 'document' | 'photo') => {
        setActiveTab(tab);
        setCurrentParentId(null);
    };

    const getValidFolders = () => {
        return folders.filter(f => {
            const nameLower = f.name.toLowerCase();
            return nameLower !== 'archive' && nameLower !== 'confirmation' && nameLower !== 'confirmations';
        });
    };

    const getFoldersInCurrentLevel = () => {
        const valid = getValidFolders().filter(f => f.folder_type === activeTab);
        return valid.filter(f => String(f.parent_id ?? 'null') === String(currentParentId ?? 'null'));
    };

    const getFilesInCurrentLevel = () => {
        return files.filter(f => {
            // Must not be the current file itself
            if (String(f.id) === String(currentFileId)) return false;
            
            // Check folder matching
            if (currentParentId === null) {
                // At root level, the file should have no folder_id, or its folder is missing,
                // and it matches the current tab type
                if (f.folder_id !== null && f.folder_id !== undefined) {
                    const folderExists = folders.some(fold => String(fold.id) === String(f.folder_id));
                    if (folderExists) return false;
                }
                const fileTypeTab = f.file_type?.startsWith('image/') ? 'photo' : 'document';
                return fileTypeTab === activeTab;
            } else {
                // Inside a folder, file's folder_id must match currentParentId
                if (String(f.folder_id) !== String(currentParentId)) return false;

                // Tab-specific check to prevent mixed-type folders from leaking documents into photos (or vice-versa)
                const isImg = f.file_type?.startsWith('image/') || f.file_name?.toLowerCase().endsWith('.jpg') || f.file_name?.toLowerCase().endsWith('.png') || f.file_name?.toLowerCase().endsWith('.jpeg');
                const fileTypeTab = isImg ? 'photo' : 'document';
                return fileTypeTab === activeTab;
            }
        });
    };

    const getFilteredSearchFiles = () => {
        return files.filter(f => {
            if (String(f.id) === String(currentFileId)) return false;
            if (!f.file_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

            const isImg = f.file_type?.startsWith('image/') || f.file_name?.toLowerCase().endsWith('.jpg') || f.file_name?.toLowerCase().endsWith('.png') || f.file_name?.toLowerCase().endsWith('.jpeg');
            const fileTypeTab = isImg ? 'photo' : 'document';
            return fileTypeTab === activeTab;
        });
    };

    const getBreadcrumbs = () => {
        const tabLabel = activeTab === 'document' ? t('linkFile.documentsTab') : t('linkFile.photosTab');
        if (currentParentId === null) return tabLabel;

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
        const currentFolderObj = folders.find(f => String(f.id) === String(currentParentId));
        const parentId = currentFolderObj ? (currentFolderObj.parent_id ?? null) : null;
        setCurrentParentId(parentId);
    };

    const renderFileGridItem = (item: any) => {
        const isLinking = linkingId === item.id;
        const isImage = item.file_type?.startsWith('image/') || item.file_name?.toLowerCase().endsWith('.jpg') || item.file_name?.toLowerCase().endsWith('.png') || item.file_name?.toLowerCase().endsWith('.jpeg');
        const isAlreadyLinked = linkedItems.some(link => link.type === 'file' && String(link.id) === String(item.id));

        if (isImage) {
            return (
                <View
                    key={item.id}
                    style={{
                        width: '30.5%',
                        height: 125,
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: colors.border,
                        marginBottom: 12,
                        position: 'relative',
                        justifyContent: 'space-between'
                    }}
                >
                    {/* Photo Preview Background */}
                    <View style={{ ...StyleSheet.absoluteFillObject }}>
                        {item.downloadUrl ? (
                            <Image
                                source={item.downloadUrl}
                                style={{ width: '100%', height: '100%' }}
                                contentFit="cover"
                                transition={200}
                            />
                        ) : (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
                                <Feather name="image" size={24} color={colors.textMuted} />
                            </View>
                        )}
                    </View>

                    {/* Translucent overlay at the bottom containing file details and link action */}
                    <View style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        padding: 6,
                        alignItems: 'center'
                    }}>
                        <Text
                            style={{ color: '#fff', fontSize: 9, fontWeight: '600', textAlign: 'center', marginBottom: 6, width: '100%' }}
                            numberOfLines={1}
                        >
                            {item.file_name}
                        </Text>
                        
                        <TouchableOpacity
                            style={{
                                backgroundColor: isAlreadyLinked ? 'rgba(255, 255, 255, 0.15)' : colors.primary,
                                paddingVertical: 4,
                                paddingHorizontal: 12,
                                borderRadius: 6,
                                width: '100%',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: isAlreadyLinked ? 1 : 0,
                                borderColor: isAlreadyLinked ? 'rgba(255,255,255,0.2)' : 'transparent'
                            }}
                            onPress={() => !isAlreadyLinked && handleLink(item.id)}
                            disabled={isLinking || isAlreadyLinked}
                        >
                            {isLinking ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={{ color: isAlreadyLinked ? colors.textMuted : '#fff', fontSize: 10, fontWeight: 'bold' }}>
                                    {isAlreadyLinked ? t('linkFile.linked') : t('linkFile.link')}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            );
        } else {
            return (
                <View
                    key={item.id}
                    style={{
                        width: '30.5%',
                        height: 125,
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        padding: 8,
                        marginBottom: 12,
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    {/* Document Icon Container */}
                    <View style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        backgroundColor: colors.background,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 4
                    }}>
                        <Feather
                            name={item.file_type?.includes('pdf') ? 'file' : 'file-text'}
                            size={20}
                            color={colors.primary}
                        />
                    </View>

                    {/* File Name */}
                    <Text
                        style={{
                            color: colors.text,
                            fontSize: 10,
                            fontWeight: '600',
                            textAlign: 'center',
                            marginVertical: 4,
                            lineHeight: 12,
                            width: '100%'
                        }}
                        numberOfLines={2}
                    >
                        {item.file_name}
                    </Text>

                    {/* Action Button */}
                    <TouchableOpacity
                        style={{
                            backgroundColor: isAlreadyLinked ? 'rgba(255, 255, 255, 0.08)' : colors.primary,
                            paddingVertical: 5,
                            borderRadius: 6,
                            width: '100%',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: isAlreadyLinked ? 1 : 0,
                            borderColor: isAlreadyLinked ? colors.border : 'transparent'
                        }}
                        onPress={() => !isAlreadyLinked && handleLink(item.id)}
                        disabled={isLinking || isAlreadyLinked}
                    >
                        {isLinking ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={{ color: isAlreadyLinked ? colors.textMuted : '#fff', fontSize: 10, fontWeight: 'bold' }}>
                                {isAlreadyLinked ? t('linkFile.linked') : t('linkFile.link')}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            );
        }
    };

    const getLinkedDocs = () => {
        return linkedItems.filter(item => 
            (item.type === 'file' || item.target_type === 'file') && 
            !(item.file_type?.startsWith('image/') || 
              item.title?.toLowerCase().endsWith('.jpg') || 
              item.title?.toLowerCase().endsWith('.png') || 
              item.title?.toLowerCase().endsWith('.jpeg') ||
              item.file_name?.toLowerCase().endsWith('.jpg') || 
              item.file_name?.toLowerCase().endsWith('.png') || 
              item.file_name?.toLowerCase().endsWith('.jpeg') ||
              item.name?.toLowerCase().endsWith('.jpg') ||
              item.name?.toLowerCase().endsWith('.png') ||
              item.name?.toLowerCase().endsWith('.jpeg'))
        );
    };

    const getLinkedPhotos = () => {
        return linkedItems.filter(item => 
            (item.type === 'file' || item.target_type === 'file') && 
            (item.file_type?.startsWith('image/') || 
             item.title?.toLowerCase().endsWith('.jpg') || 
             item.title?.toLowerCase().endsWith('.png') || 
             item.title?.toLowerCase().endsWith('.jpeg') ||
             item.file_name?.toLowerCase().endsWith('.jpg') || 
             item.file_name?.toLowerCase().endsWith('.png') || 
             item.file_name?.toLowerCase().endsWith('.jpeg') ||
             item.name?.toLowerCase().endsWith('.jpg') ||
             item.name?.toLowerCase().endsWith('.png') ||
             item.name?.toLowerCase().endsWith('.jpeg'))
        );
    };

    const getLinkedRFIs = () => {
        return linkedItems.filter(item => item.type === 'rfi' || item.target_type === 'rfi');
    };

    const getLinkedSnags = () => {
        return linkedItems.filter(item => item.type === 'snag' || item.target_type === 'snag');
    };

    const foldersInCurrentLevel = getFoldersInCurrentLevel();
    const filesInCurrentLevel = getFilesInCurrentLevel();

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
            transparent={false}
            statusBarTranslucent={true}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1, backgroundColor: colors.background }}
            >
                <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: currentFileId ? 0 : insets.bottom }}>
                    {/* Header */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                        backgroundColor: colors.surface
                    }}>
                        <TouchableOpacity onPress={onClose} style={{ marginRight: 16 }}>
                            <Feather name="arrow-left" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, flex: 1 }}>{t('linkFile.title')}</Text>
                    </View>

                    {/* Search Bar */}
                    <View style={{ padding: 16, backgroundColor: colors.background }}>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: colors.surface,
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            height: 44,
                            borderWidth: 1,
                            borderColor: colors.border
                        }}>
                            <Feather name="search" size={18} color={colors.textMuted} />
                            <TextInput
                                style={{ flex: 1, marginLeft: 8, color: colors.text, fontSize: 14 }}
                                placeholder={t('linkFile.searchPlaceholder')}
                                placeholderTextColor={colors.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery ? (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Feather name="x" size={16} color={colors.textMuted} />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>

                    {/* Tabs */}
                    {!searchQuery && (
                        <View style={{
                            flexDirection: 'row',
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                            backgroundColor: colors.surface
                        }}>
                            <TouchableOpacity
                                onPress={() => handleTabChange('document')}
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    paddingVertical: 12,
                                    borderBottomWidth: 2,
                                    borderBottomColor: activeTab === 'document' ? colors.primary : 'transparent'
                                }}
                            >
                                <Text style={{
                                    fontSize: 14,
                                    fontWeight: '600',
                                    color: activeTab === 'document' ? colors.primary : colors.textMuted
                                }}>
                                    {t('linkFile.documentsTab')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleTabChange('photo')}
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    paddingVertical: 12,
                                    borderBottomWidth: 2,
                                    borderBottomColor: activeTab === 'photo' ? colors.primary : 'transparent'
                                }}
                            >
                                <Text style={{
                                    fontSize: 14,
                                    fontWeight: '600',
                                    color: activeTab === 'photo' ? colors.primary : colors.textMuted
                                }}>
                                    {t('linkFile.photosTab')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Breadcrumbs */}
                    {!searchQuery && (
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            backgroundColor: colors.surface,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border
                        }}>
                            <Feather name="folder" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                            <Text numberOfLines={1} style={{
                                fontSize: 12,
                                fontWeight: '600',
                                color: colors.textMuted,
                                flex: 1
                            }}>
                                {getBreadcrumbs()}
                            </Text>
                        </View>
                    )}

                    {/* Loading or Content */}
                    {loading ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : searchQuery ? (
                        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
                            <Text style={{
                                fontSize: 12,
                                fontWeight: '700',
                                color: colors.textMuted,
                                marginBottom: 12,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5
                            }}>
                                {t('linkFile.searchResults')}
                            </Text>
                            <FlatList
                                data={getFilteredSearchFiles()}
                                keyExtractor={(item) => String(item.id)}
                                numColumns={3}
                                columnWrapperStyle={{ gap: 12 }}
                                renderItem={({ item }) => renderFileGridItem(item)}
                                contentContainerStyle={{ paddingBottom: 40 }}
                                ListEmptyComponent={
                                    <View style={{ alignItems: 'center', marginTop: 40, gap: 10 }}>
                                        <Feather name="search" size={36} color={colors.textMuted} />
                                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('linkFile.noFilesMatching', { query: searchQuery })}</Text>
                                    </View>
                                }
                            />
                        </View>
                    ) : (
                        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} style={{ flex: 1 }}>
                            {/* Folders Grid */}
                            {(currentParentId !== null || foldersInCurrentLevel.length > 0) && (
                                <View style={{
                                    flexDirection: 'row',
                                    flexWrap: 'wrap',
                                    gap: 12,
                                    padding: 16,
                                    justifyContent: 'flex-start'
                                }}>
                                    {currentParentId !== null && (
                                        <TouchableOpacity
                                            onPress={goUp}
                                            style={{
                                                width: '30%',
                                                height: 90,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: 8,
                                                borderRadius: 12,
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                                borderStyle: 'dashed',
                                                backgroundColor: colors.surface,
                                                marginBottom: 4
                                            }}
                                        >
                                            <Feather name="corner-left-up" size={24} color={colors.primary} />
                                            <Text numberOfLines={1} style={{
                                                fontSize: 11,
                                                fontWeight: '600',
                                                color: colors.text,
                                                marginTop: 8,
                                                textAlign: 'center'
                                            }}>
                                                Go Up
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                    {foldersInCurrentLevel.map(folder => (
                                        <TouchableOpacity
                                            key={folder.id}
                                            onPress={() => setCurrentParentId(folder.id)}
                                            style={{
                                                width: '30%',
                                                height: 90,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: 8,
                                                borderRadius: 12,
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                                backgroundColor: colors.surface,
                                                marginBottom: 4
                                            }}
                                        >
                                            <Feather name="folder" size={24} color={colors.primary} />
                                            <Text numberOfLines={2} style={{
                                                fontSize: 11,
                                                fontWeight: '600',
                                                color: colors.text,
                                                marginTop: 8,
                                                textAlign: 'center',
                                                lineHeight: 13
                                            }}>
                                                {folder.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* Files Section */}
                            {filesInCurrentLevel.length > 0 ? (
                                <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                                    <Text style={{
                                        fontSize: 12,
                                        fontWeight: '700',
                                        color: colors.textMuted,
                                        marginBottom: 12,
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5
                                    }}>
                                        {t('linkFile.filesSection')}
                                    </Text>
                                    <View style={{
                                        flexDirection: 'row',
                                        flexWrap: 'wrap',
                                        gap: 12,
                                        justifyContent: 'flex-start'
                                    }}>
                                        {filesInCurrentLevel.map(item => renderFileGridItem(item))}
                                    </View>
                                </View>
                            ) : null}

                            {foldersInCurrentLevel.length === 0 && filesInCurrentLevel.length === 0 && (
                                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 }}>
                                    <Feather name="folder-minus" size={48} color={colors.textMuted} />
                                    <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '500' }}>
                                        {currentParentId === null ? t('linkFile.noFilesFound') : t('linkFile.folderEmpty')}
                                    </Text>
                                </View>
                            )}
                        </ScrollView>
                    )}

                    {/* Premium bottom Linked Items Workspace tray */}
                    {currentFileId && (() => {
                        const linkedDocs = getLinkedDocs();
                        const linkedPhotos = getLinkedPhotos();
                        const linkedRFIs = getLinkedRFIs();
                        const linkedSnags = getLinkedSnags();
                        const totalLinks = linkedItems.length;

                        return (
                            <View style={{
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                                backgroundColor: colors.surface,
                                paddingTop: 12,
                                paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 16,
                                paddingHorizontal: 16,
                                maxHeight: 220,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: -4 },
                                shadowOpacity: 0.1,
                                shadowRadius: 6,
                                elevation: 8
                            }}>
                                {/* Title and Header */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Feather name="link" size={14} color={colors.primary} />
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                                            {t('linkFile.linkedItems')}
                                        </Text>
                                        {totalLinks > 0 && (
                                            <View style={{
                                                backgroundColor: colors.primary,
                                                borderRadius: 10,
                                                paddingHorizontal: 6,
                                                paddingVertical: 1.5,
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>
                                                    {totalLinks}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {totalLinks === 0 ? (
                                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 20 }}>
                                        <Text style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic' }}>
                                            {t('linkFile.noItemsLinked')}
                                        </Text>
                                    </View>
                                ) : (
                                    <ScrollView 
                                        style={{ maxHeight: 150 }}
                                        showsVerticalScrollIndicator={true}
                                        contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
                                    >
                                        {/* Render Linked Documents */}
                                        {linkedDocs.map(item => (
                                            <View key={`doc-${item.id || item.target_id}`} style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                                borderWidth: 1,
                                                borderColor: 'rgba(255, 255, 255, 0.05)',
                                                borderRadius: 8,
                                                paddingHorizontal: 12,
                                                paddingVertical: 8,
                                            }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                                    <Feather name="file-text" size={13} color="#60a5fa" />
                                                    <Text style={{ fontSize: 12, color: colors.text, flex: 1 }} numberOfLines={1}>
                                                        {item.title || item.file_name || item.name || t('linkFile.unnamedDocument')}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity 
                                                    onPress={() => handleRemoveLink(item)}
                                                    disabled={unlinkingId === (item.id || item.target_id)}
                                                    style={{ padding: 4 }}
                                                >
                                                    {unlinkingId === (item.id || item.target_id) ? (
                                                        <ActivityIndicator size="small" color={colors.primary} style={{ width: 14, height: 14 }} />
                                                    ) : (
                                                        <Feather name="trash-2" size={13} color="#ef4444" />
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        ))}

                                        {/* Render Linked Photos */}
                                        {linkedPhotos.map(item => (
                                            <View key={`photo-${item.id || item.target_id}`} style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                                borderWidth: 1,
                                                borderColor: 'rgba(255, 255, 255, 0.05)',
                                                borderRadius: 8,
                                                paddingHorizontal: 12,
                                                paddingVertical: 8,
                                            }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                                    <Feather name="image" size={13} color="#34d399" />
                                                    <Text style={{ fontSize: 12, color: colors.text, flex: 1 }} numberOfLines={1}>
                                                        {item.title || item.file_name || item.name || t('linkFile.unnamedPhoto')}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity 
                                                    onPress={() => handleRemoveLink(item)}
                                                    disabled={unlinkingId === (item.id || item.target_id)}
                                                    style={{ padding: 4 }}
                                                >
                                                    {unlinkingId === (item.id || item.target_id) ? (
                                                        <ActivityIndicator size="small" color={colors.primary} style={{ width: 14, height: 14 }} />
                                                    ) : (
                                                        <Feather name="trash-2" size={13} color="#ef4444" />
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        ))}

                                        {/* Render Linked RFIs */}
                                        {linkedRFIs.map(item => (
                                            <View key={`rfi-${item.id || item.target_id}`} style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                                borderWidth: 1,
                                                borderColor: 'rgba(255, 255, 255, 0.05)',
                                                borderRadius: 8,
                                                paddingHorizontal: 12,
                                                paddingVertical: 8,
                                            }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                                    <Feather name="help-circle" size={13} color="#fb7185" />
                                                    <Text style={{ fontSize: 12, color: colors.text, flex: 1 }} numberOfLines={1}>
                                                        {item.title || item.name || item.subject || t('linkFile.unnamedRfi')}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity 
                                                    onPress={() => handleRemoveLink(item)}
                                                    disabled={unlinkingId === (item.id || item.target_id)}
                                                    style={{ padding: 4 }}
                                                >
                                                    {unlinkingId === (item.id || item.target_id) ? (
                                                        <ActivityIndicator size="small" color={colors.primary} style={{ width: 14, height: 14 }} />
                                                    ) : (
                                                        <Feather name="trash-2" size={13} color="#ef4444" />
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        ))}

                                        {/* Render Linked Snags */}
                                        {linkedSnags.map(item => (
                                            <View key={`snag-${item.id || item.target_id}`} style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                                borderWidth: 1,
                                                borderColor: 'rgba(255, 255, 255, 0.05)',
                                                borderRadius: 8,
                                                paddingHorizontal: 12,
                                                paddingVertical: 8,
                                            }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                                    <Feather name="alert-triangle" size={13} color="#fb923c" />
                                                    <Text style={{ fontSize: 12, color: colors.text, flex: 1 }} numberOfLines={1}>
                                                        {item.title || item.name || t('linkFile.unnamedSnag')}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity 
                                                    onPress={() => handleRemoveLink(item)}
                                                    disabled={unlinkingId === (item.id || item.target_id)}
                                                    style={{ padding: 4 }}
                                                >
                                                    {unlinkingId === (item.id || item.target_id) ? (
                                                        <ActivityIndicator size="small" color={colors.primary} style={{ width: 14, height: 14 }} />
                                                    ) : (
                                                        <Feather name="trash-2" size={13} color="#ef4444" />
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>
                        );
                    })()}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
