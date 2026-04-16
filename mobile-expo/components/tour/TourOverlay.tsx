import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Platform, Modal } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { useTheme } from '@/contexts/ThemeContext';
import { useTour } from '@/contexts/TourContext';
import { Feather } from '@expo/vector-icons';
import Svg, { Defs, Mask, Rect, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedProps, withTiming, useAnimatedStyle, interpolate } from 'react-native-reanimated';

const { width, height } = Dimensions.get('screen');
const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface TourStep {
    id: number;
    title: string;
    description: string;
    spotlightId: string;
    shape?: 'circle' | 'rect';
    tooltipShiftY?: number;
    defaultPos: {
        x: number;
        y: number;
        r: number;
        w?: number;
        h?: number;
    };
}

// Define steps and their descriptions
export const TOUR_STEPS: TourStep[] = [
    {
        id: 1,
        title: 'Project Dashboard',
        description: 'Your central hub for project activity. View your profile overview and track total projects, folders, and documents at a glance.',
        spotlightId: 'dashboardHeader',
        shape: 'rect',
        defaultPos: { x: width / 2, y: 70, w: width - 40, h: 100, r: 16 },
    },
    {
        id: 2,
        title: 'Your Projects',
        description: 'See all your construction projects here. Tap any project to view details, snag lists, and docs.',
        spotlightId: 'projectCard',
        shape: 'rect',
        tooltipShiftY: -20,
        defaultPos: { x: width * 0.08, y: height * 0.55, w: 10, h: 10, r: 10 },
    },
    {
        id: 3,
        title: 'Create Project',
        description: 'Need to start a new project? Use this button to set up a new project workspace instantly.',
        spotlightId: 'createProjectButton',
        shape: 'circle',
        tooltipShiftY: -20,
        defaultPos: { x: width * 0.62, y: height * 0.55, r: 45 },
    },
    {
        id: 4,
        title: 'Activity Feed',
        description: 'Monitor real-time updates of all project activities and modifications.',
        spotlightId: 'activityTab',
        shape: 'circle',
        defaultPos: { x: width * 0.28, y: height - 60, r: 40 },
    },
    {
        id: 5,
        title: 'Notifications',
        description: 'Stay updated with important alerts and team mentions.',
        spotlightId: 'notificationsIcon',
        shape: 'circle',
        defaultPos: { x: width - 62, y: 40, r: 28 },
    },
    {
        id: 6,
        title: 'Team Chat',
        description: 'Instant collaboration with room members and easy file sharing.',
        spotlightId: 'chatTab',
        shape: 'circle',
        defaultPos: { x: width * 0.68, y: height - 60, r: 40 },
    },
    {
        id: 7,
        title: 'Settings',
        description: 'Manage your profile, theme, and application preferences.',
        spotlightId: 'settingsTab',
        shape: 'circle',
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
    const spotW = useSharedValue(0);
    const spotH = useSharedValue(0);
    const spotR = useSharedValue(0);
    const opacity = useSharedValue(0);

    const pos = useMemo(() => {
        if (!step) return { x: width / 2, y: height / 2, r: 0 };
        return spotlights[step.spotlightId] || step.defaultPos;
    }, [step, spotlights]);

    useEffect(() => {
        if (isTourActive && step) {
            const isRect = step.shape === 'rect' || (pos.w && pos.h);
            const targetW = isRect ? (pos.w || 200) : (pos.r * 2);
            const targetH = isRect ? (pos.h || 100) : (pos.r * 2);
            const targetR = isRect ? (pos.r || 12) : pos.r;

            spotX.value = withTiming(pos.x, { duration: 400 });
            spotY.value = withTiming(pos.y, { duration: 400 });
            spotW.value = withTiming(targetW, { duration: 400 });
            spotH.value = withTiming(targetH, { duration: 400 });
            spotR.value = withTiming(targetR, { duration: 400 });
            opacity.value = withTiming(1, { duration: 400 });
        } else {
            opacity.value = withTiming(0, { duration: 300 });
        }
    }, [pos, isTourActive, step]);

    const animatedRectProps = useAnimatedProps(() => ({
        x: spotX.value - spotW.value / 2,
        y: spotY.value - spotH.value / 2,
        width: spotW.value,
        height: spotH.value,
        rx: spotR.value,
    }));

    const tooltipStyle = useAnimatedStyle(() => {
        const isBottom = spotY.value > height / 2;
        const offset = spotH.value / 2 + 20;
        const extraShift = step?.tooltipShiftY || 0;
        return {
            top: isBottom ? spotY.value - offset - 180 + extraShift : spotY.value + offset + extraShift,
            opacity: opacity.value,
            transform: [{ translateY: interpolate(opacity.value, [0, 1], [20, 0]) }]
        };
    });

    const handleNext = async () => {
        if (currentStep === 3) router.push('/activity');
        if (currentStep === 4) router.push('/(tabs)');
        if (currentStep === 5) router.push('/chat');
        if (currentStep === 6) router.push('/settings');

        if (currentStep === TOUR_STEPS.length) {
            await stopTour();
            router.replace('/(tabs)');
        } else {
            nextStep();
        }
    };

    const handleExit = async () => {
        await stopTour();
        router.replace('/(tabs)');
    };

    if (!isTourActive || !step) return null;

    return (
        <Modal transparent visible={isTourActive} animationType="none" statusBarTranslucent={true}>
            <View style={styles.container}>
                <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
                    <Defs>
                        <Mask id="mask" x="0" y="0" height="100%" width="100%">
                            <Rect height="100%" width="100%" fill="#fff" />
                            <AnimatedRect fill="#000" animatedProps={animatedRectProps} />
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
                        <TouchableOpacity onPress={handleExit} style={styles.skipButton}>
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
        width,
        height,
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
