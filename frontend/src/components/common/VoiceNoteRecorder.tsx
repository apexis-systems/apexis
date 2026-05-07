import React, { useState, useRef, useEffect } from 'react';
import { Mic, X, Send, Pause, Play } from 'lucide-react';

interface VoiceNoteRecorderProps {
  onSend: (file: File) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export default function VoiceNoteRecorder({ onSend, onRecordingStateChange }: VoiceNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (duration >= 300 && isRecording) {
      stopRecording(false);
    }
  }, [duration, isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setIsPaused(false);
      if (onRecordingStateChange) onRecordingStateChange(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error accessing microphone', err);
      alert('Please allow microphone access to record voice notes.');
    }
  };

  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const stopRecording = (cancel: boolean = false) => {
    if (!mediaRecorderRef.current || !isRecording) return;
    
    const finalize = () => {
        setIsRecording(false);
        setIsPaused(false);
        if (onRecordingStateChange) onRecordingStateChange(false);
        if (timerRef.current) clearInterval(timerRef.current);

        if (!cancel && chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            const file = new File([blob], `VoiceNote_${Date.now()}.webm`, { type: 'audio/webm' });
            onSend(file);
        }
        chunksRef.current = [];
    };

    if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = () => {
            const stream = mediaRecorderRef.current?.stream;
            stream?.getTracks().forEach(track => track.stop());
            finalize();
        };
        mediaRecorderRef.current.stop();
    } else {
        finalize();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (isRecording) {
    return (
      <div className="flex items-center gap-4 bg-red-500/10 text-red-500 px-4 py-2 rounded-full flex-1">
        <div className={`w-2.5 h-2.5 rounded-full bg-red-500 ${!isPaused ? 'animate-pulse' : ''}`}></div>
        <span className="font-mono text-sm font-medium">{formatTime(duration)}</span>
        <div className="flex-1"></div>
        <button 
          onClick={togglePause}
          className="p-1.5 hover:bg-red-500/20 rounded-full transition-colors"
          title={isPaused ? "Resume" : "Pause"}
        >
          {isPaused ? <Play size={18} /> : <Pause size={18} />}
        </button>
        <button 
          onClick={() => stopRecording(true)}
          className="p-1.5 hover:bg-red-500/20 rounded-full transition-colors"
          title="Cancel"
        >
          <X size={18} />
        </button>
        <button 
          onClick={() => stopRecording(false)}
          className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          title="Send"
        >
          <Send size={16} className="-translate-x-[1px] translate-y-[1px]" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-primary transition-colors"
      title="Record Voice Note"
    >
      <Mic size={20} />
    </button>
  );
}
