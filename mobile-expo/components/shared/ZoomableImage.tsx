import React, { useState, useEffect } from 'react';
import { Dimensions, ActivityIndicator, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
    uri: string;
    width?: number;
    height?: number;
    onZoomStateChange?: (isZoomed: boolean) => void;
    onTap?: () => void;
    onDismiss?: () => void;
}

export default function ZoomableImage({ uri, width = SCREEN_W, height = SCREEN_H, onZoomStateChange, onTap, onDismiss }: Props) {
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const dismissY = useSharedValue(0);
    const dismissScale = useSharedValue(1);

    const [isZoomed, setIsZoomed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [hasError, setHasError] = useState(false);

    // Reset state when URI changes
    useEffect(() => {
        setHasError(false);
        dismissY.value = 0;
        dismissScale.value = 1;
        // Only show loader if we think it might take a moment.
        // We'll let onLoadStart trigger it for real network loads.
        const timer = setTimeout(() => {
            setLoading(false); // Safety timeout
        }, 8000);

        return () => clearTimeout(timer);
    }, [uri]);

    const notifyZoom = (active: boolean) => {
        setIsZoomed(active);
        if (onZoomStateChange) onZoomStateChange(active);
    };

    const pinch = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = Math.max(1, savedScale.value * e.scale);
            if (scale.value > 1.05 && !isZoomed) {
                runOnJS(notifyZoom)(true);
            } else if (scale.value <= 1.05 && isZoomed) {
                runOnJS(notifyZoom)(false);
            }
        })
        .onEnd(() => {
            if (scale.value < 1.05) {
                scale.value = withTiming(1);
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                savedScale.value = 1;
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
                runOnJS(notifyZoom)(false);
            } else {
                savedScale.value = scale.value;
            }
        });

    const pan = Gesture.Pan()
        .enabled(isZoomed)
        .maxPointers(1)
        .onUpdate((e) => {
            if (savedScale.value > 1) {
                translateX.value = savedTranslateX.value + e.translationX;
                translateY.value = savedTranslateY.value + e.translationY;
            }
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    const dismissPan = Gesture.Pan()
        .enabled(!isZoomed && !!onDismiss)
        .maxPointers(1)
        .activeOffsetY(25) // Increase threshold to give horizontal paging a "head start"
        .onUpdate((e) => {
            if (e.translationY > 0) {
                dismissY.value = e.translationY;
                dismissScale.value = Math.max(0.8, 1 - (e.translationY / 800));
            }
        })
        .onEnd((e) => {
            if (e.translationY > 150 || e.velocityY > 800) {
                if (onDismiss) runOnJS(onDismiss)();
            } else {
                dismissY.value = withTiming(0);
                dismissScale.value = withTiming(1);
            }
        });

    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            if (scale.value > 1) {
                scale.value = withTiming(1);
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                savedScale.value = 1;
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
                runOnJS(notifyZoom)(false);
            } else {
                scale.value = withTiming(2.5);
                savedScale.value = 2.5;
                runOnJS(notifyZoom)(true);
            }
        });

    const singleTap = Gesture.Tap()
        .numberOfTaps(1)
        .maxDistance(12)
        .onEnd(() => {
            if (onTap) runOnJS(onTap)();
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value + dismissY.value },
            { scale: scale.value * dismissScale.value },
        ],
    }));

    // Combine gestures using a more robust composition
    const innerGestures = Gesture.Simultaneous(pinch, pan);
    const taps = Gesture.Exclusive(doubleTap, singleTap);

    // We Race the dismissal against the inner gestures (scale/pan).
    // This prevents them from fighting for control.
    const gestures = Gesture.Race(innerGestures, dismissPan);

    const all = Gesture.Simultaneous(taps, gestures);

    return (
        <GestureDetector gesture={all}>
            <Animated.View
                renderToHardwareTextureAndroid={true}
                style={[{ width, height, justifyContent: 'center', alignItems: 'center' }, animatedStyle]}
                collapsable={false}
            >
                <Image
                    source={uri}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="contain"
                    onLoadStart={() => {
                        // Use a flag to avoid flashing loader for cached images
                        setLoading(true);
                    }}
                    onLoad={() => {
                        setLoading(false);
                        setHasError(false);
                    }}
                    onError={() => {
                        setLoading(false);
                        setHasError(true);
                    }}
                    // standard fallback
                    transition={200}
                />

                {loading && (
                    <View style={{ position: 'absolute', zIndex: 10, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator color="#fff" size="large" />
                    </View>
                )}

                {hasError && !loading && (
                    <View style={{ position: 'absolute', justifyContent: 'center', alignItems: 'center' }}>
                        <Feather name="image" size={48} color="rgba(255,255,255,0.3)" />
                        <View style={{ marginTop: 12, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 }}>
                            <ActivityIndicator size="small" color="#fff" />
                        </View>
                    </View>
                )}
            </Animated.View>
        </GestureDetector>
    );
}

