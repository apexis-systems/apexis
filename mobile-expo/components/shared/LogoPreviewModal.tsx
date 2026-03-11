import React from 'react';
import { Modal, View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Feather } from '@expo/vector-icons';

interface Props {
    visible: boolean;
    onClose: () => void;
    logoSource: any;
    canChange: boolean;
    onChangePress: () => void;
}

export default function LogoPreviewModal({ visible, onClose, logoSource, canChange, onChangePress }: Props) {
    const { colors } = useTheme();

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            statusBarTranslucent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Feather name="x" size={24} color={colors.textMuted} />
                    </TouchableOpacity>

                    <View style={styles.content}>
                        <View style={[styles.imageWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                            {logoSource ? (
                                <Image source={logoSource} style={styles.image} resizeMode="cover" />
                            ) : (
                                <Text style={{ color: colors.textMuted, fontStyle: 'italic' }}>No Logo</Text>
                            )}
                        </View>

                        <Text style={[styles.title, { color: colors.text }]}>Organization Logo</Text>
                        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                            This logo represents your organization across the platform.
                        </Text>

                        {canChange && (
                            <TouchableOpacity
                                style={[styles.changeButton, { backgroundColor: '#f97316' }]} // Using specific orange as per app theme
                                onPress={onChangePress}
                            >
                                <Feather name="camera" size={18} color="#fff" />
                                <Text style={styles.changeButtonText}>Change Logo</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    container: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        padding: 4,
        zIndex: 1,
    },
    content: {
        alignItems: 'center',
        paddingTop: 16,
    },
    imageWrapper: {
        width: 180,
        height: 180,
        borderRadius: 24,
        borderWidth: 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    changeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        height: 50,
        borderRadius: 14,
    },
    changeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
