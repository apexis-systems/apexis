import React from 'react';
import { View, TouchableOpacity, Modal, StyleSheet, Dimensions, TouchableWithoutFeedback, Platform, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface FileActionMenuProps {
    isVisible: boolean;
    onClose: () => void;
    onHideUnhide: () => void;
    onDoNotFollow: () => void;
    onOnlyForReference?: () => void;
    onDelete: () => void;
    onShare?: () => void;
    onRename?: () => void;
    onArchive?: () => void;
    onUnarchive?: () => void;
    onCreateRfi?: () => void;
    onCreateSnag?: () => void;
    onUploadNewVersion?: () => void;
    clientVisible: boolean;
    doNotFollow: boolean;
    onlyForReference?: boolean;
    canDelete: boolean;
    canRename: boolean;
    showArchive?: boolean;
    isArchived?: boolean;
    isAdmin: boolean;
    isContributor?: boolean;
    isUploader?: boolean;
    fileName: string;
    showDoNotFollow?: boolean;
    processingAction?: string | null;
    useView?: boolean;
}

export default function FileActionMenu({
    isVisible,
    onClose,
    onHideUnhide,
    onDoNotFollow,
    onOnlyForReference,
    onDelete,
    onShare,
    onRename,
    onArchive,
    onUnarchive,
    onCreateRfi,
    onCreateSnag,
    onUploadNewVersion,
    clientVisible,
    doNotFollow,
    onlyForReference,
    canDelete,
    canRename,
    showArchive = false,
    isArchived = false,
    isAdmin,
    isContributor = false,
    isUploader = false,
    fileName,
    showDoNotFollow = true,
    processingAction = null,
    useView = false
}: FileActionMenuProps) {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const isProcessing = processingAction !== null;

    if (!isVisible) return null;

    const menuContent = (
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
                            {onUploadNewVersion && (
                                <TouchableOpacity 
                                    style={[styles.option, isProcessing && { opacity: 0.5 }]} 
                                    onPress={() => { !isProcessing && onUploadNewVersion(); !isProcessing && onClose(); }}
                                    disabled={isProcessing}
                                >
                                    <Feather name="plus-circle" size={18} color={colors.primary} />
                                    <Text style={[styles.optionText, { color: colors.text }]}>{t('fileActionMenu.uploadNewVersion') || 'Upload New Version'}</Text>
                                </TouchableOpacity>
                            )}

                            {onCreateRfi && (
                                <TouchableOpacity 
                                    style={[styles.option, isProcessing && { opacity: 0.5 }]} 
                                    onPress={() => { !isProcessing && onCreateRfi(); !isProcessing && onClose(); }}
                                    disabled={isProcessing}
                                >
                                    <Feather name="help-circle" size={18} color={colors.primary} />
                                    <Text style={[styles.optionText, { color: colors.text }]}>{t('fileActionMenu.createRfi')}</Text>
                                </TouchableOpacity>
                            )}

                            {onCreateSnag && (
                                <TouchableOpacity 
                                    style={[styles.option, isProcessing && { opacity: 0.5 }]} 
                                    onPress={() => { !isProcessing && onCreateSnag(); !isProcessing && onClose(); }}
                                    disabled={isProcessing}
                                >
                                    <Feather name="alert-triangle" size={18} color={colors.primary} />
                                    <Text style={[styles.optionText, { color: colors.text }]}>{t('fileActionMenu.createSnag')}</Text>
                                </TouchableOpacity>
                            )}

                            {onShare && (
                                <TouchableOpacity 
                                    style={[styles.option, isProcessing && { opacity: 0.5 }]} 
                                    onPress={() => { !isProcessing && onShare(); !isProcessing && onClose(); }}
                                    disabled={isProcessing}
                                >
                                    <Feather name="share-2" size={18} color={colors.primary} />
                                    <Text style={[styles.optionText, { color: colors.text }]}>{t('fileActionMenu.share')}</Text>
                                </TouchableOpacity>
                            )}

                            {canRename && onRename && (
                                <TouchableOpacity 
                                    style={[styles.option, isProcessing && { opacity: 0.5 }]} 
                                    onPress={() => { !isProcessing && onRename(); !isProcessing && onClose(); }}
                                    disabled={isProcessing}
                                >
                                    <Feather name="edit-2" size={18} color={colors.primary} />
                                    <Text style={[styles.optionText, { color: colors.text }]}>{t('fileActionMenu.rename')}</Text>
                                </TouchableOpacity>
                            )}

                            {isAdmin && ( // Only admin can manage visibility
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
                                        {clientVisible ? t('fileActionMenu.hideContent') : t('fileActionMenu.showContent')}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {(!isArchived && showDoNotFollow && (isAdmin || !isContributor || isUploader)) && ( // Admin and Contributor (only if uploaded) can toggle DNF
                                <TouchableOpacity 
                                    style={[styles.option, isProcessing && { opacity: 0.5 }]} 
                                    onPress={() => { !isProcessing && onDoNotFollow(); }}
                                    disabled={isProcessing}
                                >
                                    {processingAction === 'dnf' ? (
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    ) : (
                                        <Feather 
                                            name={doNotFollow ? "shield-off" : "shield"} 
                                            size={18} 
                                            color={doNotFollow ? colors.primary : "#ef4444"} 
                                        />
                                    )}
                                    <Text style={[styles.optionText, { color: colors.text }]}>
                                        {doNotFollow ? t('fileActionMenu.followFile') : t('fileActionMenu.dontFollow')}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {(!isArchived && showDoNotFollow && onOnlyForReference && (isAdmin || !isContributor || isUploader)) && (
                                <TouchableOpacity 
                                    style={[styles.option, isProcessing && { opacity: 0.5 }]} 
                                    onPress={() => { !isProcessing && onOnlyForReference(); }}
                                    disabled={isProcessing}
                                >
                                    {processingAction === 'ofr' ? (
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    ) : (
                                        <Feather 
                                            name="info" 
                                            size={18} 
                                            color={onlyForReference ? colors.primary : colors.textMuted} 
                                        />
                                    )}
                                    <Text style={[styles.optionText, { color: colors.text }]}>
                                        {onlyForReference ? t('fileActionMenu.unmarkOfr') : t('fileActionMenu.markOfr')}
                                    </Text>
                                </TouchableOpacity>
                            )}

                             

                            {showArchive && !isArchived && onArchive && (
                                <TouchableOpacity 
                                    style={[styles.option, isProcessing && { opacity: 0.5 }]} 
                                    onPress={() => { !isProcessing && onArchive(); }}
                                    disabled={isProcessing}
                                >
                                    {processingAction === 'archive' ? (
                                        <ActivityIndicator size="small" color="#f59e0b" />
                                    ) : (
                                        <Feather name="archive" size={18} color="#f59e0b" />
                                    )}
                                    <Text style={[styles.optionText, { color: colors.text }]}>{t('fileActionMenu.archiveFile')}</Text>
                                </TouchableOpacity>
                            )}

                            {isArchived && onUnarchive && (
                                <TouchableOpacity 
                                    style={[styles.option, isProcessing && { opacity: 0.5 }]} 
                                    onPress={() => { !isProcessing && onUnarchive(); }}
                                    disabled={isProcessing}
                                >
                                    {processingAction === 'unarchive' ? (
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    ) : (
                                        <Feather name="upload" size={18} color={colors.primary} />
                                    )}
                                    <Text style={[styles.optionText, { color: colors.text }]}>{t('fileActionMenu.unarchiveFile')}</Text>
                                </TouchableOpacity>
                            )}

                            {canDelete && (
                                <TouchableOpacity 
                                    style={[styles.option, styles.deleteOption, isProcessing && { opacity: 0.5 }]} 
                                    onPress={() => { !isProcessing && onDelete(); }}
                                    disabled={isProcessing}
                                >
                                    {processingAction === 'delete' ? (
                                        <ActivityIndicator size="small" color="#ef4444" />
                                    ) : (
                                        <Feather name="trash-2" size={18} color="#ef4444" />
                                    )}
                                    <Text style={[styles.optionText, { color: "#ef4444" }]}>{t('fileActionMenu.deleteFile')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity 
                            style={[styles.cancelButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8f9fa' }]} 
                            onPress={onClose}
                            disabled={isProcessing}
                        >
                            <Text style={[styles.cancelText, { color: colors.textMuted }]}>{t('fileActionMenu.cancel')}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableWithoutFeedback>
            </View>
        </TouchableWithoutFeedback>
    );

    if (useView) {
        return (
            <View style={[StyleSheet.absoluteFill, { zIndex: 10000 }]}>
                {menuContent}
            </View>
        );
    }

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            {menuContent}
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
