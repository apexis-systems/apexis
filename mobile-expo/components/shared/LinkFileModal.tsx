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
    onRemoveLink?: (fileId: number | string) => Promise<void>;
    projectId: string | number;
    currentFileId?: number;
    linkedFileIds?: number[];
    onlyPhotos?: boolean;
    handleLinkItemClick?: (item: any) => void;
}

export default function LinkFileModal({ visible, onClose, onLink, onRemoveLink, projectId, currentFileId, linkedFileIds, onlyPhotos, handleLinkItemClick }: LinkFileModalProps) {
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
    const [mainTab, setMainTab] = useState<'linked' | 'link'>('linked');
    const [linkedSubTab, setLinkedSubTab] = useState<string>('rfi');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (visible && projectId) {
            loadFiles();
            setSelectedIds(new Set());
            if (onlyPhotos) setActiveTab('photo');
        } else {
            setSearchQuery('');
            setCurrentParentId(null);
            setLinkedItems([]);
            setSelectedIds(new Set());
        }
    }, [visible, projectId, onlyPhotos]);

    useEffect(() => {
        if (visible && !currentFileId && linkedFileIds && files.length > 0) {
            const linked = files.filter((f: any) => linkedFileIds.includes(Number(f.id)));
            setLinkedItems(linked.map((f: any) => ({ ...f, type: 'file' })));
        }
    }, [linkedFileIds, files, visible]);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const data = await getProjectFiles(projectId);
            if (data.fileData) setFiles(data.fileData);
            if (data.folderData) setFolders(data.folderData);
            
            if (currentFileId) {
                const linkData = await getLinkedItems(currentFileId);
                setLinkedItems(linkData.links || []);
            } else if (linkedFileIds) {
                // If we're linking to RFI/Snag, linked items just represent the IDs to show as "already linked" checkboxes
                // but we might not have full item data. For now, we just map IDs to minimal file objects.
                const linked = data.fileData?.filter((f: any) => linkedFileIds.includes(Number(f.id))) || [];
                setLinkedItems(linked.map((f: any) => ({ ...f, type: 'file' })));
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

    const handleConfirmLink = async () => {
        if (selectedIds.size === 0) return;
        setLinkingId(-1); // use -1 as "bulk linking" sentinel
        try {
            await Promise.all(Array.from(selectedIds).map(id => onLink(id)));
            if (currentFileId) {
                const linkData = await getLinkedItems(currentFileId);
                setLinkedItems(linkData.links || []);
            }
            setSelectedIds(new Set());
        } finally {
            setLinkingId(null);
        }
    };

    const handleRemoveLink = async (item: any) => {
        const targetType = item.type || item.target_type;
        const targetId = item.id || item.target_id;
        setUnlinkingId(targetId);
        try {
            if (onRemoveLink) {
                await onRemoveLink(targetId);
            } else if (currentFileId) {
                await deleteLink(currentFileId, targetType, targetId);
                const linkData = await getLinkedItems(currentFileId);
                setLinkedItems(linkData.links || []);
            }
        } catch (error) {
            console.error('Failed to remove link:', error);
        } finally {
            setUnlinkingId(null);
        }
    };

    const handleTabChange = (tab: 'document' | 'photo') => {
        setActiveTab(tab);
        setCurrentParentId(null);
    };

    const getValidFolders = () =>
        folders.filter(f => {
            const n = f.name.toLowerCase();
            return n !== 'archive' && n !== 'confirmation' && n !== 'confirmations';
        });

    const getFoldersInCurrentLevel = () => {
        const valid = getValidFolders();
        return valid.filter(f => {
            if (currentParentId === null) {
                return (f.folder_type === activeTab || !f.folder_type) && String(f.parent_id ?? 'null') === 'null';
            }
            return String(f.parent_id) === String(currentParentId);
        });
    };

    const getFilesInCurrentLevel = () =>
        files.filter(f => {
            if (String(f.id) === String(currentFileId)) return false;
            if (currentParentId === null) {
                if (f.folder_id !== null && f.folder_id !== undefined) {
                    if (folders.some(fold => String(fold.id) === String(f.folder_id))) return false;
                }
                return (f.file_type?.startsWith('image/') ? 'photo' : 'document') === activeTab;
            } else {
                if (String(f.folder_id) !== String(currentParentId)) return false;
                return true;
            }
        });

    const getFilteredSearchFiles = () =>
        files.filter(f => {
            if (String(f.id) === String(currentFileId)) return false;
            if (!f.file_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            const isImg = f.file_type?.startsWith('image/') ||
                f.file_name?.toLowerCase().endsWith('.jpg') ||
                f.file_name?.toLowerCase().endsWith('.png') ||
                f.file_name?.toLowerCase().endsWith('.jpeg');
            return (isImg ? 'photo' : 'document') === activeTab;
        });

    const getBreadcrumbs = () => {
        const tabLabel = activeTab === 'document' ? t('linkFile.documentsTab') : t('linkFile.photosTab');
        if (currentParentId === null) return tabLabel;
        const path: string[] = [];
        let current = folders.find(f => String(f.id) === String(currentParentId));
        while (current) {
            path.unshift(current.name);
            current = folders.find(f => String(f.id) === String(current.parent_id));
        }
        return tabLabel + ' > ' + path.join(' > ');
    };

    const goUp = () => {
        if (currentParentId === null) return;
        const currentFolderObj = folders.find(f => String(f.id) === String(currentParentId));
        setCurrentParentId(currentFolderObj ? (currentFolderObj.parent_id ?? null) : null);
    };

    const renderFileGridItem = (item: any) => {
        const isAlreadyLinked = linkedItems.some(link => link.type === 'file' && String(link.id) === String(item.id));
        const isSelected = selectedIds.has(item.id);
        const isImage = item.file_type?.startsWith('image/') ||
            item.file_name?.toLowerCase().endsWith('.jpg') ||
            item.file_name?.toLowerCase().endsWith('.png') ||
            item.file_name?.toLowerCase().endsWith('.jpeg');

        const toggleSelect = () => {
            if (isAlreadyLinked) return;
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                return next;
            });
        };

        const checkboxColor = isAlreadyLinked ? colors.textMuted : colors.primary;
        const checked = isAlreadyLinked || isSelected;

        const CheckBox = (
            <View style={{
                width: 20, height: 20, borderRadius: 5,
                borderWidth: 2,
                borderColor: checked ? checkboxColor : 'rgba(255,255,255,0.5)',
                backgroundColor: checked ? checkboxColor : 'transparent',
                alignItems: 'center', justifyContent: 'center',
            }}>
                {checked && <Feather name="check" size={12} color="#fff" />}
            </View>
        );

        if (isImage) {
            return (
                <TouchableOpacity key={item.id} onPress={toggleSelect} activeOpacity={0.85}
                    style={{ width: '30.5%', height: 125, backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden', borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? colors.primary : colors.border, marginBottom: 12, position: 'relative' }}>
                    <View style={{ ...StyleSheet.absoluteFillObject }}>
                        {item.downloadUrl
                            ? <Image source={item.downloadUrl} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
                            : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><Feather name="image" size={24} color={colors.textMuted} /></View>}
                    </View>
                    {/* Checkbox top-right */}
                    <View style={{ position: 'absolute', top: 6, right: 6 }}>{CheckBox}</View>
                    {/* Name bottom */}
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, paddingVertical: 5 }}>
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '600', textAlign: 'center' }} numberOfLines={1}>{item.file_name}</Text>
                    </View>
                </TouchableOpacity>
            );
        } else {
            return (
                <TouchableOpacity key={item.id} onPress={toggleSelect} activeOpacity={0.85}
                    style={{ width: '30.5%', height: 125, backgroundColor: colors.surface, borderRadius: 12, borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? colors.primary : colors.border, padding: 8, marginBottom: 12, justifyContent: 'center', alignItems: 'center', gap:12, position: 'relative' }}>
                    {/* Checkbox top-right */}
                    <View style={{ position: 'absolute', top: 6, right: 6 }}>{CheckBox}</View>
                    <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name={item.file_type?.includes('pdf') ? 'file' : 'file-text'} size={20} color={isSelected ? colors.primary : colors.textMuted} />
                    </View>
                    <Text style={{ color: colors.text, fontSize: 10, fontWeight: '600', textAlign: 'center', lineHeight: 12, width: '100%' }} numberOfLines={2}>
                        {item.file_name}
                    </Text>
                </TouchableOpacity>
            );
        }
    };

    const isFilePhoto = (item: any) => {
        const name = (item.title || item.file_name || item.name || '').toLowerCase();
        return item.file_type?.startsWith('image/') ||
            name.endsWith('.jpg') || name.endsWith('.jpeg') ||
            name.endsWith('.png') || name.endsWith('.gif') || name.endsWith('.webp');
    };

    const linkedDocs = linkedItems.filter(i => (i.type === 'file' || i.target_type === 'file') && !isFilePhoto(i));
    const linkedPhotos = linkedItems.filter(i => (i.type === 'file' || i.target_type === 'file') && isFilePhoto(i));
    const linkedRFIs = linkedItems.filter(i => i.type === 'rfi' || i.target_type === 'rfi');
    const linkedSnags = linkedItems.filter(i => i.type === 'snag' || i.target_type === 'snag');

    const linkedSubTabs = [
        ...(linkedRFIs.length > 0 ? [{ key: 'rfi', label: `RFI (${linkedRFIs.length})`, color: '#fb7185', icon: 'help-circle' as const }] : []),
        ...(linkedSnags.length > 0 ? [{ key: 'snag', label: `Snags (${linkedSnags.length})`, color: '#fb923c', icon: 'alert-triangle' as const }] : []),
        ...(linkedPhotos.length > 0 ? [{ key: 'photo', label: `Photos (${linkedPhotos.length})`, color: '#34d399', icon: 'image' as const }] : []),
        ...(linkedDocs.length > 0 ? [{ key: 'doc', label: `Docs (${linkedDocs.length})`, color: '#60a5fa', icon: 'file-text' as const }] : []),
    ];

    const activeLinkedSubTab = linkedSubTabs.find(s => s.key === linkedSubTab)
        ? linkedSubTab
        : (linkedSubTabs[0]?.key || 'rfi');

    const renderLinkedGrid = (items: any[]) => (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 }}>
            {items.map(item => {
                const key = item.id || item.target_id;
                const name = item.title || item.file_name || item.name || item.subject || '—';
                const isRFI = item.type === 'rfi' || item.target_type === 'rfi';
                const isSnag = item.type === 'snag' || item.target_type === 'snag';
                const isPhoto = !isRFI && !isSnag && isFilePhoto(item);
                const accent = isRFI ? '#fb7185' : isSnag ? '#fb923c' : isPhoto ? '#34d399' : '#60a5fa';
                const bg = isRFI ? 'rgba(251,113,133,0.08)' : isSnag ? 'rgba(251,146,60,0.08)' : isPhoto ? 'rgba(52,211,153,0.08)' : 'rgba(96,165,250,0.08)';
                const iconName: any = isRFI ? 'help-circle' : isSnag ? 'alert-triangle' : isPhoto ? 'image' : 'file-text';
                return (
                    <View key={key} style={{ width: '47%' }}>
                        <TouchableOpacity
                            onPress={() => handleLinkItemClick?.(item)}
                            activeOpacity={0.8}
                            style={{ backgroundColor: bg, borderWidth: 1, borderColor: accent + '44', borderRadius: 10, padding: 10, minHeight: 78, justifyContent: 'space-between' }}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Feather name={iconName} size={20} color={accent} />
                                <TouchableOpacity onPress={() => handleRemoveLink(item)} disabled={unlinkingId === key} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                    {unlinkingId === key
                                        ? <ActivityIndicator size="small" color="#ef4444" style={{ width: 14, height: 14 }} />
                                        : <Feather name="trash-2" size={13} color="#ef4444" />}
                                </TouchableOpacity>
                            </View>
                            <Text style={{ fontSize: 11, color: colors.text, marginTop: 8 }} numberOfLines={2}>{name}</Text>
                        </TouchableOpacity>
                    </View>
                );
            })}
        </View>
    );

    const foldersInCurrentLevel = getFoldersInCurrentLevel();
    const filesInCurrentLevel = getFilesInCurrentLevel();

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false} statusBarTranslucent={true}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
                <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>

                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
                        <TouchableOpacity onPress={onClose} style={{ marginRight: 16 }}>
                            <Feather name="arrow-left" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, flex: 1 }}>{t('linkFile.title')}</Text>
                    </View>

                    {/* Main Tabs */}
                    <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        {(['linked', 'link'] as const).map(tab => (
                            <TouchableOpacity key={tab} onPress={() => setMainTab(tab)}
                                style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: mainTab === tab ? colors.primary : 'transparent' }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: mainTab === tab ? colors.primary : colors.textMuted }}>
                                    {tab === 'linked'
                                        ? `${t('linkFile.linkedItems')}${linkedItems.length > 0 ? ` (${linkedItems.length})` : ''}`
                                        : 'Link a File'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* ── LINKED ITEMS TAB ── */}
                    {mainTab === 'linked' && (
                        <View style={{ flex: 1 }}>
                            {loading ? (
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color={colors.primary} />
                                </View>
                            ) : linkedItems.length === 0 ? (
                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                    <Feather name="link" size={40} color={colors.textMuted} />
                                    <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('linkFile.noItemsLinked')}</Text>
                                </View>
                            ) : (
                                <View style={{ flex: 1 }}>
                                    {/* Sub-tabs — only non-empty ones */}
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                                        style={{ maxHeight: 46, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}
                                        contentContainerStyle={{ paddingHorizontal: 12 }}>
                                        {linkedSubTabs.map(st => (
                                            <TouchableOpacity key={st.key} onPress={() => setLinkedSubTab(st.key)}
                                                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: activeLinkedSubTab === st.key ? st.color : 'transparent' }}>
                                                <Feather name={st.icon} size={13} color={activeLinkedSubTab === st.key ? st.color : colors.textMuted} />
                                                <Text style={{ fontSize: 13, fontWeight: '600', color: activeLinkedSubTab === st.key ? st.color : colors.textMuted }}>{st.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    {/* Grid content */}
                                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
                                        {activeLinkedSubTab === 'rfi' && renderLinkedGrid(linkedRFIs)}
                                        {activeLinkedSubTab === 'snag' && renderLinkedGrid(linkedSnags)}
                                        {activeLinkedSubTab === 'photo' && renderLinkedGrid(linkedPhotos)}
                                        {activeLinkedSubTab === 'doc' && renderLinkedGrid(linkedDocs)}
                                    </ScrollView>
                                </View>
                            )}
                        </View>
                    )}

                    {/* ── LINK A FILE TAB ── */}
                    {mainTab === 'link' && (
                        <View style={{ flex: 1 }}>
                            {/* Search Bar */}
                            <View style={{ padding: 12, backgroundColor: colors.background }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: colors.border }}>
                                    <Feather name="search" size={16} color={colors.textMuted} />
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

                            {/* Document / Photo sub-tabs */}
                            {!searchQuery && !onlyPhotos && (
                                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
                                    {(['document', 'photo'] as const).map(tab => (
                                        <TouchableOpacity key={tab} onPress={() => handleTabChange(tab)}
                                            style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: activeTab === tab ? colors.primary : 'transparent' }}>
                                            <Text style={{ fontSize: 14, fontWeight: '600', color: activeTab === tab ? colors.primary : colors.textMuted }}>
                                                {tab === 'document' ? t('linkFile.documentsTab') : t('linkFile.photosTab')}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* Breadcrumbs */}
                            {!searchQuery && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                                    <Feather name="folder" size={13} color={colors.textMuted} style={{ marginRight: 6 }} />
                                    <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textMuted, flex: 1 }}>{getBreadcrumbs()}</Text>
                                </View>
                            )}

                            {/* File content */}
                            {loading ? (
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color={colors.primary} />
                                </View>
                            ) : searchQuery ? (
                                <FlatList
                                    data={getFilteredSearchFiles()}
                                    keyExtractor={item => String(item.id)}
                                    numColumns={3}
                                    columnWrapperStyle={{ gap: 12 }}
                                    renderItem={({ item }) => renderFileGridItem(item)}
                                    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                                    ListEmptyComponent={
                                        <View style={{ alignItems: 'center', marginTop: 40, gap: 10 }}>
                                            <Feather name="search" size={36} color={colors.textMuted} />
                                            <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('linkFile.noFilesMatching', { query: searchQuery })}</Text>
                                        </View>
                                    }
                                />
                            ) : (
                                <ScrollView contentContainerStyle={{ paddingBottom: 40 }} style={{ flex: 1 }}>
                                    {(currentParentId !== null || foldersInCurrentLevel.length > 0) && (
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 }}>
                                            {currentParentId !== null && (
                                                <TouchableOpacity onPress={goUp}
                                                    style={{ width: '30%', height: 90, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: colors.surface }}>
                                                    <Feather name="corner-left-up" size={24} color={colors.primary} />
                                                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text, marginTop: 8 }}>Go Up</Text>
                                                </TouchableOpacity>
                                            )}
                                            {foldersInCurrentLevel.map(folder => {
                                                const childFolders = folders.filter(f => String(f.parent_id) === String(folder.id));
                                                const childFiles = files.filter(p => String(p.folder_id) === String(folder.id));
                                                const count = childFiles.length;
                                                const subcount = childFolders.length;
                                                return (
                                                    <TouchableOpacity key={folder.id} onPress={() => setCurrentParentId(folder.id)}
                                                        style={{ width: '30%', height: 90, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                                                        <Feather name="folder" size={24} color={colors.primary} />
                                                        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: colors.text, marginTop: 8, textAlign: 'center' }}>{folder.name}</Text>
                                                        <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 2, textAlign: 'center' }}>
                                                            {subcount > 0
                                                                ? t('projectDocuments.filesFoldersCount', { fileCount: count, folderCount: subcount })
                                                                : t('projectDocuments.filesOnlyCount', { count: count })}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    )}
                                    {filesInCurrentLevel.length > 0 && (
                                        <View style={{ paddingHorizontal: 16 }}>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                                                {filesInCurrentLevel.map(item => renderFileGridItem(item))}
                                            </View>
                                        </View>
                                    )}
                                    {foldersInCurrentLevel.length === 0 && filesInCurrentLevel.length === 0 && (
                                        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 }}>
                                            <Feather name="folder-minus" size={48} color={colors.textMuted} />
                                            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                                                {currentParentId === null ? t('linkFile.noFilesFound') : t('linkFile.folderEmpty')}
                                            </Text>
                                        </View>
                                    )}
                                </ScrollView>
                            )}
                        </View>
                    )}

                    {/* ── Sticky Bottom Bar: shown when files are selected ── */}
                    {selectedIds.size > 0 && (
                        <View style={{
                            flexDirection: 'row',
                            gap: 12,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            paddingBottom: insets.bottom + 12,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                            backgroundColor: colors.surface,
                        }}>
                            <TouchableOpacity
                                onPress={() => setSelectedIds(new Set())}
                                style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMuted }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleConfirmLink}
                                disabled={linkingId === -1}
                                style={{ flex: 2, height: 46, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                            >
                                {linkingId === -1 ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                                        Link {selectedIds.size} file{selectedIds.size > 1 ? 's' : ''}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
