import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

// Mock Data
const MOCK_CHATS = [
    {
        id: '1',
        name: 'Alpha Tower Team',
        type: 'group',
        lastMessage: 'Admin added Sarah (Client) recently.',
        time: '12:45 PM',
        unread: 2,
        isSystem: true,
        participants: 5,
        avatar: null
    },
    {
        id: '2',
        name: 'Sarah Jenkins',
        type: 'direct',
        lastMessage: 'Yes, the inspection is scheduled for tomorrow.',
        time: 'Yesterday',
        unread: 0,
        isSystem: false,
        role: 'Client',
        avatar: 'https://i.pravatar.cc/150?u=sarah'
    },
    {
        id: '3',
        name: 'Site Managers',
        type: 'group',
        lastMessage: 'Michael joined using invite code X7B9.',
        time: 'Monday',
        unread: 0,
        isSystem: true,
        participants: 3,
        avatar: null
    },
    {
        id: '4',
        name: 'David Chen',
        type: 'direct',
        lastMessage: 'Can you upload the latest drawings?',
        time: 'Monday',
        unread: 0,
        isSystem: false,
        role: 'Contributor',
        avatar: 'https://i.pravatar.cc/150?u=david'
    }
];

export default function ChatListScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredChats = MOCK_CHATS.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderChatItem = ({ item }: { item: typeof MOCK_CHATS[0] }) => (
        <TouchableOpacity
            onPress={() => router.push(`/chat/${item.id}`)}
            style={{
                flexDirection: 'row',
                padding: 16,
                backgroundColor: colors.surface,
                borderBottomWidth: 1,
                borderBottomColor: colors.border
            }}
        >
            {/* Avatar */}
            <View style={{ position: 'relative' }}>
                {item.type === 'group' ? (
                    <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name="users" size={24} color="#fff" />
                    </View>
                ) : (
                    <Image
                        source={{ uri: item.avatar || 'https://i.pravatar.cc/150' }}
                        style={{ width: 50, height: 50, borderRadius: 25 }}
                    />
                )}
                {item.unread > 0 && (
                    <View style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#25D366', borderWidth: 2, borderColor: colors.surface }} />
                )}
            </View>

            {/* Chat Info */}
            <View style={{ flex: 1, marginLeft: 14, justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                        {item.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: item.unread > 0 ? '#25D366' : colors.textMuted }}>
                        {item.time}
                    </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text
                        style={{
                            fontSize: 14,
                            color: item.isSystem ? '#f97316' : colors.textMuted,
                            fontStyle: item.isSystem ? 'italic' : 'normal',
                            flex: 1,
                            marginRight: 10
                        }}
                        numberOfLines={1}
                    >
                        {item.lastMessage}
                    </Text>

                    {item.unread > 0 && (
                        <View style={{ backgroundColor: '#25D366', borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{item.unread}</Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text }}>Chats</Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                    <TouchableOpacity>
                        <Feather name="camera" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity>
                        <Feather name="plus-circle" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search Bar */}
            <View style={{ padding: 12, backgroundColor: colors.surface }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 12, height: 36, borderWidth: 1, borderColor: colors.border }}>
                    <Feather name="search" size={16} color={colors.textMuted} />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search chats..."
                        placeholderTextColor={colors.textMuted}
                        style={{ flex: 1, color: colors.text, marginLeft: 8, fontSize: 15 }}
                    />
                </View>
            </View>

            {/* Chat List */}
            <FlatList
                data={filteredChats}
                keyExtractor={item => item.id}
                renderItem={renderChatItem}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 100 }}>
                        <Feather name="message-square" size={48} color={colors.border} />
                        <Text style={{ color: colors.textMuted, marginTop: 16, fontSize: 16 }}>No chats found</Text>
                    </View>
                }
            />

            {/* Floating Action Button */}
            {/* <TouchableOpacity
                style={{
                    position: 'absolute',
                    bottom: Platform.OS === 'ios' ? 90 : 80,
                    right: 20,
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: '#f97316',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#f97316',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 5,
                    elevation: 5
                }}
            >
                <Feather name="message-square" size={24} color="#fff" />
            </TouchableOpacity> */}
        </SafeAreaView>
    );
}
