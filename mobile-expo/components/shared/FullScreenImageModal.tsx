import React from 'react';
import { View, Modal, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
    visible: boolean;
    onClose: () => void;
    uri: string | null;
}

const { width, height } = Dimensions.get('window');

export default function FullScreenImageModal({ visible, onClose, uri }: Props) {
    const insets = useSafeAreaInsets();

    if (!uri) return null;

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="fade"
            statusBarTranslucent={true}
            presentationStyle="fullScreen"
        >
            <View style={styles.container}>
                <TouchableOpacity
                    onPress={onClose}
                    style={[styles.closeButton, { top: Math.max(insets.top, 20) }]}
                >
                    <Feather name="x" size={28} color="#fff" />
                </TouchableOpacity>

                <Image
                    source={{ uri }}
                    style={styles.image}
                    resizeMode="contain"
                />
            </View>
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
    image: {
        width: width,
        height: height,
    },
    closeButton: {
        position: 'absolute',
        right: 20,
        zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
