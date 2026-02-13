'use client';

import { useState, useEffect, useRef } from "react";
import { Play, Pause } from 'lucide-react';
import { cn } from "@/lib/utils";

// Voice Message Player Component
export function VoiceMessagePlayer({ voiceUrl, duration, isOwn }: { voiceUrl: string; duration?: number; isOwn?: boolean }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = new Audio(voiceUrl);
        audioRef.current = audio;

        audio.addEventListener('timeupdate', () => {
            if (audio.duration) {
                setProgress((audio.currentTime / audio.duration) * 100);
                setCurrentTime(audio.currentTime);
            }
        });

        audio.addEventListener('ended', () => {
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);
        });

        return () => {
            audio.pause();
            audio.src = '';
        };
    }, [voiceUrl]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center gap-3 min-w-[180px]">
            <button
                onClick={togglePlay}
                className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                    isOwn ? "bg-white/20 hover:bg-white/30" : "bg-indigo-500/30 hover:bg-indigo-500/40"
                )}
            >
                {isPlaying ? (
                    <Pause className="h-5 w-5 text-white" />
                ) : (
                    <Play className="h-5 w-5 text-white ml-0.5" />
                )}
            </button>
            <div className="flex-1">
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                        className={cn(
                            "h-full transition-all duration-100",
                            isOwn ? "bg-white/60" : "bg-indigo-400"
                        )}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className="text-[10px] opacity-70 mt-1 block">
                    {formatTime(currentTime)} / {formatTime(duration || 0)}
                </span>
            </div>
        </div>
    );
}
