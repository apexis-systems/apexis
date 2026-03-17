import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, Image, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { uploadOrganizationLogo, updateOrganization, fetchSecureLogo } from '@/services/organizationService';

export default function CompanySettingsScreen() {
    const { user, updateUser } = useAuth() as any;
    const { colors } = useTheme();
    const router = useRouter();

    const [compName, setCompName] = useState('');
    const [logoUri, setLogoUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    useEffect(() => {
        if (user?.organization) {
            setCompName(user.organization.name || '');
            if (user.organization.logo) {
                loadLogo(user.organization.logo);
            }
        }
    }, [user?.organization]);

    const loadLogo = async (fileKey: string) => {
        const uri = await fetchSecureLogo(fileKey);
        setLogoUri(uri);
    };

    const handleUpdateName = async () => {
        if (!compName.trim()) {
            Alert.alert('Error', 'Company name cannot be empty');
            return;
        }

        setLoading(true);
        try {
            await updateOrganization({ name: compName });
            // Update local user state
            updateUser({
                organization: {
                    ...user.organization,
                    name: compName
                }
            });
            Alert.alert('Success', 'Company name updated successfully');
        } catch (error) {
            console.error('Update name error:', error);
            Alert.alert('Error', 'Failed to update company name');
        } finally {
            setLoading(true);
            // Re-fetch or update context might be better, but for now we manually update
            setLoading(false);
        }
    };

    const handleLogoUpload = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (result.canceled || !result.assets?.length) return;

            setUploadingLogo(true);
            const asset = result.assets[0];
            const formData = new FormData();
            formData.append('logo', {
                uri: asset.uri,
                type: asset.mimeType || 'image/jpeg',
                name: asset.fileName || 'logo.jpg',
            } as any);

            const res = await uploadOrganizationLogo(formData);
            if (res.logo) {
                // Update local user state
                updateUser({
                    organization: {
                        ...user.organization,
                        logo: res.logo
                    }
                });
                await loadLogo(res.logo);
                Alert.alert('Success', 'Company logo updated successfully');
            }
        } catch (e) {
            console.error("Logo upload error:", e);
            Alert.alert('Error', 'Failed to upload logo');
        } finally {
            setUploadingLogo(false);
        }
    };

    if (user?.role !== 'admin') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <Feather name="lock" size={48} color={colors.textMuted} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 16 }}>Access Denied</Text>
                <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8 }}>
                    Only administrators can access company settings.
                </Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, padding: 12 }}>
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: colors.background }}
        >
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
                {/* Header */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    backgroundColor: colors.background
                }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Company Settings</Text>
                    <View style={{ width: 32 }} />
                </View>

                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View>
                            {/* Logo Section */}
                            <View style={{ alignItems: 'center', marginBottom: 32 }}>
                                <TouchableOpacity
                                    onPress={handleLogoUpload}
                                    disabled={uploadingLogo}
                                    style={{
                                        width: 120,
                                        height: 120,
                                        borderRadius: 24,
                                        backgroundColor: colors.surface,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 16,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        overflow: 'hidden'
                                    }}
                                >
                                    {uploadingLogo ? (
                                        <ActivityIndicator size="large" color={colors.primary} />
                                    ) : logoUri ? (
                                        <Image source={{ uri: logoUri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                                    ) : (
                                        <View style={{ alignItems: 'center' }}>
                                            <Feather name="image" size={40} color={colors.textMuted} />
                                            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>Upload Logo</Text>
                                        </View>
                                    )}
                                    <View style={{
                                        position: 'absolute', bottom: 0, right: 0, left: 0,
                                        backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 4,
                                        alignItems: 'center'
                                    }}>
                                        <Text style={{ fontSize: 10, color: '#fff', fontWeight: 'bold' }}>Change</Text>
                                    </View>
                                </TouchableOpacity>
                                <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>
                                    This logo will represent your company across the platform.
                                </Text>
                            </View>

                            {/* Name Section */}
                            <View style={{ marginBottom: 24 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>Company Name</Text>
                                <TextInput
                                    value={compName}
                                    onChangeText={setCompName}
                                    placeholder="Enter company name"
                                    placeholderTextColor={colors.textMuted}
                                    style={{
                                        height: 52,
                                        backgroundColor: colors.surface,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        borderRadius: 12,
                                        paddingHorizontal: 16,
                                        fontSize: 16,
                                        color: colors.text
                                    }}
                                />
                            </View>

                            <TouchableOpacity
                                onPress={handleUpdateName}
                                disabled={loading}
                                style={{
                                    height: 52,
                                    backgroundColor: colors.primary,
                                    borderRadius: 16,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginTop: 8
                                }}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Save Changes</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </TouchableWithoutFeedback>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}
