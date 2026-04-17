import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Modal, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/AppText';
import { useTheme } from '@/contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
            } catch (e) {}

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
            <View style={{ flex: 1, backgroundColor: '#000' }}>
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
                            <CameraView
                                ref={cameraRef}
                                style={{ flex: 1 }}
                                facing={cameraFacing}
                                ratio="4:3"
                            />
                        </View>
                    </View>
                ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                        <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 20 }}>Camera permission is needed to take photos.</Text>
                        <TouchableOpacity
                            onPress={requestPermission}
                            style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }}
                        >
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Grant Permission</Text>
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
            </View>
        </Modal>
    );
}
