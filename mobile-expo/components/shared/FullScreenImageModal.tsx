import React, { useState, useEffect, useRef } from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Share as RNShare } from 'react-native';

import ZoomableImage from './ZoomableImage';

interface Props {
    visible: boolean;
    onClose: () => void;
    uri: string | null;
    onEdit?: (uri: string) => void;
}

export default function FullScreenImageModal({ visible, onClose, uri, onEdit }: Props) {
    const insets = useSafeAreaInsets();
    const [sharing, setSharing] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const tempFilesRef = useRef<Set<string>>(new Set());

    // Clean up temporary files on modal close or unmount
    useEffect(() => {
        if (!visible) {
            const files = Array.from(tempFilesRef.current);
            tempFilesRef.current.clear();
            const { deleteFilesAsync } = require('@/services/cacheService');
            deleteFilesAsync(files).catch(() => {});
        }
    }, [visible]);

    useEffect(() => {
        return () => {
            const files = Array.from(tempFilesRef.current);
            const { deleteFilesAsync } = require('@/services/cacheService');
            deleteFilesAsync(files).catch(() => {});
        };
    }, []);

    if (!uri) return null;

    const topOffset = Math.max(insets.top, 20);

    const getFileName = (url: string) => {
        try {
            const withoutQuery = url.split('?')[0];
            const parts = withoutQuery.split('/');
            return parts[parts.length - 1] || `photo_${Date.now()}.jpg`;
        } catch {
            return `photo_${Date.now()}.jpg`;
        }
    };

    const getLocalUri = async (url: string): Promise<string> => {
        if (url.startsWith('file://') || url.startsWith('/')) return url;
        const fileName = getFileName(url);
        const localUri = `${(FileSystem as any).cacheDirectory}fsm_${Date.now()}_${fileName}`;
        const { uri: downloaded } = await (FileSystem as any).downloadAsync(url, localUri);
        tempFilesRef.current.add(downloaded);
        return downloaded;
    };

    const handleDownload = async () => {
        if (downloading || sharing) return;
        setDownloading(true);
        try {
            // writeOnly: true avoids requesting the READ_MEDIA_AUDIO permission on Android
            const { status } = await MediaLibrary.requestPermissionsAsync(true);
            if (status !== 'granted') {
                Alert.alert('Permission required', 'Please allow access to your photo library to save images.');
                return;
            }
            const localUri = await getLocalUri(uri);
            await MediaLibrary.saveToLibraryAsync(localUri);
            Alert.alert('Saved', 'Photo saved to your gallery.');
        } catch (err) {
            console.error('Download error:', err);
            Alert.alert('Error', 'Failed to save photo.');
        } finally {
            setDownloading(false);
        }
    };

    const handleShare = async () => {
        if (sharing || downloading) return;
        setSharing(true);
        try {
            const localUri = await getLocalUri(uri);
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(localUri, {
                    mimeType: 'image/jpeg',
                    dialogTitle: getFileName(uri),
                });
            } else {
                await RNShare.share({ url: uri, title: getFileName(uri) });
            }
        } catch (err) {
            console.error('Share error:', err);
            Alert.alert('Error', 'Failed to share photo.');
        } finally {
            setSharing(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            statusBarTranslucent={true}
            presentationStyle="overFullScreen"
            onRequestClose={onClose}
        >
            <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
                <View style={styles.container}>
                    <ZoomableImage uri={uri} onDismiss={onClose} />

                    {/* Close button — top left */}
                    <TouchableOpacity
                        onPress={onClose}
                        style={[styles.closeBtn, { top: topOffset }]}
                        accessibilityLabel="Close"
                    >
                        <Feather name="x" size={24} color="#fff" />
                    </TouchableOpacity>

                    {/* Download + Share — top right */}
                    <View style={[styles.topRight, { top: topOffset }]}>
                        <TouchableOpacity
                            onPress={handleDownload}
                            disabled={downloading || sharing}
                            style={styles.iconBtn}
                            accessibilityLabel="Save to gallery"
                        >
                            {downloading
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Feather name="download" size={22} color="#fff" />
                            }
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleShare}
                            disabled={sharing || downloading}
                            style={styles.iconBtn}
                            accessibilityLabel="Share photo"
                        >
                            {sharing
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Feather name="share-2" size={22} color="#fff" />
                            }
                        </TouchableOpacity>
                    </View>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ← position:absolute is here so top/left actually work
    closeBtn: {
        position: 'absolute',
        left: 16,
        zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.55)',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topRight: {
        position: 'absolute',
        right: 16,
        flexDirection: 'row',
        gap: 8,
        zIndex: 100,
    },
    iconBtn: {
        backgroundColor: 'rgba(0,0,0,0.55)',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
