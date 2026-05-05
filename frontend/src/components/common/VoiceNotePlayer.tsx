import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface VoiceNotePlayerProps {
  url: string;
  isMe?: boolean;
}

export default function VoiceNotePlayer({ url, isMe = false }: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    const setAudioData = () => {
      if (audio.duration === Infinity) {
        // Force Chrome to fetch duration for WebM files
        audio.currentTime = Number.MAX_SAFE_INTEGER;
        audio.addEventListener('timeupdate', function getDuration() {
          audio.removeEventListener('timeupdate', getDuration);
          audio.currentTime = 0;
          setDuration(audio.duration);
        });
      } else {
        setDuration(audio.duration);
      }
    };

    const setAudioTime = () => {
      if (audio.currentTime > 1e10) return; // Ignore time updates during Infinity fix
      setPosition(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setPosition(0);
      audio.currentTime = 0;
    };

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, [url]);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.error("Error playing audio", e));
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = Number(e.target.value);
    audioRef.current.currentTime = time;
    setPosition(time);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const bgClass = isMe ? 'bg-white/20' : 'bg-secondary';
  const textClass = isMe ? 'text-white' : 'text-primary';
  const mutedTextClass = isMe ? 'text-white/70' : 'text-muted-foreground';
  const sliderColor = isMe ? 'accent-white' : 'accent-primary';

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <button 
        onClick={togglePlayback}
        className={`w-9 h-9 rounded-full flex items-center justify-center ${bgClass} ${textClass} hover:opacity-80 transition-opacity`}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} className="translate-x-[1px]" />}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        <input 
          type="range" 
          min={0} 
          max={isFinite(duration) && duration > 0 ? duration : 100} 
          value={isFinite(position) ? position : 0} 
          onChange={handleSeek}
          className={`w-full h-1.5 rounded-full outline-none ${sliderColor} cursor-pointer`}
          style={{
            background: isMe ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'
          }}
        />
        <div className="flex justify-between items-center text-[10px] font-medium">
          <span className={mutedTextClass}>{formatTime(position)}</span>
          <span className={mutedTextClass}>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
