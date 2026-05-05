import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, Animated, PanResponder } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';

export default function VoiceNotePlayer({ uri, isMe, colors }: { uri: string, isMe: boolean, colors: any }) {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [barWidth, setBarWidth] = useState(0);
    const isSeeking = useRef(false);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > 1;
            },
            onPanResponderGrant: (evt) => {
                isSeeking.current = true;
                handleSeek(evt);
            },
            onPanResponderMove: (evt) => {
                if (!duration || barWidth === 0) return;
                const touchX = evt.nativeEvent.locationX;
                const percentage = Math.min(Math.max(touchX / barWidth, 0), 1);
                setPosition(percentage * duration);
            },
            onPanResponderRelease: async (evt) => {
                if (!sound || !duration || barWidth === 0) {
                    isSeeking.current = false;
                    return;
                }
                const touchX = evt.nativeEvent.locationX;
                const percentage = Math.min(Math.max(touchX / barWidth, 0), 1);
                const seekPosition = percentage * duration;
                await sound.setPositionAsync(seekPosition);
                setPosition(seekPosition);
                isSeeking.current = false;
            },
            onPanResponderTerminate: () => {
                isSeeking.current = false;
            }
        })
    ).current;

    useEffect(() => {
        let isMounted = true;
        
        async function init() {
            try {
                const { sound: audioSound, status } = await Audio.Sound.createAsync(
                    { uri },
                    { progressUpdateIntervalMillis: 100 },
                    onPlaybackStatusUpdate
                );
                
                if (isMounted) {
                    setSound(audioSound);
                    if (status.isLoaded) {
                        setDuration(status.durationMillis || 0);
                        setIsLoaded(true);
                    }
                } else {
                    audioSound.unloadAsync();
                }
            } catch (error) {
                console.error("Error loading voice note", error);
            }
        }

        init();

        return () => {
            isMounted = false;
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [uri]);

    const onPlaybackStatusUpdate = (status: any) => {
        if (status.isLoaded) {
            if (!isSeeking.current) {
                setPosition(status.positionMillis);
            }
            setDuration(status.durationMillis || 0);
            setIsPlaying(status.isPlaying);
            if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
                if (sound) sound.setPositionAsync(0);
            }
        }
    };

    const togglePlayback = async () => {
        if (!sound) return;
        if (isPlaying) {
            await sound.pauseAsync();
        } else {
            await sound.playAsync();
        }
    };

    const handleSeek = (event: any) => {
        if (!sound || !duration || barWidth === 0) return;
        const touchX = event.nativeEvent.locationX;
        const percentage = Math.min(Math.max(touchX / barWidth, 0), 1);
        const seekPosition = percentage * duration;
        sound.setPositionAsync(seekPosition);
        setPosition(seekPosition);
    };

    const formatTime = (millis: number) => {
        if (!millis || isNaN(millis) || !isFinite(millis)) return '0:00';
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', minWidth: 220, gap: 10, marginVertical: 4 }}>
            <TouchableOpacity onPress={togglePlayback} disabled={!isLoaded}>
                <View style={{
                    width: 32, 
                    height: 32, 
                    borderRadius: 16, 
                    backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : colors.primary + '15',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Feather 
                        name={isPlaying ? "pause" : "play"} 
                        size={16} 
                        color={isMe ? '#fff' : colors.primary} 
                        style={!isPlaying ? { transform: [{ translateX: 1 }] } : {}}
                    />
                </View>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
                <View 
                    onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                    {...panResponder.panHandlers}
                    style={{ 
                        height: 30, 
                        justifyContent: 'center',
                        backgroundColor: 'transparent',
                        zIndex: 10
                    }}
                >
                    <View 
                        pointerEvents="none"
                        style={{ height: 3, backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : colors.border, borderRadius: 1.5, overflow: 'hidden' }}
                    >
                        <View style={{ 
                            height: '100%', 
                            width: `${progressPercentage}%`, 
                            backgroundColor: isMe ? '#fff' : colors.primary 
                        }} />
                    </View>
                    {/* Handle/Thumb */}
                    <View 
                        pointerEvents="none"
                        style={{ 
                            position: 'absolute', 
                            left: `${progressPercentage}%`, 
                            width: 12, 
                            height: 12, 
                            borderRadius: 6, 
                            backgroundColor: isMe ? '#fff' : colors.primary,
                            marginLeft: -6,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.2,
                            shadowRadius: 1.5,
                            elevation: 2
                        }} 
                    />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 }}>
                    <Text style={{ fontSize: 9, fontWeight: '600', color: isMe ? 'rgba(255,255,255,0.6)' : colors.textMuted }}>
                        {formatTime(position)}
                    </Text>
                    <Text style={{ fontSize: 9, fontWeight: '600', color: isMe ? 'rgba(255,255,255,0.6)' : colors.textMuted }}>
                        {formatTime(duration)}
                    </Text>
                </View>
            </View>
        </View>
    );
}
