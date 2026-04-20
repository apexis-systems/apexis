import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { Text } from '../ui/AppText';
import { useTheme } from '../../contexts/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { updateDiagnosticPermission } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
    visible: boolean;
    onClose: () => void;
}

export default function DiagnosticPermissionModal({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const { updateUser } = useAuth();
    const [loading, setLoading] = React.useState(false);

    const handleChoice = async (allow: boolean) => {
        setLoading(true);
        try {
            await updateDiagnosticPermission(allow);
            updateUser({ diagnostic_data_permission: allow });
            onClose();
        } catch (error) {
            console.error("Failed to update diagnostic permission:", error);
            // Close anyway so the user isn't stuck, the next app load will trigger it again if still null
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const openPrivacyPolicy = () => {
        Linking.openURL('https://www.apexis.in/privacy'); // Placeholder
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: colors.surface }]}>
                    <View style={styles.header}>
                        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                            <Feather name="activity" size={24} color={colors.primary} />
                        </View>
                        <Text style={[styles.title, { color: colors.text }]}>
                            Help Improve{' '}
                            <Text style={{ color: colors.primary, fontFamily: 'Angelica', fontSize: 18 }}>
                                APEXIS
                                <Text style={{ fontSize: 9, marginTop: -4 }}>
                                    PRO™
                                </Text>
                            </Text>
                        </Text>


                    </View>

                    <Text style={[styles.description, { color: colors.text }]}>
                        To improve stability, performance, and usability,{' '}

                        <Text style={{ color: colors.primary, fontFamily: 'Angelica', fontSize: 14 }}>
                            APEXIS
                            <Text
                                style={{
                                    fontSize: 7,
                                    lineHeight: 14,
                                    fontFamily: 'Angelica',        // 👈 important for alignment
                                    textAlignVertical: 'top',
                                }}
                            >
                                PRO™
                            </Text>
                        </Text>

                        {' '}may collect limited diagnostic data such as error logs and usage insights.
                        This information is used only for product improvement and is handled securely.
                    </Text>

                    <View style={styles.detailsContainer}>
                        {[
                            { text: 'Crash logs and performance metrics data would be collected', icon: 'zap' },
                            { text: 'To improve reliability and future features', icon: 'trending-up' },
                            { text: 'No personal files, drawings, or documents would be collected', icon: 'eye-off' },
                        ].map((item, i) => (
                            <View key={i} style={styles.detailRow}>
                                <Feather name={item.icon as any} size={14} color={colors.primary} style={styles.detailIcon} />
                                <Text style={[styles.detailText, { color: colors.textMuted }]}>{item.text}</Text>
                            </View>
                        ))}

                        <TouchableOpacity onPress={openPrivacyPolicy} style={styles.privacyLink}>
                            <Feather name="external-link" size={14} color={colors.primary} />
                            <Text style={[styles.privacyText, { color: colors.primary }]}>Review our Privacy Policy</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.footerTextContainer, { backgroundColor: colors.background }]}>
                        <Text style={[styles.footerText, { color: colors.textMuted }]}>
                            No project drawings, personal messages, or sensitive data are accessed.
                        </Text>
                    </View>

                    <View style={styles.buttons}>
                        <TouchableOpacity
                            onPress={() => handleChoice(false)}
                            style={[styles.button, styles.denyButton, { borderColor: colors.border }]}
                            disabled={loading}
                        >
                            <Text style={[styles.buttonText, { color: colors.textMuted }]}>Deny</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleChoice(true)}
                            style={[styles.button, { backgroundColor: colors.primary }]}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={[styles.buttonText, { color: '#fff' }]}>Allow</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    container: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 20,
    },
    detailsContainer: {
        marginBottom: 24,
        gap: 14,
    },
    detailRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
    },
    detailIcon: {
        marginTop: 2,
    },
    detailText: {
        fontSize: 13,
        flex: 1,
        lineHeight: 18,
    },
    privacyLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    privacyText: {
        fontSize: 13,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    footerTextContainer: {
        padding: 14,
        borderRadius: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    footerText: {
        fontSize: 11,
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 16,
    },
    buttons: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    denyButton: {
        borderWidth: 1,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
    },
});
