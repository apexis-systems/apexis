import React, { useState } from 'react';
import { View, TouchableOpacity, Image, Modal, TextInput } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useSocket } from '@/contexts/SocketContext';
import HelpSupportModal from './HelpSupportModal';
import FeedbackModal from './FeedbackModal';
import LanguageSelectorModal from './LanguageSelectorModal';

interface MainHeaderProps {
    showBack?: boolean;
    onSearchChange?: (query: string) => void;
    searchPlaceholder?: string;
}

export default function MainHeader({ showBack, onSearchChange, searchPlaceholder = "Search..." }: MainHeaderProps) {
    const { isDark, colors, toggleTheme } = useTheme();
    const router = useRouter();
    const { unreadNotificationCount } = useSocket();

    const [isSearchActive, setIsSearchActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [showLanguage, setShowLanguage] = useState(false);

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        if (onSearchChange) onSearchChange(text);
    };

    const handleCloseSearch = () => {
        setIsSearchActive(false);
        setSearchQuery('');
        if (onSearchChange) onSearchChange('');
    };

    return (
        <>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    backgroundColor: colors.surface,
                    minHeight: 52,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)')}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                        <View
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                overflow: 'hidden',
                            }}
                        >
                            <Image
                                source={require('../../assets/images/app-icon.png')}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                            />
                        </View>
                        <Text className="font-angelica" style={{ fontSize: 18, color: colors.primary, letterSpacing: 0.5 }}>APEXIS</Text>
                    </TouchableOpacity>

                    {/* {showBack && (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ padding: 6, borderRadius: 20, backgroundColor: colors.background, marginLeft: 4 }}
                        >
                            <Feather name="arrow-left" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                    )} */}
                </View>

                <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => setIsSearchActive(true)} style={{ padding: 6, borderRadius: 20 }}>
                        <Feather name="search" size={18} color={colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/notifications')}
                        style={{ padding: 6, borderRadius: 20, position: 'relative' }}
                    >
                        <Feather name="bell" size={18} color={colors.textMuted} />
                        {unreadNotificationCount > 0 && (
                            <View style={{
                                position: 'absolute',
                                right: 4,
                                top: 4,
                                minWidth: 14,
                                height: 14,
                                borderRadius: 7,
                                backgroundColor: colors.primary,
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingHorizontal: 2
                            }}>
                                <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>
                                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setShowMoreMenu(true)} style={{ padding: 6, borderRadius: 20 }}>
                        <Feather name="more-vertical" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>
            </View>

            {isSearchActive && (
                <View style={{
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    backgroundColor: colors.surface,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12
                    }}>
                        <View style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: colors.background,
                            borderRadius: 14,
                            paddingHorizontal: 12,
                            height: 44,
                            borderWidth: 1,
                            borderColor: colors.border,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.05,
                            shadowRadius: 4,
                            elevation: 2,
                        }}>
                            <Feather name="search" size={18} color={colors.textMuted} />
                            <TextInput
                                autoFocus
                                value={searchQuery}
                                onChangeText={handleSearchChange}
                                placeholder={searchPlaceholder}
                                placeholderTextColor={colors.textMuted}
                                style={{ flex: 1, color: colors.text, marginLeft: 10, fontSize: 15 }}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => handleSearchChange('')} style={{ padding: 4 }}>
                                    <Feather name="x-circle" size={18} color={colors.textMuted} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity onPress={handleCloseSearch}>
                            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* More Menu Modal */}
            <Modal visible={showMoreMenu} transparent animationType="fade" onRequestClose={() => setShowMoreMenu(false)}>
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setShowMoreMenu(false)}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingRight: 10, paddingTop: 50 }}
                >
                    <View style={{
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                        width: 180,
                        padding: 4,
                        borderWidth: 1,
                        borderColor: colors.border,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 10,
                        elevation: 10,
                    }}>
                        <TouchableOpacity
                            onPress={() => { setShowMoreMenu(false); toggleTheme(); }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8 }}
                        >
                            <Feather name={isDark ? "sun" : "moon"} size={16} color={colors.textMuted} />
                            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text }}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => { setShowMoreMenu(false); setShowLanguage(true); }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8 }}
                        >
                            <Feather name="globe" size={16} color={colors.textMuted} />
                            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text }}>Language</Text>
                        </TouchableOpacity>

                        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4, marginHorizontal: 8 }} />

                        <TouchableOpacity
                            onPress={() => { setShowMoreMenu(false); setShowHelp(true); }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8 }}
                        >
                            <Feather name="help-circle" size={16} color={colors.textMuted} />
                            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text }}>Help & Support</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => { setShowMoreMenu(false); setShowFeedback(true); }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8 }}
                        >
                            <Feather name="message-square" size={16} color={colors.textMuted} />
                            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text }}>Feedback</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <HelpSupportModal visible={showHelp} onClose={() => setShowHelp(false)} />
            <FeedbackModal visible={showFeedback} onClose={() => setShowFeedback(false)} />
            <LanguageSelectorModal visible={showLanguage} onClose={() => setShowLanguage(false)} />
        </>
    );
}
