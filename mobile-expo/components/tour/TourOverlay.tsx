import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Platform, Modal } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { useTheme } from '@/contexts/ThemeContext';
import { useTour } from '@/contexts/TourContext';
import { Feather } from '@expo/vector-icons';
import Svg, { Defs, Mask, Rect, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedProps, withTiming, useAnimatedStyle, interpolate } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Define steps and their descriptions
export const TOUR_STEPS = [
    {
        id: 1,
        title: 'Project Dashboard',
        description: 'See all your active construction projects and their progress at a glance.',
        spotlightId: 'dashboardHeader',
        defaultPos: { x: width / 2, y: height * 0.35, r: 100 },
    },
    {
        id: 2,
        title: 'Organization Stats',
        description: 'Track total projects, folders, and documents across your team.',
        spotlightId: 'dashboardStats',
        defaultPos: { x: width / 2, y: height * 0.22, r: 150 },
    },
    {
        id: 3,
        title: 'Your Projects',
        description: 'See all your construction projects here. Tap any project to view details, snag lists, and docs.',
        spotlightId: 'projectCard',
        defaultPos: { x: width * 0.15, y: height * 0.55, r: 60 },
    },
    {
        id: 4,
        title: 'Create Project',
        description: 'Need to start a new project? Use this button to set up a new project workspace instantly.',
        spotlightId: 'createProjectButton',
        defaultPos: { x: width * 0.62, y: height * 0.55, r: 45 },
    },
    {
        id: 5,
        title: 'Activity Feed',
        description: 'Monitor real-time updates of all project activities and modifications.',
        spotlightId: 'activityTab',
        defaultPos: { x: width * 0.28, y: height - 60, r: 40 },
    },
    {
        id: 6,
        title: 'Notifications',
        description: 'Stay updated with important alerts and team mentions.',
        spotlightId: 'notificationsIcon',
        defaultPos: { x: width - 75, y: 45, r: 35 },
    },
    {
        id: 7,
        title: 'Team Chat',
        description: 'Instant collaboration with room members and easy file sharing.',
        spotlightId: 'chatTab',
        defaultPos: { x: width * 0.68, y: height - 60, r: 40 },
    },
    {
        id: 8,
        title: 'Settings',
        description: 'Manage your profile, theme, and application preferences.',
        spotlightId: 'settingsTab',
        defaultPos: { x: width * 0.88, y: height - 60, r: 40 },
    },
];

export default function TourOverlay() {
    const { colors } = useTheme();
    const router = useRouter();
    const { isTourActive, currentStep, nextStep, stopTour, spotlights } = useTour();

    const step = useMemo(() => TOUR_STEPS.find(s => s.id === currentStep), [currentStep]);

    const spotX = useSharedValue(width / 2);
    const spotY = useSharedValue(height / 2);
    const spotR = useSharedValue(0);
    const opacity = useSharedValue(0);

    const pos = useMemo(() => {
        if (!step) return { x: width / 2, y: height / 2, r: 0 };
        return spotlights[step.spotlightId] || step.defaultPos;
    }, [step, spotlights]);

    useEffect(() => {
        if (isTourActive && step) {
            spotX.value = withTiming(pos.x, { duration: 400 });
            spotY.value = withTiming(pos.y, { duration: 400 });
            spotR.value = withTiming(pos.r, { duration: 400 });
            opacity.value = withTiming(1, { duration: 400 });
        } else {
            opacity.value = withTiming(0, { duration: 300 });
        }
    }, [pos, isTourActive, step]);

    const animatedCircleProps = useAnimatedProps(() => ({
        cx: spotX.value,
        cy: spotY.value,
        r: spotR.value,
    }));

    const tooltipStyle = useAnimatedStyle(() => {
        const isBottom = spotY.value > height / 2;
        return {
            top: isBottom ? spotY.value - spotR.value - 180 : spotY.value + spotR.value + 20,
            opacity: opacity.value,
            transform: [{ translateY: interpolate(opacity.value, [0, 1], [20, 0]) }]
        };
    });

    const handleNext = () => {
        if (currentStep === 4) router.push('/activity');
        if (currentStep === 5) router.push('/notifications');
        if (currentStep === 6) router.push('/chat');
        if (currentStep === 7) router.push('/settings');
        
        if (currentStep === TOUR_STEPS.length) {
            stopTour();
        } else {
            nextStep();
        }
    };

    if (!isTourActive || !step) return null;

    return (
        <Modal transparent visible={isTourActive} animationType="none">
            <View style={styles.container}>
                <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
                    <Defs>
                        <Mask id="mask" x="0" y="0" height="100%" width="100%">
                            <Rect height="100%" width="100%" fill="#fff" />
                            <AnimatedCircle fill="#000" animatedProps={animatedCircleProps} />
                        </Mask>
                    </Defs>
                    <Rect
                        height="100%"
                        width="100%"
                        fill="rgba(0,0,0,0.85)"
                        mask="url(#mask)"
                    />
                </Svg>

                <Animated.View style={[styles.tooltip, tooltipStyle, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.title, { color: colors.text }]}>{step.title}</Text>
                    <Text style={[styles.description, { color: colors.textMuted }]}>{step.description}</Text>
                    
                    <View style={styles.footer}>
                        <TouchableOpacity onPress={stopTour} style={styles.skipButton}>
                            <Text style={{ color: colors.textMuted }}>Exit Tour</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleNext}
                            style={[styles.nextButton, { backgroundColor: colors.primary }]}
                        >
                            <Text style={styles.nextButtonText}>
                                {currentStep === TOUR_STEPS.length ? 'Finish' : 'Next'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    tooltip: {
        position: 'absolute',
        left: 20,
        right: 20,
        padding: 24,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    description: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 20,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    skipButton: {
        padding: 10,
    },
    nextButton: {
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    nextButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
