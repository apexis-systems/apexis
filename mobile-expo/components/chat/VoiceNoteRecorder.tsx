import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Text, Animated, StyleSheet, Platform } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

interface VoiceNoteRecorderProps {
    colors: any;
    onSend: (uri: string, duration: number) => void;
    onRecordingStateChange: (isRecording: boolean) => void;
}

export default function VoiceNoteRecorder({ colors, onSend, onRecordingStateChange }: VoiceNoteRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const recordingRef = useRef<Audio.Recording | null>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const timerRef = useRef<any>(null);

    useEffect(() => {
        return () => {
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync().catch(() => {});
            }
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    useEffect(() => {
        if (duration >= 300 && isRecording) {
            stopRecording(false);
        }
    }, [duration, isRecording]);

    const startRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') return;

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            
            recordingRef.current = recording;
            setIsRecording(true);
            setIsPaused(false);
            onRecordingStateChange(true);
            setDuration(0);

            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true })
                ])
            ).start();

        } catch (err) {
            console.error('Failed to start recording', err);
        }
    };

    const togglePause = async () => {
        if (!recordingRef.current) return;
        try {
            const status = await recordingRef.current.getStatusAsync();
            if (!status.canRecord) return;

            if (isPaused) {
                await recordingRef.current.startAsync();
                setIsPaused(false);
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = setInterval(() => {
                    setDuration(prev => prev + 1);
                }, 1000);
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
                        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true })
                    ])
                ).start();
            } else {
                // Only call pause if we are currently recording
                if (status.isRecording) {
                    await recordingRef.current.pauseAsync();
                    setIsPaused(true);
                    if (timerRef.current) clearInterval(timerRef.current);
                    pulseAnim.stopAnimation();
                    pulseAnim.setValue(1);
                }
            }
        } catch (err) {
            console.error('Error toggling pause:', err);
        }
    };

    const stopRecording = async (cancel: boolean = false) => {
        if (!recordingRef.current) return;
        
        setIsRecording(false);
        setIsPaused(false);
        onRecordingStateChange(false);
        if (timerRef.current) clearInterval(timerRef.current);
        pulseAnim.stopAnimation();
        pulseAnim.setValue(1);

        try {
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            
            if (cancel) {
                // Just discard
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } else if (uri && duration > 0) {
                // Send
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onSend(uri, duration);
            }
            recordingRef.current = null;
        } catch (error) {
            console.error('Failed to stop recording', error);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {isRecording ? (
                <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    flex: 1, 
                    justifyContent: 'space-between', 
                    paddingHorizontal: 12,
                    height: 44,
                    backgroundColor: colors.surface,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: colors.border,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: !isPaused ? '#ef4444' : colors.textMuted }} />
                        </Animated.View>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] }}>
                            {formatTime(duration)}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <TouchableOpacity onPress={togglePause} style={{ padding: 8 }}>
                            <Feather name={isPaused ? "play" : "pause"} size={18} color={colors.primary} />
                        </TouchableOpacity>
                        <View style={{ width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 2 }} />
                        <TouchableOpacity onPress={() => stopRecording(true)} style={{ padding: 8 }}>
                            <Feather name="trash-2" size={18} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>
            ) : null}

            <TouchableOpacity
                onPress={isRecording ? () => stopRecording(false) : startRecording}
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: isRecording ? '#22c55e' : colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 8,
                    shadowColor: isRecording ? '#22c55e' : colors.primary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 3,
                    elevation: 4,
                    transform: isRecording ? [{ scale: 1.1 }] : [{ scale: 1 }]
                }}
            >
                <Feather name={isRecording ? "send" : "mic"} size={20} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}
