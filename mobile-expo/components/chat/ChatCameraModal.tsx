import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Modal, Image, ActivityIndicator, Alert, Platform, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/AppText';
import { useTheme } from '@/contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedProps,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS
} from 'react-native-reanimated';

const AnimatedCameraView = Animated.createAnimatedComponent(CameraView);


interface Props {
    visible: boolean;
    onClose: () => void;
    onCapture: (asset: any) => void;
}

export default function ChatCameraModal({ visible, onClose, onCapture }: Props) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');

    //zoom 
    const zoomShared = useSharedValue(0); // 0–1 for expo-camera
    const startZoom = useSharedValue(0);
    const [zoomDisplay, setZoomDisplay] = useState('1.0x'); // live label
    const zoomLabelOpacity = useSharedValue(0);
    let zoomHideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Max real-world zoom multiplier each platform supports
    const MAX_ZOOM_FACTOR = Platform.OS === 'ios' ? 10 : 10;

    // Converts 0-1 internal value → display string like "2.3x"
    const toDisplayZoom = (val: number) => {
        const factor = 1 + val * (MAX_ZOOM_FACTOR - 1);
        return `${factor.toFixed(1)}x`;
    };

    const showZoomLabel = (val: number) => {
        setZoomDisplay(toDisplayZoom(val));
        zoomLabelOpacity.value = withTiming(1, { duration: 80 });
        if (zoomHideTimer.current) clearTimeout(zoomHideTimer.current);
        zoomHideTimer.current = setTimeout(() => {
            zoomLabelOpacity.value = withTiming(0, { duration: 400 });
        }, 1500);
    };

    const pinchGesture = React.useMemo(() =>
        Gesture.Pinch()
            .onStart(() => {
                startZoom.value = zoomShared.value;
            })
            .onUpdate((event) => {
                // Multiplicative zoom feels natural — same as native camera apps
                const raw = startZoom.value + (event.scale - 1) * (1 / MAX_ZOOM_FACTOR);
                const clamped = Math.max(0, Math.min(1, raw));
                zoomShared.value = clamped;
                runOnJS(showZoomLabel)(clamped);
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [zoomShared, startZoom]);

    const animatedCameraProps = useAnimatedProps(() => ({
        zoom: zoomShared.value,
    }));

    const zoomLabelStyle = useAnimatedStyle(() => ({
        opacity: zoomLabelOpacity.value,
    }));

    // Keep for backwards compat (unused after button removal)
    const handleManualZoom = (z: number) => {
        zoomShared.value = withSpring(z, { damping: 20, stiffness: 100 });
        runOnJS(showZoomLabel)(z);
    };

    useEffect(() => {
        if (visible && (!permission || !permission.granted)) {
            requestPermission();
        }
    }, [visible, permission?.granted]);

    const handleCapture = async () => {
        if (!cameraRef.current || isProcessing) return;
        setIsProcessing(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.9,
            });
            if (photo) {
                // 1. Calculate the crop to enforce a 4:3 aspect ratio (Portrait 3:4) - iOS ONLY
                const { width, height } = photo;
                let crop = undefined;

                if (Platform.OS === 'ios') {
                    const targetRatio = 3 / 4;
                    const currentRatio = width / height;
                    const tolerance = 0.01;

                    if (currentRatio > targetRatio + tolerance) {
                        const newWidth = Math.min(width, Math.floor(height * targetRatio));
                        const originX = Math.max(0, Math.floor((width - newWidth) / 2));
                        const safeWidth = Math.min(newWidth, width - originX);
                        crop = { originX, originY: 0, width: safeWidth, height };
                    } else if (currentRatio < targetRatio - tolerance) {
                        const newHeight = Math.min(height, Math.floor(width / targetRatio));
                        const originY = Math.max(0, Math.floor((height - newHeight) / 2));
                        const safeHeight = Math.min(newHeight, height - originY);
                        crop = { originX: 0, originY, width, height: safeHeight };
                    }
                }

                // 2. Fix orientation/resolution for iOS/Android consistency
                const manipActions: any[] = [];
                if (crop) manipActions.push({ crop });

                const finalWidth = crop ? crop.width : width;
                const finalHeight = crop ? crop.height : height;
                const resizeOptions = finalWidth > finalHeight ? { width: 1920 } : { height: 1920 };
                manipActions.push({ resize: resizeOptions });

                const manipulated = await ImageManipulator.manipulateAsync(
                    photo.uri,
                    manipActions,
                    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
                );

                onCapture({
                    uri: manipulated.uri,
                    name: `photo_${Date.now()}.jpg`,
                    type: 'image/jpeg',
                    size: 0
                });
                onClose();
            }
        } catch (error) {
            console.error('Capture error:', error);
            Alert.alert('Error', 'Failed to capture photo');
        } finally {
            setIsProcessing(false);
        }
    };

    const pickFromGallery = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.9,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            let uri = asset.uri;
            try {
                const manipulated = await ImageManipulator.manipulateAsync(
                    uri,
                    [{ resize: { width: 1920 } }],
                    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
                );
                uri = manipulated.uri;
            } catch (e) { }

            onCapture({
                uri,
                name: asset.fileName || `image_${Date.now()}.jpg`,
                type: 'image/jpeg',
                size: asset.fileSize || 0
            });
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            statusBarTranslucent={true}
            presentationStyle="fullScreen"
        >
            <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
                {/* Header */}
                <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingHorizontal: 20, paddingTop: Math.max(insets.top, 16), paddingBottom: 16,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                }}>
                    <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
                        <Feather name="x" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Capture Photo</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Camera View */}
                {permission?.granted ? (
                    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'flex-start', alignItems: 'center', paddingTop: 95 }}>
                        <View style={{ width: '100%', aspectRatio: 3 / 4, overflow: 'hidden', backgroundColor: '#111' }}>
                            <GestureDetector gesture={pinchGesture}>
                                <View collapsable={false} style={StyleSheet.absoluteFill}>
                                    <AnimatedCameraView
                                        ref={cameraRef}
                                        style={{ flex: 1 }}
                                        facing={cameraFacing}
                                        ratio="4:3"
                                        animatedProps={animatedCameraProps}
                                    />
                                </View>
                            </GestureDetector>
                            {/* Dynamic Zoom Indicator */}
                            <Animated.View
                                pointerEvents="none"
                                style={[
                                    zoomLabelStyle,
                                    {
                                        position: 'absolute',
                                        bottom: 16,
                                        alignSelf: 'center',
                                        backgroundColor: 'rgba(0,0,0,0.55)',
                                        paddingHorizontal: 14,
                                        paddingVertical: 6,
                                        borderRadius: 20,
                                        zIndex: 30,
                                    }
                                ]}
                            >
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{zoomDisplay}</Text>
                            </Animated.View>
                        </View>
                    </View>
                ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                        <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 20 }}>Camera permission is needed to take photos.</Text>
                        <TouchableOpacity
                            onPress={requestPermission}
                            style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }}
                        >
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Continue</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Processing Overlay */}
                {isProcessing && (
                    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 20 }}>
                        <ActivityIndicator size="large" color="#fff" />
                    </View>
                )}

                {/* Bottom Controls */}
                <View style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)', paddingBottom: Math.max(insets.bottom, 16), paddingTop: 20,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around'
                }}>
                    <TouchableOpacity onPress={pickFromGallery} style={{ alignItems: 'center', width: 70 }}>
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="image" size={22} color="#fff" />
                        </View>
                        <Text style={{ color: '#ccc', fontSize: 10, marginTop: 5 }}>Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleCapture} disabled={isProcessing} style={{ alignItems: 'center' }}>
                        <View style={{
                            width: 76, height: 76, borderRadius: 38,
                            borderWidth: 4, borderColor: '#fff',
                            backgroundColor: '#ea8c0a',
                            alignItems: 'center', justifyContent: 'center'
                        }}>
                            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff' }} />
                        </View>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 5 }}>Capture</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setCameraFacing(current => current === 'back' ? 'front' : 'back')} style={{ alignItems: 'center', width: 70 }}>
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
                        </View>
                        <Text style={{ color: '#ccc', fontSize: 10, marginTop: 5 }}>Flip</Text>
                    </TouchableOpacity>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
}
