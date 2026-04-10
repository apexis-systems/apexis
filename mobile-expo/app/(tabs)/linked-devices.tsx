import { useState, useCallback, useRef } from 'react';
import { View, TouchableOpacity, Alert, Platform, ActivityIndicator, BackHandler } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authorizeWebSession, getActiveWebSessions } from '@/services/authService';
import { useTheme } from '@/contexts/ThemeContext';

export default function LinkedDevices() {
    const { colors } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [authorizing, setAuthorizing] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const [activeSessions, setActiveSessions] = useState<{ sessionId: string, device: string }[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const isHandlingScan = useRef(false);

    useFocusEffect(
        useCallback(() => {
            if (!permission?.granted) {
                requestPermission();
            }
            fetchSessions();

            const onBackPress = () => {
                router.push('/settings');
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [permission])
    );

    const fetchSessions = async () => {
        setSessionsLoading(true);
        try {
            const data = await getActiveWebSessions();
            if (data?.sessions) {
                setActiveSessions(data.sessions);
            }
        } catch (error) {
            console.error("Failed to fetch sessions", error);
        } finally {
            setSessionsLoading(false);
        }
    };

    const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
        if (scanned || authorizing || isHandlingScan.current) return;
        isHandlingScan.current = true;
        setScanned(true);

        // A basic UUID check (length 36, contains hyphens)
        if (!data || data.length < 32 || !data.includes('-')) {
            Alert.alert(
                "Invalid QR Code",
                "This doesn't look like an APEXIS login code.",
                [{ text: "OK", onPress: () => { isHandlingScan.current = false; setScanned(false); } }]
            );
            return;
        }

        setAuthorizing(true);
        try {
            await authorizeWebSession(data);
            Alert.alert(
                "Success",
                "Web session authorized! Your browser will now log in.",
                [{ text: "OK", onPress: () => { isHandlingScan.current = false; setScanned(false); } }]
            );
            fetchSessions(); // Refresh list immediately
            setIsScannerOpen(false); // Close scanner on success
        } catch (error: any) {
            console.error("QR Auth Error:", error);
            const errorMessage = error.response?.data?.error || "Could not authorize this session.";
            Alert.alert(
                "Authentication Failed",
                errorMessage,
                [{ text: "OK", onPress: () => { isHandlingScan.current = false; setScanned(false); } }]
            );
        } finally {
            setAuthorizing(false);
            // We no longer use a generic timeout here to reset scanned state, 
            //, as it is now handled by the Alert callbacks.
        }
    };

    if (!permission) {
        return <View style={{ flex: 1, backgroundColor: colors.background }} />;
    }

    if (!permission.granted) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 20 }}>
                <Feather name="camera-off" size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
                <Text style={{ textAlign: 'center', color: colors.text, marginBottom: 16 }}>
                    We need your permission to show the camera
                </Text>
                <TouchableOpacity
                    onPress={requestPermission}
                    style={{ backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 }}
                >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (isScannerOpen) {
        return (
            <View style={{ flex: 1, backgroundColor: '#000' }}>
                <CameraView
                    style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
                    facing="back"
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                    }}
                />

                <View style={{ flex: 1, backgroundColor: 'transparent', flexDirection: 'column' }} pointerEvents="box-none">
                    <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <TouchableOpacity onPress={() => setIsScannerOpen(false)} style={{ padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }}>
                            <Feather name="x" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Scan QR Code</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
                        <View style={{ width: 250, height: 250, borderWidth: 2, borderColor: colors.primary, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)' }}>
                            {authorizing && (
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 22 }}>
                                    <ActivityIndicator size="large" color={colors.primary} />
                                    <Text style={{ color: '#fff', marginTop: 12, fontWeight: '600' }}>Authorizing...</Text>
                                </View>
                            )}
                        </View>
                        <Text style={{ color: '#fff', marginTop: 30, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 }}>
                            Point your camera at the QR code displayed on the APEXIS web login page.
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 30 }}>
                    <TouchableOpacity onPress={() => router.push('/settings')} style={{ marginRight: 16 }}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>Linked Devices</Text>
                </View>

                <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 24 }}>
                    <Feather name="monitor" size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center', marginBottom: 8 }}>
                        Use APEXIS on your computer
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
                        Open web.apexis.in on your computer and scan the QR code to sign in instantly.
                    </Text>

                    <TouchableOpacity
                        onPress={() => setIsScannerOpen(true)}
                        style={{ backgroundColor: colors.primary, width: '100%', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                    >
                        <Feather name="maximize" size={18} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Link a Device</Text>
                    </TouchableOpacity>
                </View>

                {sessionsLoading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
                ) : activeSessions.length > 0 ? (
                    <View>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 16 }}>Active Sessions</Text>
                        {activeSessions.map((session, index) => (
                            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 10 }}>
                                        <Feather name="globe" size={20} color={colors.text} />
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{session.device || "APEXIS Web API Session"}</Text>
                                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Active now · Web Browser</Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={{ padding: 8 }}
                                    onPress={() => {
                                        Alert.alert("Logout from Web", "Are you sure you want to disconnect this saved device?", [
                                            { text: "Cancel", style: "cancel" },
                                            {
                                                text: "Logout", style: "destructive", onPress: async () => {
                                                    try {
                                                        // We need to import revokeWebSession at the top... assuming it's exported from the same place as getActiveWebSessions which we already import
                                                        const { revokeWebSession } = require('@/services/authService');
                                                        await revokeWebSession(session.sessionId);
                                                        // filter it out quickly local side
                                                        setActiveSessions(prev => prev.filter(s => s.sessionId !== session.sessionId));
                                                    } catch (err: any) {
                                                        Alert.alert("Error", err.response?.data?.error || "Could not revoke session");
                                                    }
                                                }
                                            }
                                        ]);
                                    }}
                                >
                                    <Feather name="log-out" size={18} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>
        </View>
    );
}
