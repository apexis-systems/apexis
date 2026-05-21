import React, { useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, FlatList, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getProjectFiles } from '@/services/fileService';

interface LinkFileModalProps {
    visible: boolean;
    onClose: () => void;
    onLink: (fileId: number) => Promise<void>;
    projectId: string | number;
    currentFileId?: number;
}

export default function LinkFileModal({ visible, onClose, onLink, projectId, currentFileId }: LinkFileModalProps) {
    const { colors } = useTheme();
    const [files, setFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [linkingId, setLinkingId] = useState<number | null>(null);

    useEffect(() => {
        if (visible && projectId) {
            loadFiles();
        } else {
            setSearchQuery('');
        }
    }, [visible, projectId]);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const data = await getProjectFiles(projectId);
            if (data.fileData) {
                setFiles(data.fileData);
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
        } finally {
            setLinkingId(null);
        }
    };

    const filteredFiles = files.filter(f => 
        String(f.id) !== String(currentFileId) && 
        f.file_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, height: '80%' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>Link File</Text>
                            <TouchableOpacity onPress={onClose}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={{ padding: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: colors.border }}>
                                <Feather name="search" size={16} color={colors.textMuted} />
                                <TextInput
                                    style={{ flex: 1, marginLeft: 8, color: colors.text }}
                                    placeholder="Search files..."
                                    placeholderTextColor={colors.textMuted}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>
                        </View>

                        {loading ? (
                            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
                        ) : (
                            <FlatList
                                data={filteredFiles}
                                keyExtractor={(item) => String(item.id)}
                                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
                                ListEmptyComponent={
                                    <View style={{ alignItems: 'center', marginTop: 40 }}>
                                        <Text style={{ color: colors.textMuted }}>No files found</Text>
                                    </View>
                                }
                                renderItem={({ item }) => (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
                                            <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                                <Feather name={item.file_type?.startsWith('image/') ? 'image' : 'file-text'} size={20} color={colors.primary} />
                                            </View>
                                            <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>{item.file_name}</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                                            onPress={() => handleLink(item.id)}
                                            disabled={linkingId === item.id}
                                        >
                                            {linkingId === item.id ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Link</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                )}
                            />
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
