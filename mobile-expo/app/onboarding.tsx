import React, { useState, useRef } from 'react';
import { View, FlatList, TouchableOpacity, Dimensions, StyleSheet, Platform } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '0',
        title: 'COMPANY_BRANDING', // Internal flag for custom rendering
        subtitle: 'RECORD · REPORT · RELEASE',
        description: '',
        icon: 'app-icon',
        color: '#f97316',
    },
    {
        id: '1',
        title: 'Structured Reporting',
        subtitle: 'Communication Infrastructure',
        description: 'Transform informal site communication into structured, professional project documentation.',
        icon: 'layers',
        color: '#0ea5e9', // Sky Blue
    },
    {
        id: '2',
        title: 'Unified Content',
        subtitle: 'Everything in one place',
        description: 'Organize photos, documents, and site reports across all your projects effortlessly.',
        icon: 'folder-plus',
        color: '#10b981', // Green
    },
    {
        id: '3',
        title: 'Field Collaboration',
        subtitle: 'Real-time synchronization',
        description: 'Keep your team synced with instant chat and real-time project activity logs.',
        icon: 'message-circle',
        color: '#6366f1', // Indigo
    },
];

export default function OnboardingScreen() {
    const { colors, isDark } = useTheme();
    const router = useRouter();
    const { code, role } = useLocalSearchParams<{ code?: string; role?: string }>();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    const handleNext = async () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            await AsyncStorage.setItem('hasSeenOnboarding', 'true');
            router.replace({
                pathname: '/(auth)/login',
                params: code ? { code, role } : {}
            });
        }
    };

    const handleSkip = async () => {
        await AsyncStorage.setItem('hasSeenOnboarding', 'true');
        router.replace({
            pathname: '/(auth)/login',
            params: code ? { code, role } : {}
        });
    };

    const renderItem = ({ item, index }: { item: typeof SLIDES[0], index: number }) => {
        const isActive = index === currentIndex;
        return (
            <View style={[styles.slide, { width }]}>
                {isActive && (
                    <>
                        {item.id === '0' ? (
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <Animated.View entering={FadeInUp.duration(600).delay(100)} style={{ marginBottom: 20 }}>
                                    <View style={[styles.iconContainer, { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0, borderWidth: 0, width: 150, height: 150, marginBottom: 24 }]}>
                                        <Animated.Image 
                                            source={require('../assets/images/app-icon.png')} 
                                            style={{ width: 150, height: 150 }} 
                                            resizeMode="contain" 
                                        />
                                    </View>
                                </Animated.View>

                                <View style={styles.textContainer}>
                                    <Animated.Text
                                        entering={FadeInDown.duration(600).delay(300)}
                                        style={[styles.title, { color: colors.text, fontFamily: 'Angelica' }]}
                                    >
                                        <Text className="font-angelica" style={{ fontSize: 48, color: colors.primary, fontFamily: 'Angelica', fontWeight: 'normal' }}>
                                            APEXIS
                                            <Text className="font-angelica" style={{ fontSize: 24, fontFamily: 'Angelica', fontWeight: 'normal' }}>PRO™</Text>
                                        </Text>
                                    </Animated.Text>
                                    <Animated.Text
                                        entering={FadeInDown.duration(600).delay(400)}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                        style={{ fontSize: 12, color: colors.textMuted, marginTop: 8, letterSpacing: 3, fontWeight: '600', textAlign: 'center' }}
                                    >
                                        {item.subtitle}
                                    </Animated.Text>
                                </View>
                            </View>
                        ) : (
                            <>
                                <Animated.View
                                    entering={FadeInUp.duration(600).delay(100)}
                                    style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.surface, borderColor: `${item.color}30`, borderWidth: 1 }]}
                                >
                                    <View style={[styles.iconBg, { backgroundColor: `${item.color}15` }]}>
                                        <Feather name={item.icon as any} size={70} color={item.color} />
                                    </View>
                                </Animated.View>

                                <View style={styles.textContainer}>
                                    <Animated.Text
                                        entering={FadeInDown.duration(600).delay(300)}
                                        style={[styles.title, { color: colors.text, fontFamily: 'Angelica' }]}
                                    >
                                        {item.title}
                                    </Animated.Text>
                                    <Animated.Text
                                        entering={FadeInDown.duration(600).delay(400)}
                                        style={[styles.subtitle, { color: item.color }]}
                                    >
                                        {item.subtitle}
                                    </Animated.Text>
                                    <Animated.Text
                                        entering={FadeInDown.duration(600).delay(500)}
                                        style={[styles.description, { color: colors.textMuted }]}
                                    >
                                        {item.description}
                                    </Animated.Text>
                                </View>
                            </>
                        )}
                    </>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                    <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 15 }}>Skip</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(index);
                }}
            />

            <View style={styles.footer}>
                <View style={styles.indicatorContainer}>
                    {SLIDES.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.indicator,
                                {
                                    backgroundColor: i === currentIndex ? SLIDES[i].color : colors.border,
                                    width: i === currentIndex ? 28 : 8,
                                },
                            ]}
                        />
                    ))}
                </View>

                <TouchableOpacity
                    onPress={handleNext}
                    activeOpacity={0.8}
                    style={[styles.nextButton, { backgroundColor: colors.primary }]}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.nextButtonText}>
                            {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
                        </Text>
                        <Feather name={currentIndex === SLIDES.length - 1 ? "arrow-right" : "chevron-right"} size={18} color="#fff" style={{ marginLeft: 8 }} />
                    </View>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        height: 60,
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingHorizontal: 20,
    },
    skipButton: {
        padding: 10,
    },
    slide: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
    },
    iconContainer: {
        width: 180,
        height: 180,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 50,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
    },
    iconBg: {
        width: 140,
        height: 140,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    title: {
        fontSize: 42,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 20,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    description: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 20,
    },
    footer: {
        padding: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: Platform.OS === 'ios' ? 10 : 30,
    },
    indicatorContainer: {
        flexDirection: 'row',
        gap: 6,
    },
    indicator: {
        height: 8,
        borderRadius: 4,
    },
    nextButton: {
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 20,
        shadowColor: '#f97316',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    nextButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 17,
    },
});
