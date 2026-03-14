import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getSecureFileUrl } from '@/services/fileService';

interface Props {
    fileKey?: string;
    name?: string;
    size?: number;
    style?: any;
}

export default function SecureAvatar({ fileKey, name, size = 40, style }: Props) {
    const [imgUri, setImgUri] = useState<string | null>(null);

    useEffect(() => {
        const fetchImage = async () => {
            if (!fileKey) {
                setImgUri(null);
                return;
            }
            try {
                const uri = await getSecureFileUrl(fileKey);
                setImgUri(uri);
            } catch (err) {
                console.error("Failed to fetch secure avatar", err);
                setImgUri(null);
            }
        };

        fetchImage();
    }, [fileKey]);


    if (imgUri) {
        return (
            <Image
                source={{ uri: imgUri }}
                style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
            />
        );
    }

    return (
        <View style={[{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: '#f97316',
            alignItems: 'center',
            justifyContent: 'center'
        }, style]}>
            {name ? (
                <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '700' }}>
                    {name.charAt(0).toUpperCase()}
                </Text>
            ) : (
                <Feather name="user" size={size * 0.6} color="#fff" />
            )}
        </View>
    );
}

const styles = StyleSheet.create({});
