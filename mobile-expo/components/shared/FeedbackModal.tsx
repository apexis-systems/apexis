import React, { useState } from 'react';
import { Modal, View, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { useTheme } from '@/contexts/ThemeContext';
import { Feather } from '@expo/vector-icons';

interface Props {
    visible: boolean;
    onClose: () => void;
}

export default function FeedbackModal({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = () => {
        if (!subject.trim() || !message.trim()) {
            // Basic validation
            return;
        }
        // Handle submission
        setSubject('');
        setMessage('');
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: colors.surface, padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Feather name="message-square" size={20} color={colors.primary} />
                            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Give Feedback</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                            <Feather name="x" size={24} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textMuted, marginBottom: 6 }}>Subject</Text>
                            <TextInput
                                placeholder="What is this about?"
                                placeholderTextColor={colors.textMuted}
                                value={subject}
                                onChangeText={setSubject}
                                style={{
                                    backgroundColor: colors.background,
                                    color: colors.text,
                                    paddingHorizontal: 16,
                                    paddingVertical: 14,
                                    borderRadius: 10,
                                    borderWidth: 1,
                                    borderColor: colors.border
                                }}
                            />
                        </View>

                        <View style={{ marginBottom: 24 }}>
                            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textMuted, marginBottom: 6 }}>Your Feedback</Text>
                            <TextInput
                                placeholder="Tell us what you think..."
                                placeholderTextColor={colors.textMuted}
                                value={message}
                                onChangeText={setMessage}
                                multiline
                                textAlignVertical="top"
                                style={{
                                    backgroundColor: colors.background,
                                    color: colors.text,
                                    paddingHorizontal: 16,
                                    paddingVertical: 14,
                                    borderRadius: 10,
                                    height: 120,
                                    borderWidth: 1,
                                    borderColor: colors.border
                                }}
                            />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity onPress={onClose} style={{ flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSubmit} style={{ flex: 1, backgroundColor: colors.primary, padding: 14, borderRadius: 10, alignItems: 'center' }}>
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Submit</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
