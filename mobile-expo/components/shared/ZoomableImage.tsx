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
}

export default function ZoomableImage({ uri, width = SCREEN_W, height = SCREEN_H, onZoomStateChange, onTap }: Props) {
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const [isZoomed, setIsZoomed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [hasError, setHasError] = useState(false);

    // Reset state when URI changes
    useEffect(() => {
        setHasError(false);
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
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    // Combine gestures using deeply nested Simultaneous approach
    const innerGestures = Gesture.Simultaneous(pinch, pan);
    const taps = Gesture.Exclusive(doubleTap, singleTap);
    const all = Gesture.Simultaneous(taps, innerGestures);

    return (
        <GestureDetector gesture={all}>
            <Animated.View style={[{ width, height, justifyContent: 'center', alignItems: 'center' }, animatedStyle]} collapsable={false}>
                <Image 
                    key={uri}
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
