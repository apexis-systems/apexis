import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function ScanScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();

    if (!user) return null;

    const handleScan = () => {
        Alert.alert('QR Scanner', 'QR scanner will open camera (demo)');
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14 }}>
                {/* Header */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Scan QR Code</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>Quick access to project files</Text>
                </View>

                {/* Scanner Area */}
                <View style={{ alignItems: 'center' }}>
                    <View
                        style={{
                            width: 260,
                            height: 260,
                            borderRadius: 20,
                            borderWidth: 2,
                            borderColor: colors.border,
                            borderStyle: 'dashed',
                            backgroundColor: colors.surface,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Feather name="maximize" size={64} color={colors.border} />
                        <Text
                            style={{
                                fontSize: 12,
                                color: colors.textMuted,
                                textAlign: 'center',
                                paddingHorizontal: 32,
                                marginTop: 12,
                            }}
                        >
                            Point your camera at a project QR code
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={handleScan}
                        style={{
                            marginTop: 24,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: 10,
                            backgroundColor: '#f97316',
                            paddingHorizontal: 20,
                            paddingVertical: 10,
                        }}
                    >
                        <Feather name="camera" size={14} color="#fff" />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Open Camera</Text>
                    </TouchableOpacity>

                    <Text
                        style={{
                            marginTop: 20,
                            fontSize: 10,
                            color: colors.textMuted,
                            textAlign: 'center',
                            maxWidth: 220,
                        }}
                    >
                        Each project has a unique QR code that links directly to its documents and photos.
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
}
