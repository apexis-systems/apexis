import React from 'react';
import { Modal, View, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { useTheme } from '@/contexts/ThemeContext';
import { Feather } from '@expo/vector-icons';

interface Props {
    visible: boolean;
    onClose: () => void;
    logoSource: any;
    canChange: boolean;
    onChangePress: () => void;
    isCircular?: boolean;
    uploading?: boolean;
    title?: string;
    subtitle?: string;
    buttonText?: string;
}

export default function LogoPreviewModal({
    visible,
    onClose,
    logoSource,
    canChange,
    onChangePress,
    isCircular = false,
    uploading = false,
    title = "Organization Logo",
    subtitle = "This logo represents your organization across the platform.",
    buttonText = "Change Logo"
}: Props) {
    const { colors } = useTheme();

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            statusBarTranslucent={true}
            onRequestClose={onClose}
        >
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.9)',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 24,
            }}>
                <View style={{
                    width: '100%',
                    maxWidth: 340,
                    borderRadius: 24,
                    padding: 24,
                    borderWidth: 1,
                    backgroundColor: colors.surface,
                    borderColor: colors.border
                }}>
                    <TouchableOpacity
                        style={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            padding: 4,
                            zIndex: 1,
                        }}
                        onPress={onClose}
                        disabled={uploading}
                    >
                        <Feather name="x" size={24} color={uploading ? colors.border : colors.textMuted} />
                    </TouchableOpacity>

                    <View style={{ alignItems: 'center', paddingTop: 16 }}>
                        <View style={{
                            width: 180,
                            height: 180,
                            borderRadius: isCircular ? 90 : 20,
                            borderWidth: 2,
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 20,
                            backgroundColor: colors.background,
                            borderColor: colors.border
                        }}>
                            {logoSource ? (
                                <Image source={logoSource} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            ) : (
                                <Feather name={isCircular ? "user" : "image"} size={48} color={colors.textMuted} />
                            )}

                            {uploading && (
                                <View style={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundColor: 'rgba(255,255,255,0.8)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 10
                                }}>
                                    <ActivityIndicator size="large" color={colors.primary} />
                                    <Text style={{ marginTop: 10, fontSize: 13, fontWeight: '700', color: colors.primary }}>Uploading...</Text>
                                </View>
                            )}
                        </View>

                        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8, color: colors.text }}>{title}</Text>
                        <Text style={{ fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24, color: colors.textMuted }}>
                            {subtitle}
                        </Text>

                        {canChange && (
                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    width: '100%',
                                    height: 50,
                                    borderRadius: 14,
                                    backgroundColor: colors.primary,
                                    opacity: uploading ? 0.7 : 1
                                }}
                                onPress={onChangePress}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Feather name="camera" size={18} color="#fff" />
                                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{buttonText}</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}
