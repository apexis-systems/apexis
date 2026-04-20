import React from 'react';
import { View, TouchableOpacity, Modal, StyleSheet, Dimensions, TouchableWithoutFeedback, Platform, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface FileActionMenuProps {
    isVisible: boolean;
    onClose: () => void;
    onHideUnhide: () => void;
    onDoNotFollow: () => void;
    onDelete: () => void;
    onShare?: () => void;
    clientVisible: boolean;
    doNotFollow: boolean;
    canDelete: boolean;
    isAdmin: boolean;
    fileName: string;
    showDoNotFollow?: boolean;
    isProcessing?: boolean;
}

export default function FileActionMenu({
    isVisible,
    onClose,
    onHideUnhide,
    onDoNotFollow,
    onDelete,
    onShare,
    clientVisible,
    doNotFollow,
    canDelete,
    isAdmin,
    fileName,
    showDoNotFollow = true,
    isProcessing = false
}: FileActionMenuProps) {
    const { colors, isDark } = useTheme();

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
                                <Text numberOfLines={1} style={[styles.fileName, { color: colors.textMuted }]}>
                                    {fileName}
                                </Text>
                            </View>

                            <View style={styles.optionsContainer}>
                                {onShare && (
                                    <TouchableOpacity 
                                        style={[styles.option, isProcessing && { opacity: 0.5 }]} 
                                        onPress={() => { !isProcessing && onShare(); !isProcessing && onClose(); }}
                                        disabled={isProcessing}
                                    >
                                        <Feather name="share-2" size={18} color={colors.primary} />
                                        <Text style={[styles.optionText, { color: colors.text }]}>Share</Text>
                                    </TouchableOpacity>
                                )}

                                {(isAdmin || !isAdmin) && ( // Both Admin and potentially others can manage visibility
                                    <TouchableOpacity 
                                        style={[styles.option, isProcessing && { opacity: 0.5 }]} 
                                        onPress={() => { !isProcessing && onHideUnhide(); }}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        ) : (
                                            <Feather 
                                                name={clientVisible ? "eye-off" : "eye"} 
                                                size={18} 
                                                color={clientVisible ? colors.textMuted : colors.primary} 
                                            />
                                        )}
                                        <Text style={[styles.optionText, { color: colors.text }]}>
                                            {clientVisible ? "Hide Content" : "Show Content"}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {(showDoNotFollow && (isAdmin || !isAdmin)) && ( // Admin and Contributor can toggle DNF
                                    <TouchableOpacity 
                                        style={[styles.option, isProcessing && { opacity: 0.5 }]} 
                                        onPress={() => { !isProcessing && onDoNotFollow(); }}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        ) : (
                                            <Feather 
                                                name={doNotFollow ? "shield-off" : "shield"} 
                                                size={18} 
                                                color={doNotFollow ? colors.primary : "#ef4444"} 
                                            />
                                        )}
                                        <Text style={[styles.optionText, { color: colors.text }]}>
                                            {doNotFollow ? "Follow File" : "Don't Follow"}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {canDelete && (
                                    <TouchableOpacity 
                                        style={[styles.option, styles.deleteOption, isProcessing && { opacity: 0.5 }]} 
                                        onPress={() => { !isProcessing && onDelete(); }}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? (
                                            <ActivityIndicator size="small" color="#ef4444" />
                                        ) : (
                                            <Feather name="trash-2" size={18} color="#ef4444" />
                                        )}
                                        <Text style={[styles.optionText, { color: "#ef4444" }]}>Delete File</Text>
                                    </TouchableOpacity>
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
    fileName: {
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
