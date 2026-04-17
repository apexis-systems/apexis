import { useState, useRef, useCallback } from 'react';
import { View, TouchableOpacity, ActivityIndicator, BackHandler } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Paths, File as FSFile } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter, useFocusEffect } from 'expo-router';
import SaveScanModal from '@/components/scan/SaveScanModal';
import DocumentScanProcessor, { DocumentScanProcessorRef } from '@/components/scan/DocumentScanProcessor';

export default function ScanScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const processorRef = useRef<DocumentScanProcessorRef>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState<'capturing' | 'enhancing' | null>(null);
    const router = useRouter();

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                router.back();
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [])
    );

    const facing = 'back';

    if (!user) return null;

    if (!permission) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
                    <Feather name="camera-off" size={64} color={colors.textMuted} style={{ marginBottom: 20 }} />
                    <Text style={{ textAlign: 'center', fontSize: 16, color: colors.text, marginBottom: 12 }}>
                        We need your permission to use the camera for scanning files.
                    </Text>
                    <TouchableOpacity
                        onPress={requestPermission}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            backgroundColor: colors.primary,
                            paddingHorizontal: 20,
                            paddingVertical: 12,
                            borderRadius: 10,
                        }}
                    >
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const takePicture = async () => {
        if (!cameraRef.current || isProcessing) return;
        setIsProcessing(true);
        setProcessingStep('capturing');
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.9,
                base64: false,
                exif: false,
            });

            if (!photo?.uri) return;

            // Fix orientation for iOS
            const manipulated = await ImageManipulator.manipulateAsync(
                photo.uri,
                [{ resize: { width: 1920 } }],
                { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
            );

            // --- Apply document scan (B&W) enhancement ---
            setProcessingStep('enhancing');
            let finalUri = manipulated.uri;

            try {
                const processed = await processorRef.current?.process(manipulated.uri);
                if (processed && processed.startsWith('data:image')) {
                    // Strip data URL prefix and save as real file
                    const base64Data = processed.replace(/^data:image\/\w+;base64,/, '');
                    const outputFile = new FSFile(Paths.cache, `scan_${Date.now()}.jpg`);
                    outputFile.write(atob(base64Data));
                    finalUri = outputFile.uri;
                }
            } catch (enhanceErr) {
                console.warn('Enhancement failed, using original:', enhanceErr);
                // Fall through — use the original photo
            }

            setCapturedImage(finalUri);
        } catch (error) {
            console.error('Failed to take picture:', error);
        } finally {
            setIsProcessing(false);
            setProcessingStep(null);
        }
    };

    const handleDiscard = () => {
        setCapturedImage(null);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
            {/* Hidden image processor — used for document enhancement */}
            <DocumentScanProcessor ref={processorRef} />

            {/* Header Overlay */}
            <View style={{
                position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
                paddingHorizontal: 20, paddingVertical: 16,
                backgroundColor: 'rgba(0,0,0,0.4)',
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Feather name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>Scan Document</Text>
                </View>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, marginLeft: 36 }}>
                    Line up your document and tap capture
                </Text>
            </View>

            {/* Camera View (self-closing) */}
            <CameraView
                style={{ flex: 1 }}
                facing={facing}
                ref={cameraRef}
                autofocus="on"
            />

            {/* Visual Guideline overlay (sibling, absolute) */}
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                <View style={{
                    width: 250,
                    height: 250,
                    borderWidth: 2,
                    borderColor: 'rgba(255,255,255,0.3)',
                    borderRadius: 24,
                    borderStyle: 'dashed',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}>
                    {/* Corner markers */}
                    {[
                        { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
                        { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
                        { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
                        { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
                    ].map((pos, i) => (
                        <View key={i} style={[{
                            position: 'absolute', width: 32, height: 32,
                            borderColor: colors.primary,
                        }, pos]} />
                    ))}

                    {/* Subtle scan line indicator */}
                    <View style={{ width: '80%', height: 2, backgroundColor: 'rgba(249,115,22,0.3)', borderRadius: 1 }} />
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 24, fontWeight: '600' }}>Align document within frame</Text>
            </View>

            {/* Processing Overlay */}
            {isProcessing && (
                <View style={{
                    position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
                    justifyContent: 'center', alignItems: 'center', zIndex: 20,
                }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ color: '#fff', marginTop: 12, fontSize: 14, fontWeight: '600' }}>
                        {processingStep === 'capturing' ? 'Capturing...' : '✦ Enhancing document...'}
                    </Text>
                </View>
            )}

            {/* Bottom Controls */}
            <View style={{
                paddingBottom: 40,
                paddingTop: 20,
                backgroundColor: '#000',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 40,
            }}>

                {/* Flash toggle placeholder */}
                <View style={{ width: 44, height: 44 }} />

                {/* Shutter Button */}
                <TouchableOpacity
                    onPress={takePicture}
                    disabled={isProcessing}
                    style={{
                        width: 72,
                        height: 72,
                        borderRadius: 36,
                        backgroundColor: 'transparent',
                        borderWidth: 4,
                        borderColor: isProcessing ? colors.primary : '#fff',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <View style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: isProcessing ? colors.primary : '#fff',
                    }} />
                </TouchableOpacity>

                {/* B&W mode badge */}
                <View style={{
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
                    alignItems: 'center',
                }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>B&W</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 8 }}>SCAN</Text>
                </View>

            </View>

            {/* Save flow modal */}
            {capturedImage && (
                <SaveScanModal
                    imageUri={capturedImage}
                    onDiscard={handleDiscard}
                    onSaveSuccess={() => setCapturedImage(null)}
                />
            )}
        </SafeAreaView>
    );
}
