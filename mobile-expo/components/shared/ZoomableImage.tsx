import React, { useState } from 'react';
import { Dimensions, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
    uri: string;
    width?: number;
    height?: number;
    onZoomStateChange?: (isZoomed: boolean) => void;
}

export default function ZoomableImage({ uri, width = SCREEN_W, height = SCREEN_H, onZoomStateChange }: Props) {
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const [isZoomed, setIsZoomed] = useState(false);

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

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    // Combine gestures using deeply nested Simultaneous approach
    const innerGestures = Gesture.Simultaneous(pinch, pan);
    const all = Gesture.Simultaneous(doubleTap, innerGestures);

    return (
        <GestureDetector gesture={all}>
            <Animated.View style={[{ width, height, justifyContent: 'center', alignItems: 'center' }, animatedStyle]} collapsable={false}>
                <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            </Animated.View>
        </GestureDetector>
    );
}
