import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Image, Modal, TextInput, Linking, Platform, StatusBar, ScrollView, ActivityIndicator, SafeAreaView, Dimensions } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useSocket } from '@/contexts/SocketContext';
import { useTour } from '@/contexts/TourContext';
import HelpSupportModal from './HelpSupportModal';
import FeedbackModal from './FeedbackModal';
import LanguageSelectorModal from './LanguageSelectorModal';
import { globalSearch } from '@/services/searchService';

interface MainHeaderProps {
    showBack?: boolean;
    onSearchChange?: (query: string) => void;
    searchPlaceholder?: string;
}

const { height: SCREEN_H } = Dimensions.get('window');

export default function MainHeader({ showBack, onSearchChange, searchPlaceholder = "Search..." }: MainHeaderProps) {
    const { isDark, colors, toggleTheme } = useTheme();
    const router = useRouter();
    const { unreadNotificationCount } = useSocket();
    const { isTourActive, registerSpotlight } = useTour();

    const [isSearchActive, setIsSearchActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [showLanguage, setShowLanguage] = useState(false);
    const [results, setResults] = useState<any>(null);
    const [loadingResults, setLoadingResults] = useState(false);

    const bellRef = useRef<View>(null);

    useEffect(() => {
        if (isTourActive) {
            setTimeout(() => {
                bellRef.current?.measureInWindow((x, y, w, h) => {
                    if (w > 0) {
                        const androidStatusBarOffset = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;
                        registerSpotlight('notificationsIcon', { 
                            x: x + w / 2, 
                            y: y + h / 2 + androidStatusBarOffset, 
                            r: 28 
                        });
                    }
                });
            }, 1000);
        }
    }, [isTourActive, registerSpotlight]);

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        if (onSearchChange) onSearchChange(text);
    };

    const handleCloseSearch = () => {
        setIsSearchActive(false);
        setSearchQuery('');
        setResults(null);
        if (onSearchChange) onSearchChange('');
    };

    useEffect(() => {
        if (!isSearchActive || searchQuery.length < 2) {
            setResults(null);
            return;
        }

        const timer = setTimeout(async () => {
            setLoadingResults(true);
            try {
                const data = await globalSearch(searchQuery);
                setResults(data);
            } catch (err) {
                console.error("Global search failed", err);
            } finally {
                setLoadingResults(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [searchQuery, isSearchActive]);

    const handleResultPress = (item: any, type: string) => {
        setIsSearchActive(false);
        setSearchQuery('');
        setResults(null);
        if (onSearchChange) onSearchChange('');

        const projectId = item.project_id || item.id;
        const params: any = { id: String(projectId) };

        switch (type) {
            case 'project':
                router.push({ pathname: "/(tabs)/project/[id]", params: { id: String(item.id) } });
                break;
            case 'folder':
                params.tab = item.folder_type === 'photo' ? 'photos' : 'documents';
                params.folderId = String(item.id);
                router.push({ pathname: "/(tabs)/project/[id]", params });
                break;
            case 'doc':
                params.tab = 'documents';
                params.folderId = item.folder_id ? String(item.folder_id) : '';
                params.fileId = String(item.id);
                router.push({ pathname: "/(tabs)/project/[id]", params });
                break;
            case 'photo':
                params.tab = 'photos';
                params.folderId = item.folder_id ? String(item.folder_id) : '';
                params.photoId = String(item.id);
                router.push({ pathname: "/(tabs)/project/[id]", params });
                break;
            case 'snag':
                params.tab = 'snags';
                params.snagId = String(item.id);
                router.push({ pathname: "/(tabs)/project/[id]", params });
                break;
            case 'rfi':
                params.tab = 'rfi';
                params.rfiId = String(item.id);
                router.push({ pathname: "/(tabs)/project/[id]", params });
                break;
        }
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
                        <Text className="font-angelica" style={{ fontSize: 18, color: colors.primary, fontFamily: 'Angelica', fontWeight: 'normal' }}>
                            APEXIS
                            <Text className="font-angelica" style={{ fontSize: 10, fontFamily: 'Angelica', fontWeight: 'normal' }}>PRO™</Text>
                        </Text>
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
                        ref={bellRef}
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

            <Modal
                visible={isSearchActive}
                animationType="fade"
                transparent={true}
                onRequestClose={handleCloseSearch}
            >
                <TouchableOpacity 
                    activeOpacity={1} 
                    onPress={handleCloseSearch}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight }}
                >
                    <SafeAreaView style={{ flex: 1 }}>
                        <TouchableOpacity 
                            activeOpacity={1} 
                            style={{
                                backgroundColor: colors.surface,
                                marginHorizontal: 12,
                                marginTop: 8,
                                borderRadius: 16,
                                overflow: 'hidden',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.15,
                                shadowRadius: 12,
                                elevation: 8,
                            }}
                        >
                            <View style={{
                                paddingHorizontal: 12,
                                paddingVertical: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 12,
                                borderBottomWidth: results ? 1 : 0,
                                borderBottomColor: colors.border,
                            }}>
                                <View style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                    borderRadius: 12,
                                    paddingHorizontal: 12,
                                    height: 44,
                                    borderWidth: 1,
                                    borderColor: isDark ? '#334155' : '#e2e8f0',
                                }}>
                                    <Ionicons name="search" size={20} color={colors.primary} />
                                    <TextInput
                                        autoFocus
                                        value={searchQuery}
                                        onChangeText={handleSearchChange}
                                        placeholder={searchPlaceholder}
                                        placeholderTextColor={colors.textMuted}
                                        style={{ flex: 1, color: colors.text, marginLeft: 10, fontSize: 16, paddingVertical: 8 }}
                                        returnKeyType="search"
                                    />
                                    {loadingResults ? (
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    ) : searchQuery.length > 0 && (
                                        <TouchableOpacity onPress={() => handleSearchChange('')} style={{ padding: 4 }}>
                                            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <TouchableOpacity onPress={handleCloseSearch} style={{ paddingLeft: 4 }}>
                                    <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 15 }}>Cancel</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Results list inside Floating Card */}
                            {results && (
                                <ScrollView 
                                    style={{ 
                                        maxHeight: SCREEN_H * 0.6,
                                        backgroundColor: colors.surface,
                                    }}
                                    contentContainerStyle={{ paddingBottom: 20 }}
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={false}
                                >
                                    {/* Projects */}
                                    {results.projects?.length > 0 && (
                                        <View style={{ padding: 12 }}>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textMuted, marginBottom: 8, letterSpacing: 1 }}>PROJECTS</Text>
                                            {results.projects.map((p: any) => (
                                                <TouchableOpacity key={p.id} onPress={() => handleResultPress(p, 'project')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Feather name="briefcase" size={16} color={colors.primary} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{p.name}</Text>
                                                        <Text style={{ fontSize: 11, color: colors.textMuted }}>{p.description || 'Active Project'}</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {/* Folders */}
                                    {results.folders?.length > 0 && (
                                        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.border + '50' }}>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textMuted, marginBottom: 8, letterSpacing: 1 }}>FOLDERS</Text>
                                            {results.folders.map((f: any) => (
                                                <TouchableOpacity key={f.id} onPress={() => handleResultPress(f, 'folder')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + '10', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Feather name="folder" size={16} color={colors.primary} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{f.name}</Text>
                                                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                                            {f.project?.name ? `In: ${f.project.name}` : 'Folder'} • {f.folder_type === 'photo' ? 'Photos' : 'Docs'}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {/* Docs */}
                                    {results.docs?.length > 0 && (
                                        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.border + '50' }}>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textMuted, marginBottom: 8, letterSpacing: 1 }}>DOCUMENTS</Text>
                                            {results.docs.map((d: any) => (
                                                <TouchableOpacity key={d.id} onPress={() => handleResultPress(d, 'doc')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#3b82f615', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Feather name="file-text" size={16} color="#3b82f6" />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{d.file_name}</Text>
                                                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                                            {d.project?.name ? `In: ${d.project.name}` : 'Document'}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {/* Photos */}
                                    {results.photos?.length > 0 && (
                                        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.border + '50' }}>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textMuted, marginBottom: 8, letterSpacing: 1 }}>PHOTOS</Text>
                                            {results.photos.map((p: any) => (
                                                <TouchableOpacity key={p.id} onPress={() => handleResultPress(p, 'photo')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#10b98115', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Feather name="camera" size={16} color="#10b981" />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{p.file_name}</Text>
                                                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                                            {p.project?.name ? `In: ${p.project.name}` : 'Photo'}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {/* Snags */}
                                    {results.snags?.length > 0 && (
                                        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.border + '50' }}>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textMuted, marginBottom: 8, letterSpacing: 1 }}>SNAGS</Text>
                                            {results.snags.map((s: any) => (
                                                <TouchableOpacity key={s.id} onPress={() => handleResultPress(s, 'snag')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#ef444415', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Feather name="alert-triangle" size={16} color="#ef4444" />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{s.title}</Text>
                                                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                                            {s.project?.name ? `In: ${s.project.name}` : 'Snag Item'}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {/* RFI */}
                                    {results.rfis?.length > 0 && (
                                        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.border + '50' }}>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textMuted, marginBottom: 8, letterSpacing: 1 }}>RFI</Text>
                                            {results.rfis.map((r: any) => (
                                                <TouchableOpacity key={r.id} onPress={() => handleResultPress(r, 'rfi')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#f59e0b15', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Feather name="help-circle" size={16} color="#f59e0b" />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{r.title}</Text>
                                                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                                            {r.project?.name ? `In: ${r.project.name}` : 'Request for Info'}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {searchQuery.length >= 2 && !loadingResults && 
                                    Object.values(results).every((arr: any) => !arr?.length) && (
                                        <View style={{ padding: 40, alignItems: 'center' }}>
                                            <Feather name="info" size={24} color={colors.textMuted} />
                                            <Text style={{ marginTop: 12, color: colors.textMuted }}>No results found for "{searchQuery}"</Text>
                                        </View>
                                    )}
                                </ScrollView>
                            )}
                        </TouchableOpacity>
                    </SafeAreaView>
                </TouchableOpacity>
            </Modal>

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
                            // onPress={() => { setShowMoreMenu(false); setShowFeedback(true); }}
                            onPress={() => Linking.openURL('mailto:support@apexis.in')}
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
