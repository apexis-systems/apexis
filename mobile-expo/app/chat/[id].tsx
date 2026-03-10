import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

export default function ChatDetailScreen() {
    const { id } = useLocalSearchParams();
    const { colors, isDark } = useTheme();
    const router = useRouter();
    const [message, setMessage] = useState('');

    // Mock Messages combining normal text + system notifications about users joining
    const MOCK_MESSAGES = [
        {
            id: 'sys-1',
            type: 'system',
            text: 'Admin created group "Alpha Tower Team"',
            time: '11:00 AM'
        },
        {
            id: 'sys-2',
            type: 'system',
            text: 'Sarah (Client) joined using invite code A1B2',
            time: '11:05 AM'
        },
        {
            id: 'msg-1',
            type: 'received',
            sender: 'Sarah (Client)',
            text: 'Hi everyone! I just joined visually through the app.',
            time: '11:10 AM'
        },
        {
            id: 'msg-2',
            type: 'sent',
            sender: 'Admin',
            text: 'Welcome Sarah! Have you checked the latest site snags?',
            time: '11:15 AM'
        },
        {
            id: 'sys-3',
            type: 'system',
            text: 'Admin added David (Contributor) recently',
            time: '12:45 PM'
        }
    ];

    const renderMessage = ({ item }: { item: any }) => {
        if (item.type === 'system') {
            return (
                <View style={{ alignItems: 'center', marginVertical: 12 }}>
                    <View style={{ backgroundColor: isDark ? colors.surface : '#FFF3E0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: isDark ? colors.border : '#FFE0B2' }}>
                        <Text style={{ fontSize: 12, color: '#f97316', fontWeight: '500', textAlign: 'center' }}>
                            {item.text}
                        </Text>
                    </View>
                </View>
            );
        }

        const isMe = item.type === 'sent';

        return (
            <View style={{ flexDirection: 'row', justifyContent: isMe ? 'flex-end' : 'flex-start', marginVertical: 4 }}>
                <View style={{
                    maxWidth: '80%',
                    backgroundColor: isMe ? '#f97316' : colors.surface,
                    borderWidth: isMe ? 0 : 1,
                    borderColor: colors.border,
                    padding: 12,
                    borderRadius: 16,
                    borderBottomRightRadius: isMe ? 4 : 16,
                    borderBottomLeftRadius: isMe ? 16 : 4,
                }}>
                    {!isMe && (
                        <Text style={{ fontSize: 12, color: '#f97316', fontWeight: '600', marginBottom: 2 }}>{item.sender}</Text>
                    )}
                    <Text style={{ fontSize: 15, color: isMe ? '#fff' : colors.text, lineHeight: 20 }}>
                        {item.text}
                    </Text>
                    <Text style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.7)' : colors.textMuted, alignSelf: 'flex-end', marginTop: 4 }}>
                        {item.time} {isMe && <Ionicons name="checkmark-done" size={14} color="#fff" />}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, flexDirection: 'row', alignItems: 'center' }}>
                    <Feather name="chevron-left" size={28} color="#f97316" style={{ marginLeft: -8 }} />
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
                        <Feather name="users" size={18} color="#fff" />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }} numberOfLines={1}>Alpha Tower Team</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Sarah, David, Michael, You</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 16, paddingRight: 8 }}>
                    <TouchableOpacity>
                        <Feather name="video" size={22} color="#f97316" />
                    </TouchableOpacity>
                    <TouchableOpacity>
                        <Feather name="phone" size={20} color="#f97316" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Chat Area */}
            {/* Using a subtle pattern/color like WhatsApp for background */}
            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: isDark ? '#0b141a' : '#efeae2' }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <FlatList
                    data={MOCK_MESSAGES}
                    keyExtractor={item => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={{ padding: 16 }}
                />

                {/* Input Area */}
                <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 8, flexDirection: 'row', alignItems: 'flex-end' }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, minHeight: 48 }}>
                        <TouchableOpacity style={{ padding: 4 }}>
                            <Feather name="smile" size={24} color={colors.textMuted} />
                        </TouchableOpacity>
                        <TextInput
                            value={message}
                            onChangeText={setMessage}
                            placeholder="Message..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            style={{ flex: 1, color: colors.text, fontSize: 16, marginHorizontal: 8, maxHeight: 100, paddingTop: Platform.OS === 'ios' ? 4 : 0 }}
                        />
                        <TouchableOpacity style={{ padding: 4 }}>
                            <Feather name="paperclip" size={22} color={colors.textMuted} style={{ transform: [{ rotate: '-45deg' }] }} />
                        </TouchableOpacity>
                        {!message && (
                            <TouchableOpacity style={{ padding: 4, marginLeft: 4 }}>
                                <Feather name="camera" size={22} color={colors.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <TouchableOpacity
                        style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
                    >
                        {message ? (
                            <Feather name="send" size={20} color="#fff" style={{ marginLeft: 2, marginTop: 2 }} />
                        ) : (
                            <Feather name="mic" size={22} color="#fff" />
                        )}
                    </TouchableOpacity>
                </SafeAreaView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
