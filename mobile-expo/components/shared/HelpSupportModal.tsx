import React, { useState } from 'react';
import { Modal, View, TouchableOpacity, ScrollView, TextInput, Image, Linking } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { useTheme } from '@/contexts/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

interface Props {
    visible: boolean;
    onClose: () => void;
}

interface YouTubeVideo {
    id: string;
    title: string;
    duration: string;
    description?: string;
}

const videos = [
    { title: 'Getting Started with APEXISpro™', duration: '3:45', type: 'video' },
    { title: 'Uploading Documents & Photos', duration: '2:30', type: 'video' },
    { title: 'Managing Project Permissions', duration: '4:10', type: 'video' },
    { title: 'Using the Snag List', duration: '3:00', type: 'video' },
];

const youtubeTutorials: YouTubeVideo[] = [
    {
        id: 'JepGKRCDAmk',
        title: 'How to create a RFI from a photo',
        duration: '0:39',
        description: 'Learn how to generate a Request For Information (RFI) directly from a project photo.',
    },
    {
        id: 'joJ_s9nXLXg',
        title: 'How to create a snag on computer',
        duration: '0:33',
        description: 'Learn how to create and log a snag/issue from the web/computer portal.',
    },
    {
        id: 'uXy60dZKshk',
        title: 'How to create a RFI on a photo on computer',
        duration: '0:29',
        description: 'Creating RFIs on project photos using the web interface.',
    },
    {
        id: '8u7gZt2EOys',
        title: 'How to upload a document on a computer',
        duration: '0:43',
        description: 'Easily upload, organize, and store documents from your computer.',
    },
    {
        id: 'OfflHy2fanI',
        title: 'How to click a photo',
        duration: '0:30',
        description: 'Guidelines on taking and adding photos within the ApexisPro app.',
    },
    {
        id: 'qXnJHhu6MxE',
        title: 'How to add a snag',
        duration: '0:23',
        description: 'Quickly log snags on-site using your mobile device.',
    },
    {
        id: 'bpdf9xfnASU',
        title: 'How to upload a photo from phone gallery',
        duration: '0:25',
        description: 'Upload existing pictures from your phone gallery to the project gallery.',
    },
    {
        id: 'uVyOSkIvE1Y',
        title: 'How to link a document to a document',
        duration: '0:30',
        description: 'Connect related documents together for easier navigation.',
    },
    {
        id: 'p8bUX7P4Fts',
        title: 'How to send us a feedback',
        duration: '0:14',
        description: 'Help us improve by sending your feedback directly from the app.',
    },
    {
        id: 'tB41THJIaI4',
        title: 'How to change light mode to dark mode',
        duration: '0:12',
        description: 'Toggle between light and dark themes in settings.',
    },
    {
        id: 'TMShpJyGfXw',
        title: 'How to change language',
        duration: '0:20',
        description: 'Update the language settings in your profile.',
    },
    {
        id: '8E2aGUkYxN8',
        title: 'How to create a snag on a photo',
        duration: '0:31',
        description: 'Create and pin a snag directly onto an uploaded photo.',
    },
    {
        id: '86oxYFUHh54',
        title: 'How to respond to a RFI',
        duration: '0:20',
        description: 'Quick walkthrough on responding to open Requests For Information.',
    },
    {
        id: 'pd5mim3dhbY',
        title: 'How to Respond to RFI by linking to a photo',
        duration: '0:30',
        description: 'Attach visual proof when responding to a project RFI.',
    },
    {
        id: 'Sc1nxD_RxKc',
        title: 'Respond to RFI by linking a document',
        duration: '0:23',
        description: 'Reference files or drawings when answering an RFI.',
    },
    {
        id: 'cwk2UqHyhEw',
        title: 'How to Link a photo to a Document',
        duration: '1:02',
        description: 'Associate relevant site photos with files or documents.',
    },
    {
        id: '_r5jg07xVOs',
        title: 'How to onboard a client',
        duration: '0:15',
        description: 'Invite and onboard clients to your project workspace.',
    },
    {
        id: 'OUaO0dEKNmc',
        title: 'How to create a RFI on a document on phone',
        duration: '0:32',
        description: 'Mark up documents and raise RFIs directly from your phone.',
    },
    {
        id: '94e5BWsuVZM',
        title: 'How to organize RFIs for easier access',
        duration: '0:29',
        description: 'Manage and categorize RFIs to keep projects organized.',
    },
    {
        id: 'rIS7ReEeTvQ',
        title: 'How to create a RFI',
        duration: '0:47',
        description: 'Standard workflow for creating a new RFI.',
    },
    {
        id: 'fGIVed0-7tA',
        title: 'How to add Only For Reference mark on a document',
        duration: '0:23',
        description: 'Mark a document as "Only For Reference" (OFR).',
    },
    {
        id: '1b4kDjHXscc',
        title: 'How to add Do Not Follow mark on a document',
        duration: '0:22',
        description: 'Tag obsolete or updated documents as "Do Not Follow".',
    },
    {
        id: 'i3fH-XHu7Xw',
        title: 'How to upload a document on phone',
        duration: '0:40',
        description: 'Upload documents and files directly using your phone.',
    },
    {
        id: 'NBtk6Nkm7a4',
        title: 'How to change roles',
        duration: '0:14',
        description: 'Update project roles and privileges in workspace settings.',
    },
    {
        id: 'cX1LyzXD8hY',
        title: 'How to change profile photo and username',
        duration: '0:17',
        description: 'Edit your personal profile information.',
    },
    {
        id: '5iGohI_YJuM',
        title: 'How to change company settings',
        duration: '0:20',
        description: 'Modify company profile and settings.',
    },
    {
        id: 'PzIgB8YaFvk',
        title: 'How to onboard a contributor',
        duration: '0:18',
        description: 'Onboard and add team contributors to your workspace.',
    },
];

const faqs = [
    { q: 'How do I upload documents to a project?', a: 'Navigate to the project workspace, select the Documents tab, choose a folder, and click Upload.' },
    { q: 'How do I control what clients can see?', a: 'Admin users can toggle visibility on documents and photos using the eye icon.' },
    { q: 'Can I share files with external users?', a: 'Yes, use the Share button on any document or photo to share via WhatsApp, Email, or Copy Link.' },
    { q: 'What is the Snag List?', a: 'A task tracker for issues that need resolution. Each snag has a status, assignee, and comments.' },
];

export default function HelpSupportModal({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState< 'tutorials' | 'faq'>('tutorials');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeVideo, setActiveVideo] = useState<YouTubeVideo | null>(null);

    const handleClose = () => {
        setActiveVideo(null);
        setSearchQuery('');
        onClose();
    };

    const filteredVideos = videos.filter(v =>
        v.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredTutorials = youtubeTutorials.filter(v =>
        v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const filteredFaqs = faqs.filter(f =>
        f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.a.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: colors.surface, padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '80%' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Feather name="help-circle" size={20} color={colors.primary} />
                            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Help & Support</Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={{ padding: 4 }}>
                            <Feather name="x" size={24} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Tabs */}
                    <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderRadius: 10, padding: 4, marginBottom: 16 }}>
                        {[
                            { key: 'tutorials', label: 'Support Videos' },
                            { key: 'faq', label: 'FAQs' }
                        ].map(tab => (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => {
                                    setActiveTab(tab.key as any);
                                    setActiveVideo(null);
                                }}
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

                    {/* Search Input */}
                    <View style={{ marginBottom: 16 }}>
                        <View style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            backgroundColor: colors.background, 
                            borderRadius: 10, 
                            paddingHorizontal: 12, 
                            borderWidth: 1, 
                            borderColor: colors.border,
                            height: 44 
                        }}>
                            <Feather name="search" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                            <TextInput
                                placeholder={`Search ${activeTab === 'tutorials' ? 'tutorials' : 'FAQs'}...`}
                                placeholderTextColor={colors.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                style={{ 
                                    flex: 1, 
                                    color: colors.text, 
                                    fontSize: 14,
                                    padding: 0
                                }}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                                    <Feather name="x" size={16} color={colors.textMuted} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Active Inline Player */}
                    {activeTab === 'tutorials' && activeVideo && (
                        <View style={{ backgroundColor: colors.background, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 8, marginBottom: 16 }}>
                            <View style={{ width: '100%', aspectRatio: 16/9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
                                <WebView
                                    originWhitelist={['*']}
                                    source={{
                                        html: `
                                            <!DOCTYPE html>
                                            <html>
                                            <head>
                                                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                                                <style>
                                                    body, html {
                                                        margin: 0;
                                                        padding: 0;
                                                        width: 100%;
                                                        height: 100%;
                                                        background-color: #000;
                                                        overflow: hidden;
                                                    }
                                                    iframe {
                                                        border: none;
                                                        width: 100%;
                                                        height: 100%;
                                                    }
                                                </style>
                                            </head>
                                            <body>
                                                <iframe 
                                                    src="https://www.youtube-nocookie.com/embed/${activeVideo.id}?autoplay=1&modestbranding=1&rel=0&playsinline=1&enablejsapi=1" 
                                                    title="YouTube Video" 
                                                    frameborder="0" 
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                                    allowfullscreen>
                                                </iframe>
                                            </body>
                                            </html>
                                        `,
                                        baseUrl: 'https://lonelypress.github.io/react-native-youtube-iframe/'
                                    }}
                                    userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15"
                                    style={{ flex: 1 }}
                                    allowsFullscreenVideo
                                    javaScriptEnabled
                                    domStorageEnabled
                                    allowsInlineMediaPlayback={true}
                                    mediaPlaybackRequiresUserAction={false}
                                />
                            </View>
                            <View style={{ padding: 10 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{activeVideo.title}</Text>
                                        {activeVideo.description && (
                                            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>{activeVideo.description}</Text>
                                        )}
                                    </View>
                                    <TouchableOpacity onPress={() => setActiveVideo(null)} style={{ padding: 4 }}>
                                        <Feather name="x" size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                                    <TouchableOpacity 
                                        onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${activeVideo.id}`)}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ef4444', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}
                                    >
                                        <Feather name="youtube" size={16} color="#fff" />
                                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>Open in YouTube</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => setActiveVideo(null)}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.border, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}
                                    >
                                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>Close Player</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
                        {/* {activeTab === 'videos' && (
                            filteredVideos.length > 0 ? (
                                filteredVideos.map((v, i) => (
                                    <TouchableOpacity key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                                        <Feather name="play-circle" size={28} color={colors.primary} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 }}>{v.title}</Text>
                                            <Text style={{ fontSize: 12, color: colors.textMuted }}>{v.duration}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 24 }}>No support videos found</Text>
                            )
                        )} */}

                        {activeTab === 'tutorials' && (
                            filteredTutorials.length > 0 ? (
                                filteredTutorials.map((v, i) => (
                                    <TouchableOpacity 
                                        key={i} 
                                        onPress={() => setActiveVideo(v)}
                                        style={{ 
                                            flexDirection: 'row', 
                                            gap: 12, 
                                            padding: 12, 
                                            backgroundColor: colors.background, 
                                            borderRadius: 12, 
                                            borderWidth: 1, 
                                            borderColor: colors.border 
                                        }}
                                    >
                                        {/* Video Thumbnail */}
                                        <View style={{ width: 100, height: 62, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000', position: 'relative' }}>
                                            <Image 
                                                source={{ uri: `https://img.youtube.com/vi/${v.id}/mqdefault.jpg` }} 
                                                style={{ width: '100%', height: '100%', resizeMode: 'cover' }} 
                                            />
                                            {/* Play Button Overlay */}
                                            <View style={{ 
                                                position: 'absolute', 
                                                top: 0, 
                                                left: 0, 
                                                right: 0, 
                                                bottom: 0, 
                                                justifyContent: 'center', 
                                                alignItems: 'center', 
                                                backgroundColor: 'rgba(0,0,0,0.2)' 
                                            }}>
                                                <Feather name="play" size={18} color="#fff" style={{ opacity: 0.9 }} />
                                            </View>
                                            {/* Duration Badge */}
                                            <View style={{ 
                                                position: 'absolute', 
                                                bottom: 2, 
                                                right: 2, 
                                                backgroundColor: 'rgba(0,0,0,0.75)', 
                                                paddingHorizontal: 4, 
                                                paddingVertical: 1, 
                                                borderRadius: 3 
                                            }}>
                                                <Text style={{ fontSize: 9, color: '#fff', fontWeight: '600' }}>{v.duration}</Text>
                                            </View>
                                        </View>

                                        {/* Video Details */}
                                        <View style={{ flex: 1, justifyContent: 'center' }}>
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 4 }} numberOfLines={1}>
                                                {v.title}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 6 }} numberOfLines={1}>
                                                {v.description || 'Watch tutorial on YouTube'}
                                            </Text>
                                            
                                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                                <TouchableOpacity 
                                                    onPress={() => setActiveVideo(v)}
                                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                                >
                                                    <Feather name="play-circle" size={12} color={colors.primary} />
                                                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>Play Here</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${v.id}`)}
                                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                                >
                                                    <Feather name="external-link" size={12} color={colors.textMuted} />
                                                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>Watch on YouTube</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 24 }}>No YouTube tutorials found</Text>
                            )
                        )}

                        {activeTab === 'faq' && (
                            filteredFaqs.length > 0 ? (
                                filteredFaqs.map((f, i) => (
                                    <View key={i} style={{ padding: 16, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, lineHeight: 20 }}>{f.q}</Text>
                                        <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 20 }}>{f.a}</Text>
                                    </View>
                                ))
                            ) : (
                                <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 24 }}>No FAQs found</Text>
                            )
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
