'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { sendGroupMessage as sendGroupMessageClient } from '@/lib/api-client';
import { toast } from 'sonner';

/**
 * useVoiceRecording — Handle voice message recording, uploading, and sending.
 *
 * Encapsulates:
 * • MediaRecorder start / stop / cancel
 * • Timer management
 * • Voice upload to Supabase Storage
 * • Sending voice messages for DM and Group contexts
 */
export function useVoiceRecording() {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isUploadingVoice, setIsUploadingVoice] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start(100);
            setIsRecording(true);
            setRecordingTime(0);

            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            toast.info("🎤 Enregistrement en cours...");
        } catch (error) {
            console.error('Error starting recording:', error);
            toast.error("Impossible d'accéder au microphone");
        }
    };

    const stopRecording = async (mode: 'dm' | 'group', context: {
        userId: string;
        conversationId?: string;
        groupId?: string;
        onDMSent?: (conversationId: string) => void;
        onGroupSent?: (groupId: string) => void;
    }) => {
        if (!mediaRecorderRef.current || !isRecording) return;

        return new Promise<void>((resolve) => {
            mediaRecorderRef.current!.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const duration = recordingTime;

                mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());

                if (recordingIntervalRef.current) {
                    clearInterval(recordingIntervalRef.current);
                }

                setIsRecording(false);
                setRecordingTime(0);

                if (mode === 'dm' && context.conversationId) {
                    await sendVoiceMessageDM(audioBlob, duration, context.userId, context.conversationId);
                    context.onDMSent?.(context.conversationId);
                } else if (mode === 'group' && context.groupId) {
                    await sendVoiceMessageGroup(audioBlob, duration, context.userId, context.groupId);
                    context.onGroupSent?.(context.groupId);
                }

                resolve();
            };

            mediaRecorderRef.current!.stop();
        });
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }

        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
        }

        setIsRecording(false);
        setRecordingTime(0);
        audioChunksRef.current = [];
        toast.info("Enregistrement annulé");
    };

    const sendVoiceMessageDM = async (audioBlob: Blob, duration: number, userId: string, conversationId: string) => {
        setIsUploadingVoice(true);
        try {
            const filename = `voice-messages/${userId}/${Date.now()}.webm`;

            const { error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(filename, audioBlob, {
                    contentType: 'audio/webm',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('chat-media')
                .getPublicUrl(filename);

            const voiceUrl = urlData.publicUrl;

            const { error: insertError } = await supabase
                .from('direct_messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: userId,
                    content: '🎤 Message vocal',
                    type: 'voice',
                    voice_url: voiceUrl,
                    voice_duration: duration
                });

            if (insertError) throw insertError;
            toast.success("Message vocal envoyé! 🎤");
        } catch (error) {
            console.error('Error sending voice message:', error);
            toast.error("Erreur lors de l'envoi du message vocal");
        }
        setIsUploadingVoice(false);
    };

    const sendVoiceMessageGroup = async (audioBlob: Blob, duration: number, userId: string, groupId: string) => {
        setIsUploadingVoice(true);
        try {
            const filename = `voice-messages/${userId}/${Date.now()}.webm`;

            const { error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(filename, audioBlob, {
                    contentType: 'audio/webm',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('chat-media')
                .getPublicUrl(filename);

            const voiceUrl = urlData.publicUrl;

            const savedVoiceMsg = await sendGroupMessageClient({
                groupId,
                userId,
                content: '🎤 Message vocal',
                type: 'voice',
                voiceUrl: voiceUrl,
                voiceDuration: duration,
            });

            if (!savedVoiceMsg) throw new Error('Failed to send voice message');
            toast.success("Message vocal envoyé! 🎤");
        } catch (error) {
            console.error('Error sending voice message:', error);
            toast.error("Erreur lors de l'envoi du message vocal");
        }
        setIsUploadingVoice(false);
    };

    const formatRecordingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return {
        isRecording,
        recordingTime,
        isUploadingVoice,
        startRecording,
        stopRecording,
        cancelRecording,
        formatRecordingTime,
    };
}
