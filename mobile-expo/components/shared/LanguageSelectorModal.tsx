import React from 'react';
import { Modal, View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';

interface Props {
    visible: boolean;
    onClose: () => void;
}

const LANGUAGES = [
    { code: 'en', label: 'English (US)' },
    { code: 'hi', label: 'हिन्दी (Hindi)' },
    { code: 'te', label: 'తెలుగు (Telugu)' }
];

export default function LanguageSelectorModal({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const { i18n } = useTranslation();

    const changeLanguage = async (code: string) => {
        await AsyncStorage.setItem('@app_language', code);
        i18n.changeLanguage(code);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: colors.surface, padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Select Language</Text>

                    {LANGUAGES.map((lang) => (
                        <TouchableOpacity
                            key={lang.code}
                            onPress={() => changeLanguage(lang.code)}
                            style={{
                                paddingVertical: 16,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.border,
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <Text style={{ color: colors.text, fontSize: 16, fontWeight: i18n.language === lang.code ? '700' : '400' }}>
                                {lang.label}
                            </Text>
                            {i18n.language === lang.code && (
                                <Feather name="check" size={20} color={colors.primary} />
                            )}
                        </TouchableOpacity>
                    ))}

                    <TouchableOpacity onPress={onClose} style={{ marginTop: 24, backgroundColor: colors.primary, padding: 14, borderRadius: 10, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
