import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Send } from 'lucide-react';
import api from '../../../shared/lib/axios';

interface VoiceRecorderProps {
  onSendVoice: (audioPayload: { url: string; mimeType: string; size: number; duration: number }) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSendVoice, onCancel }) => {
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    startRecording();
    return () => {
      stopRecordingCleanup();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied or error', err);
      onCancel();
    }
  };

  const stopRecordingCleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleFinishAndSend = async () => {
    stopRecordingCleanup();

    // Use current chunks or blob
    const blobToSend = audioBlob || new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const file = new File([blobToSend], `voice_${Date.now()}.webm`, { type: 'audio/webm' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onSendVoice({
        url: data.data.url,
        mimeType: 'audio/webm',
        size: data.data.size,
        duration: Math.max(duration, 1),
      });
    } catch (err) {
      console.error('Voice upload failed', err);
      onCancel();
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex items-center justify-between w-full h-12 px-4 bg-surface-elevated border border-border-default rounded-full shadow-subtle animate-message-in">
      <div className="flex items-center space-x-3">
        <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
        <span className="text-sm font-mono font-medium text-text-primary">{formatDuration(duration)}</span>
        <span className="text-xs text-text-secondary">Recording audio...</span>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onCancel}
          className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors"
          title="Cancel recording"
        >
          <Trash2 size={18} />
        </button>

        <button
          onClick={handleFinishAndSend}
          className="p-2 bg-accent-500 hover:bg-accent-600 text-white rounded-full transition-colors shadow-subtle"
          title="Send voice note"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
