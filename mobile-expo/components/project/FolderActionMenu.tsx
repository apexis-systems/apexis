import React from 'react';
import { View, TouchableOpacity, Modal, StyleSheet, Dimensions, TouchableWithoutFeedback, Platform, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface FolderActionMenuProps {
    isVisible: boolean;
    onClose: () => void;
    onHideUnhide: () => void;
    onRename: () => void;
    onDelete: () => void;
    clientVisible: boolean;
    isAdmin: boolean;
    folderName: string;
    processingAction?: string | null;
}

export default function FolderActionMenu({
    isVisible,
    onClose,
    onHideUnhide,
    onRename,
    onDelete,
    clientVisible,
    isAdmin,
    folderName,
    processingAction = null
}: FolderActionMenuProps) {
    const { colors, isDark } = useTheme();
    const isProcessing = processingAction !== null;

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={[styles.menuContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                                <Text numberOfLines={1} style={[styles.folderName, { color: colors.textMuted }]}>
                                    Folder: {folderName}
                                </Text>
                            </View>

                            <View style={styles.optionsContainer}>
                                {(isAdmin || !isAdmin) && (
                                    <TouchableOpacity 
                                        style={[styles.option, isProcessing && { opacity: 0.5 }]} 
                                        onPress={() => { !isProcessing && onHideUnhide(); }}
                                        disabled={isProcessing}
                                    >
                                        {processingAction === 'visibility' ? (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        ) : (
                                            <Feather 
                                                name={clientVisible ? "eye-off" : "eye"} 
                                                size={18} 
                                                color={clientVisible ? colors.textMuted : colors.primary} 
                                            />
                                        )}
                                        <Text style={[styles.optionText, { color: colors.text }]}>
                                            {clientVisible ? "Hide Folder" : "Show Folder"}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {isAdmin && (
                                    <>
                                        <TouchableOpacity 
                                            style={[styles.option, isProcessing && { opacity: 0.5 }]} 
                                            onPress={() => { !isProcessing && onRename(); onClose(); }}
                                            disabled={isProcessing}
                                        >
                                            <Feather name="edit-2" size={18} color={colors.primary} />
                                            <Text style={[styles.optionText, { color: colors.text }]}>Rename Folder</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            style={[styles.option, styles.deleteOption, isProcessing && { opacity: 0.5 }]} 
                                            onPress={() => { !isProcessing && onDelete(); onClose(); }}
                                            disabled={isProcessing}
                                        >
                                            <Feather name="trash-2" size={18} color="#ef4444" />
                                            <Text style={[styles.optionText, { color: "#ef4444" }]}>Delete Folder</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>

                            <TouchableOpacity 
                                style={[styles.cancelButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8f9fa' }]} 
                                onPress={onClose}
                                disabled={isProcessing}
                            >
                                <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    menuContainer: {
        width: SCREEN_W * 0.85,
        maxWidth: 320,
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.2,
                shadowRadius: 20,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    header: {
        padding: 16,
        alignItems: 'center',
        borderBottomWidth: 1,
    },
    folderName: {
        fontSize: 12,
        fontWeight: '600',
    },
    optionsContainer: {
        padding: 8,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 14,
        borderRadius: 12,
    },
    optionText: {
        fontSize: 15,
        fontWeight: '500',
    },
    deleteOption: {
        // backgroundColor: 'rgba(239, 68, 68, 0.05)',
    },
    cancelButton: {
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 4,
    },
    cancelText: {
        fontSize: 14,
        fontWeight: '700',
    }
});
