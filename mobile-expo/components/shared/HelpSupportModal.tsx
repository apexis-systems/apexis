import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Feather } from '@expo/vector-icons';

interface Props {
    visible: boolean;
    onClose: () => void;
}

const videos = [
    { title: 'Getting Started with Apexis', duration: '3:45', type: 'video' },
    { title: 'Uploading Documents & Photos', duration: '2:30', type: 'video' },
    { title: 'Managing Project Permissions', duration: '4:10', type: 'video' },
    { title: 'Using the Snag List', duration: '3:00', type: 'video' },
];

const faqs = [
    { q: 'How do I upload documents to a project?', a: 'Navigate to the project workspace, select the Documents tab, choose a folder, and click Upload.' },
    { q: 'How do I control what clients can see?', a: 'Admin users can toggle visibility on documents and photos using the eye icon.' },
    { q: 'Can I share files with external users?', a: 'Yes, use the Share button on any document or photo to share via WhatsApp, Email, or Copy Link.' },
    { q: 'What is the Snag List?', a: 'A task tracker for issues that need resolution. Each snag has a status, assignee, and comments.' },
];

export default function HelpSupportModal({ visible, onClose }: Props) {
    const { colors, isDark } = useTheme();
    const [activeTab, setActiveTab] = useState<'videos' | 'tutorials' | 'faq'>('videos');

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: colors.surface, padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '80%' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Feather name="help-circle" size={20} color={colors.primary} />
                            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Help & Support</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                            <Feather name="x" size={24} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Tabs */}
                    <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderRadius: 10, padding: 4, marginBottom: 16 }}>
                        {[
                            { key: 'videos', label: 'Support Videos' },
                            { key: 'tutorials', label: 'YouTube Tutorials' },
                            { key: 'faq', label: 'FAQs' }
                        ].map(tab => (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setActiveTab(tab.key as any)}
                                style={{
                                    flex: 1,
                                    paddingVertical: 10,
                                    alignItems: 'center',
                                    borderRadius: 8,
                                    backgroundColor: activeTab === tab.key ? colors.surface : 'transparent'
                                }}
                            >
                                <Text style={{ fontSize: 12, fontWeight: '600', color: activeTab === tab.key ? colors.text : colors.textMuted }}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
                        {activeTab === 'videos' && videos.map((v, i) => (
                            <TouchableOpacity key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                                <Feather name="play-circle" size={28} color={colors.primary} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 }}>{v.title}</Text>
                                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{v.duration}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}

                        {activeTab === 'tutorials' && videos.map((v, i) => (
                            <TouchableOpacity key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                                <Feather name="youtube" size={28} color="#ef4444" />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 }}>{v.title}</Text>
                                    <Text style={{ fontSize: 12, color: colors.textMuted }}>YouTube · {v.duration}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}

                        {activeTab === 'faq' && faqs.map((f, i) => (
                            <View key={i} style={{ padding: 16, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, lineHeight: 20 }}>{f.q}</Text>
                                <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 20 }}>{f.a}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
