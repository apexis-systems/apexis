import React, { useState, useEffect, useRef } from 'react';
import {
    Dimensions,
    ActivityIndicator,
    View,
    TouchableWithoutFeedback,
    TouchableOpacity,
    Keyboard,
    StyleSheet,
    Text,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Feather, MaterialIcons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
    uri: string;
    width?: number;
    height?: number;
    isActive?: boolean;
    onZoomStateChange?: (isZoomed: boolean) => void;
    onTap?: () => void;
    onDismiss?: () => void;
    gesturesEnabled?: boolean;
    keyboardOpen?: boolean;
}

const formatTime = (millis: number) => {
    if (!millis || isNaN(millis)) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

export default function ZoomableVideo({
    uri,
    width = SCREEN_W,
    height = SCREEN_H,
    isActive = true,
    onZoomStateChange,
    onTap,
    onDismiss,
    gesturesEnabled = true,
    keyboardOpen = false,
}: Props) {
    const videoRef = useRef<Video>(null);

    const dismissY = useSharedValue(0);
    const dismissScale = useSharedValue(1);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [positionMillis, setPositionMillis] = useState(0);
    const [durationMillis, setDurationMillis] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);

    useEffect(() => {
        setHasError(false);
        setIsLoading(true);
        setIsPlaying(false);
        setPositionMillis(0);
        setDurationMillis(0);
        dismissY.value = 0;
        dismissScale.value = 1;
    }, [uri]);

    useEffect(() => {
        if (!isActive) {
            videoRef.current?.pauseAsync();
            setIsPlaying(false);
        }
    }, [isActive]);

    useEffect(() => {
        return () => {
            videoRef.current?.pauseAsync();
        };
    }, []);

    const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
            if (status.error) {
                setHasError(true);
                setIsLoading(false);
            }
            return;
        }

        setIsLoading(status.isBuffering);
        setIsPlaying(status.isPlaying);
        setPositionMillis(status.positionMillis || 0);
        setDurationMillis(status.durationMillis || 0);

        if (status.didJustFinish) {
            setIsPlaying(false);
            videoRef.current?.setPositionAsync(0);
        }
    };

    const togglePlayPause = async () => {
        if (!videoRef.current) return;
        try {
            if (isPlaying) {
                await videoRef.current.pauseAsync();
            } else {
                await videoRef.current.playAsync();
            }
        } catch (e) {
            console.warn('Error toggling play/pause:', e);
        }
    };

    const toggleMute = async () => {
        if (!videoRef.current) return;
        try {
            const nextMute = !isMuted;
            await videoRef.current.setIsMutedAsync(nextMute);
            setIsMuted(nextMute);
        } catch (e) {
            console.warn('Error toggling mute:', e);
        }
    };

    const trackWidthRef = useRef(0);
    const handleSeek = (evt: any) => {
        if (!durationMillis || trackWidthRef.current <= 0) return;
        const x = evt.nativeEvent.locationX;
        const clamped = Math.max(0, Math.min(1, x / trackWidthRef.current));
        const newPos = clamped * durationMillis;
        setPositionMillis(newPos);
        videoRef.current?.setPositionAsync(newPos);
    };

    const skipBackward = async () => {
        if (!videoRef.current) return;
        const newPos = Math.max(0, positionMillis - 10000);
        setPositionMillis(newPos);
        await videoRef.current.setPositionAsync(newPos);
    };

    const skipForward = async () => {
        if (!videoRef.current) return;
        const newPos = Math.min(durationMillis, positionMillis + 10000);
        setPositionMillis(newPos);
        await videoRef.current.setPositionAsync(newPos);
    };

    const handleSingleTap = () => {
        setShowControls((prev) => !prev);
        if (onTap) {
            onTap();
        }
    };

    const dismissPan = Gesture.Pan()
        .enabled(!!onDismiss && gesturesEnabled)
        .maxPointers(1)
        .activeOffsetY(25)
        .onUpdate((e) => {
            if (e.translationY > 0) {
                dismissY.value = e.translationY;
                dismissScale.value = Math.max(0.8, 1 - e.translationY / 800);
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

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: dismissY.value },
            { scale: dismissScale.value },
        ],
    }));

    const progressRatio = durationMillis > 0 ? positionMillis / durationMillis : 0;

    const content = (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: '#000',
                },
                animatedStyle,
            ]}
            collapsable={false}
        >
            <Video
                ref={videoRef}
                source={{ uri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={false}
                isLooping={false}
                isMuted={isMuted}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                onError={(e) => {
                    console.warn('Video playback error:', e);
                    setHasError(true);
                    setIsLoading(false);
                }}
            />

            {/* Buffering indicator */}
            {isLoading && (
                <View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        zIndex: 15,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <ActivityIndicator color="#fff" size="large" />
                </View>
            )}

            {/* Error state */}
            {hasError && !isLoading && (
                <View
                    style={{
                        position: 'absolute',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 20,
                    }}
                >
                    <Feather name="alert-circle" size={48} color="#ef4444" />
                    <Text style={{ color: '#fff', fontSize: 13, marginTop: 8 }}>
                        Failed to load video
                    </Text>
                </View>
            )}

            {/* Background tap area to toggle controls when controls are hidden */}
            {!showControls && !hasError && (
                <TouchableWithoutFeedback onPress={handleSingleTap}>
                    <View style={StyleSheet.absoluteFillObject} />
                </TouchableWithoutFeedback>
            )}

            {/* In-video Overlay Controls */}
            {showControls && !hasError && (
                <View
                    style={{
                        ...StyleSheet.absoluteFillObject,
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 10,
                    }}
                    pointerEvents="box-none"
                >
                    {/* Backdrop touch area to dismiss/toggle controls when tapping outside buttons */}
                    <TouchableWithoutFeedback onPress={handleSingleTap}>
                        <View
                            style={{
                                ...StyleSheet.absoluteFillObject,
                                backgroundColor: 'rgba(0,0,0,0.25)',
                            }}
                        />
                    </TouchableWithoutFeedback>

                    {/* Big Center Play/Pause Button */}
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={togglePlayPause}
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            backgroundColor: 'rgba(0,0,0,0.65)',
                            borderWidth: 1.5,
                            borderColor: 'rgba(255,255,255,0.4)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 20,
                        }}
                    >
                        <Feather
                            name={isPlaying ? 'pause' : 'play'}
                            size={28}
                            color="#fff"
                            style={!isPlaying ? { marginLeft: 3 } : undefined}
                        />
                    </TouchableOpacity>

                    {/* Top Right Mute Button */}
                    {/* <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={toggleMute}
                        style={{
                            position: 'absolute',
                            top: 74,
                            right: 20,
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 20,
                        }}
                    >
                        <Feather
                            name={isMuted ? 'volume-x' : 'volume-2'}
                            size={20}
                            color="#fff"
                        />
                    </TouchableOpacity> */}

                    {/* Bottom Progress Bar and Controls (Working seekable bar - kept as comment for future use) */}

                    <View
                        style={{
                            position: 'absolute',
                            top: 74,
                            left: 12,
                            right: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            borderRadius: 24,
                            zIndex: 20,
                        }}
                    >
                        {/* 10s Backward Button */}
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={skipBackward}
                            style={{ padding: 4 }}
                        >
                            <MaterialIcons
                                name="replay-10"
                                size={20}
                                color="#fff"
                            />
                        </TouchableOpacity>

                        {/* Play/Pause Button */}
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={togglePlayPause}
                            style={{ padding: 4 }}
                        >
                            <Feather
                                name={isPlaying ? 'pause' : 'play'}
                                size={18}
                                color="#fff"
                            />
                        </TouchableOpacity>

                        {/* 10s Forward Button */}
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={skipForward}
                            style={{ padding: 4 }}
                        >
                            <MaterialIcons
                                name="forward-10"
                                size={20}
                                color="#fff"
                            />
                        </TouchableOpacity>

                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', minWidth: 28 }}>
                            {formatTime(positionMillis)}
                        </Text>


                        <View
                            style={{
                                flex: 1,
                                height: 28,
                                justifyContent: 'center',
                            }}
                            onLayout={(e) => {
                                trackWidthRef.current = e.nativeEvent.layout.width;
                            }}
                            onStartShouldSetResponder={() => true}
                            onMoveShouldSetResponder={() => true}
                            onResponderGrant={handleSeek}
                            onResponderMove={handleSeek}
                        >
                            <View
                                style={{
                                    height: 4,
                                    backgroundColor: 'rgba(255,255,255,0.3)',
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                }}
                            >
                                <View
                                    style={{
                                        height: '100%',
                                        width: `${Math.min(100, Math.max(0, progressRatio * 100))}%`,
                                        backgroundColor: '#f97316',
                                    }}
                                />
                            </View>
                            <View
                                style={{
                                    position: 'absolute',
                                    left: `${Math.min(100, Math.max(0, progressRatio * 100))}%`,
                                    marginLeft: -6,
                                    width: 12,
                                    height: 12,
                                    borderRadius: 6,
                                    backgroundColor: '#fff',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 2,
                                    elevation: 3,
                                }}
                            />
                        </View>


                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, minWidth: 32 }}>
                            {formatTime(durationMillis)}
                        </Text>


                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={toggleMute}
                            style={{ padding: 4 }}
                        >
                            <Feather
                                name={isMuted ? 'volume-x' : 'volume-2'}
                                size={18}
                                color="#fff"
                            />
                        </TouchableOpacity>
                    </View>


                </View>
            )}
        </Animated.View>
    );

    if (keyboardOpen) {
        return (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                {content}
            </TouchableWithoutFeedback>
        );
    }

    if (!gesturesEnabled) {
        return content;
    }

    return (
        <GestureDetector gesture={dismissPan}>
            {content}
        </GestureDetector>
    );
}
