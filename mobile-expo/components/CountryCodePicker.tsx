import React, { useState } from 'react';
import {
    View,
    TouchableOpacity,
    Modal,
    FlatList,
    StyleSheet,
    Platform
} from 'react-native';
import { Text, TextInput } from './ui/AppText';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

export interface Country {
    name: string;
    code: string;
    flag: string;
    /** Number of digits in the subscriber number (excluding country code) */
    phoneDigits: number;
}

export const countries: Country[] = [
    { name: 'India',                code: '+91',  flag: '🇮🇳', phoneDigits: 10 },
    { name: 'United States',        code: '+1',   flag: '🇺🇸', phoneDigits: 10 },
    { name: 'United Kingdom',       code: '+44',  flag: '🇬🇧', phoneDigits: 10 },
    { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪', phoneDigits: 9  },
    { name: 'Saudi Arabia',         code: '+966', flag: '🇸🇦', phoneDigits: 9  },
    { name: 'Australia',            code: '+61',  flag: '🇦🇺', phoneDigits: 9  },
    { name: 'Canada',               code: '+1',   flag: '🇨🇦', phoneDigits: 10 },
    { name: 'Singapore',            code: '+65',  flag: '🇸🇬', phoneDigits: 8  },
    { name: 'Germany',              code: '+49',  flag: '🇩🇪', phoneDigits: 10 },
    { name: 'France',               code: '+33',  flag: '🇫🇷', phoneDigits: 9  },
];

/** Returns true only for Indian numbers (phone OTP is only supported for +91) */
export const isIndianCountry = (country: Country): boolean => country.code === '+91';

interface CountryCodePickerProps {
    selectedCountry: Country;
    onSelect: (country: Country) => void;
}

export default function CountryCodePicker({ selectedCountry, onSelect }: CountryCodePickerProps) {
    const [modalVisible, setModalVisible] = useState(false);
    const { colors } = useTheme();

    const renderItem = ({ item }: { item: Country }) => (
        <TouchableOpacity
            style={[styles.countryItem, { borderBottomColor: colors.border }]}
            onPress={() => {
                onSelect(item);
                setModalVisible(false);
            }}
        >
            <Text style={{ fontSize: 24, marginRight: 12 }}>{item.flag}</Text>
            <Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>{item.name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 16 }}>{item.code}</Text>
        </TouchableOpacity>
    );

    return (
        <View>
            <TouchableOpacity
                onPress={() => setModalVisible(true)}
                style={[styles.selector, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
                <Text style={{ fontSize: 20, marginRight: 4 }}>{selectedCountry.flag}</Text>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{selectedCountry.code}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.textMuted} style={{ marginLeft: 2 }} />
            </TouchableOpacity>

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Select Country</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={countries}
                            renderItem={renderItem}
                            keyExtractor={(item) => item.name + item.code}
                            contentContainerStyle={{ paddingBottom: 40 }}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1,
        marginRight: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        height: '60%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 16,
        borderBottomWidth: 1,
        marginBottom: 8,
    },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
});
