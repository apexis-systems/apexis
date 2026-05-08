import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, PanResponder, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

export default function VoiceNotePlayer({ uri, isMe, colors }: { uri: string, isMe: boolean, colors: any }) {
    const soundRef = useRef<Audio.Sound | null>(null);
    const loadPromiseRef = useRef<Promise<Audio.Sound | null> | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const durationRef = useRef(0);
    const [position, setPosition] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isPreparing, setIsPreparing] = useState(false);
    const barWidthRef = useRef(0);
    const isSeeking = useRef(false);

    const getExtensionFromUri = (value: string) => {
        const cleanUri = value.split('?')[0].toLowerCase();
        const match = cleanUri.match(/\.([a-z0-9]+)$/);
        const ext = match?.[1];
        const supportedExts = new Set(['m4a', 'mp4', 'aac', 'mp3', 'wav', 'caf', 'aif', 'aiff']);
        return ext && supportedExts.has(ext) ? ext : 'm4a';
    };

    const unloadSound = async () => {
        const currentSound = soundRef.current;
        soundRef.current = null;
        loadPromiseRef.current = null;
        setIsLoaded(false);
        setIsPreparing(false);
        setIsPlaying(false);
        setPosition(0);
        setDuration(0);
        durationRef.current = 0;

        if (currentSound) {
            try {
                await currentSound.unloadAsync();
            } catch {
                // Ignore unload failures during teardown or rapid source switches.
            }
        }
    };

    const resolvePlaybackUri = async (sourceUri: string) => {
        const isRemote = /^https?:\/\//i.test(sourceUri);
        if (!isRemote || Platform.OS !== 'ios') {
            return sourceUri;
        }

        const fileExtension = getExtensionFromUri(sourceUri);
        const localUri = `${FileSystem.cacheDirectory}voice-note-${encodeURIComponent(sourceUri)}.${fileExtension}`;

        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (!fileInfo.exists) {
            const result = await FileSystem.downloadAsync(sourceUri, localUri);
            if (result.status !== 200) {
                throw new Error(`Failed to cache audio file. HTTP ${result.status}`);
            }
        }

        return localUri;
    };

    const ensureSoundLoaded = async () => {
        if (soundRef.current && isLoaded) {
            return soundRef.current;
        }

        if (loadPromiseRef.current) {
            return loadPromiseRef.current;
        }

        setIsPreparing(true);

        loadPromiseRef.current = (async () => {
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: false,
                    shouldDuckAndroid: true,
                    playThroughEarpieceAndroid: false,
                });

                const playbackUri = await resolvePlaybackUri(uri);

                const { sound: audioSound, status } = await Audio.Sound.createAsync(
                    { uri: playbackUri },
                    { shouldPlay: false, progressUpdateIntervalMillis: 100 },
                    onPlaybackStatusUpdate
                );

                soundRef.current = audioSound;

                if (status.isLoaded) {
                    const nextDuration = status.durationMillis || 0;
                    setDuration(nextDuration);
                    durationRef.current = nextDuration;
                    setPosition(status.positionMillis || 0);
                    setIsLoaded(true);
                }

                return audioSound;
            } catch (error) {
                await unloadSound();
                console.error("Error loading voice note", error);
                return null;
            } finally {
                setIsPreparing(false);
                loadPromiseRef.current = null;
            }
        })();

        return loadPromiseRef.current;
    };

    const onPlaybackStatusUpdate = (status: any) => {
        if (status.isLoaded) {
            if (!isSeeking.current) {
                setPosition(status.positionMillis);
            }
            if (status.durationMillis) {
                setDuration(status.durationMillis);
                durationRef.current = status.durationMillis;
            }
            setIsPlaying(status.isPlaying);
            
            if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
                if (soundRef.current) {
                    soundRef.current.setPositionAsync(0);
                }
            }
        } else if ('error' in status && status.error) {
            console.error("Error loading voice note", status.error);
            setIsLoaded(false);
            setIsPlaying(false);
        }
    };

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
                if (!durationRef.current || barWidthRef.current === 0) return;
                const touchX = evt.nativeEvent.locationX;
                const percentage = Math.min(Math.max(touchX / barWidthRef.current, 0), 1);
                setPosition(percentage * durationRef.current);
            },
            onPanResponderRelease: async (evt) => {
                if (!soundRef.current || !durationRef.current || barWidthRef.current === 0) {
                    isSeeking.current = false;
                    return;
                }
                const touchX = evt.nativeEvent.locationX;
                const percentage = Math.min(Math.max(touchX / barWidthRef.current, 0), 1);
                const seekPosition = percentage * durationRef.current;
                await soundRef.current.setPositionAsync(seekPosition);
                setPosition(seekPosition);
                isSeeking.current = false;
            },
            onPanResponderTerminate: () => {
                isSeeking.current = false;
            }
        })
    ).current;

    useEffect(() => {
        void unloadSound();

        // Preload metadata so duration is visible before the first tap,
        // while still using the safer cached/lazy iOS loading path.
        void ensureSoundLoaded();

        return () => {
            void unloadSound();
        };
    }, [uri]);

    const togglePlayback = async () => {
        const activeSound = soundRef.current || await ensureSoundLoaded();
        if (!activeSound) return;

        if (isPlaying) {
            await activeSound.pauseAsync();
        } else {
            const status = await activeSound.getStatusAsync();
            if (status.isLoaded && status.positionMillis >= (status.durationMillis || 0) - 100) {
                await activeSound.setPositionAsync(0);
            }
            await activeSound.playAsync();
        }
    };

    const handleSeek = (event: any) => {
        if (!soundRef.current || !durationRef.current || barWidthRef.current === 0) return;
        const touchX = event.nativeEvent.locationX;
        const percentage = Math.min(Math.max(touchX / barWidthRef.current, 0), 1);
        const seekPosition = percentage * durationRef.current;
        soundRef.current.setPositionAsync(seekPosition);
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
            <TouchableOpacity onPress={togglePlayback} disabled={isPreparing}>
                <View style={{
                    width: 32, 
                    height: 32, 
                    borderRadius: 16, 
                    backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : colors.primary + '15',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Feather 
                        name={isPreparing ? "loader" : isPlaying ? "pause" : "play"} 
                        size={16} 
                        color={isMe ? '#fff' : colors.primary} 
                        style={!isPlaying && !isPreparing ? { transform: [{ translateX: 1 }] } : {}}
                    />
                </View>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
                <View 
                    onLayout={(e) => {
                        const width = e.nativeEvent.layout.width;
                        barWidthRef.current = width;
                    }}
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
