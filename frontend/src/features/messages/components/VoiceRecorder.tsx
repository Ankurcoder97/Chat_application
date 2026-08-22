import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Send, Loader2 } from 'lucide-react';
import api from '../../../shared/lib/axios';

interface VoiceRecorderProps {
  onSendVoice: (audioPayload: { url: string; mimeType: string; size: number; duration: number }) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSendVoice, onCancel }) => {
  const [duration, setDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<any>(null);
  const selectedMimeTypeRef = useRef<string>('audio/webm');

  // Detect supported audio MIME type across Chrome, Firefox, iOS Safari, Android
  const getSupportedMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  };

  useEffect(() => {
    startRecording();
    return () => {
      cleanupStreams();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      selectedMimeTypeRef.current = mimeType || 'audio/webm';

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Start recording with 200ms slice intervals so chunks are continuously generated
      mediaRecorder.start(200);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied or recording error', err);
      onCancel();
    }
  };

  const cleanupStreams = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleFinishAndSend = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    if (timerRef.current) clearInterval(timerRef.current);

    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      cleanupStreams();
      onCancel();
      return;
    }

    try {
      // Await recorder stop event to guarantee all final audio chunks are collected
      const finalBlob = await new Promise<Blob>((resolve) => {
        if (recorder.state === 'inactive') {
          resolve(new Blob(audioChunksRef.current, { type: selectedMimeTypeRef.current }));
          return;
        }

        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: selectedMimeTypeRef.current });
          resolve(blob);
        };

        // Request any remaining data before stopping
        try {
          if (recorder.state === 'recording') {
            recorder.requestData();
          }
        } catch {
          // Ignore
        }
        recorder.stop();
      });

      cleanupStreams();

      if (!finalBlob || finalBlob.size === 0) {
        console.warn('Empty voice blob recorded');
        onCancel();
        return;
      }

      const ext = selectedMimeTypeRef.current.includes('mp4') || selectedMimeTypeRef.current.includes('aac')
        ? 'm4a'
        : 'webm';

      const file = new File([finalBlob], `voice_${Date.now()}.${ext}`, {
        type: selectedMimeTypeRef.current,
      });

      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onSendVoice({
        url: data.data.url,
        mimeType: selectedMimeTypeRef.current,
        size: data.data.size,
        duration: Math.max(duration, 1),
      });
    } catch (err) {
      console.error('Voice upload failed', err);
      onCancel();
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex items-center justify-between w-full h-12 px-3 sm:px-4 bg-surface-elevated border border-border-default rounded-full shadow-subtle animate-message-in">
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-500 animate-ping flex-shrink-0" />
        <span className="text-xs sm:text-sm font-mono font-medium text-text-primary">{formatDuration(duration)}</span>
        <span className="text-[11px] sm:text-xs text-text-secondary truncate">
          {isProcessing ? 'Sending audio...' : 'Recording...'}
        </span>
      </div>

      <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
        <button
          onClick={() => {
            cleanupStreams();
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
            onCancel();
          }}
          disabled={isProcessing}
          className="p-1.5 sm:p-2 text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors"
          title="Cancel recording"
        >
          <Trash2 size={18} />
        </button>

        <button
          onClick={handleFinishAndSend}
          disabled={isProcessing}
          className="p-1.5 sm:p-2 bg-accent-500 hover:bg-accent-600 text-white rounded-full transition-colors shadow-subtle disabled:opacity-50"
          title="Send voice note"
        >
          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
};
