import React, { useEffect, useRef, memo } from 'react';
import { useCallStore } from '../store/callStore';
import { Avatar } from '../../../shared/components/Avatar';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

// Isolated Call Timer component to prevent re-rendering the video player every second
const CallDurationBadge = memo(() => {
  const duration = useCallStore((state) => state.duration);
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  const formatted = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return <span className="text-[11px] font-mono text-emerald-400">{formatted}</span>;
});

CallDurationBadge.displayName = 'CallDurationBadge';

export const CallModal: React.FC = () => {
  const callStatus = useCallStore((state) => state.callStatus);
  const callType = useCallStore((state) => state.callType);
  const peer = useCallStore((state) => state.peer);
  const localStream = useCallStore((state) => state.localStream);
  const remoteStream = useCallStore((state) => state.remoteStream);
  const isMuted = useCallStore((state) => state.isMuted);
  const isVideoEnabled = useCallStore((state) => state.isVideoEnabled);

  const acceptCall = useCallStore((state) => state.acceptCall);
  const rejectCall = useCallStore((state) => state.rejectCall);
  const endCall = useCallStore((state) => state.endCall);
  const toggleMute = useCallStore((state) => state.toggleMute);
  const toggleVideo = useCallStore((state) => state.toggleVideo);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Stable stream attachment for local video (prevents re-attachment blinking)
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [localStream, callStatus]);

  // Stable stream attachment for remote video (prevents re-attachment blinking)
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {});
      }
    }
  }, [remoteStream, callStatus]);

  // Stable stream attachment for remote audio
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      if (remoteAudioRef.current.srcObject !== remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(() => {});
      }
    }
  }, [remoteStream, callStatus]);

  if (callStatus === 'idle') return null;

  const peerName = peer?.name || 'Unknown User';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 select-none">
      {/* Hidden audio element for voice streaming across all call types */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* 1. INCOMING CALL SCREEN */}
      {callStatus === 'incoming' && (
        <div className="flex flex-col items-center justify-between h-full max-h-[550px] w-full max-w-sm p-6 sm:p-8 text-center text-white">
          <div className="flex flex-col items-center space-y-4 mt-6">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-accent-500/30 animate-ping" />
              <Avatar name={peerName} avatarUrl={peer?.avatarUrl} size="xl" className="shadow-2xl" />
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{peerName}</h2>
              <p className="text-xs sm:text-sm text-accent-300 font-medium mt-1">
                Incoming {callType === 'video' ? 'Video' : 'Voice'} Call...
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-around w-full mt-10 mb-6">
            {/* Decline */}
            <div className="flex flex-col items-center space-y-2">
              <button
                onClick={() => rejectCall('declined')}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
                aria-label="Decline Call"
              >
                <PhoneOff size={24} />
              </button>
              <span className="text-xs text-white/70">Decline</span>
            </div>

            {/* Accept */}
            <div className="flex flex-col items-center space-y-2">
              <button
                onClick={acceptCall}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 animate-bounce"
                aria-label="Accept Call"
              >
                <Phone size={24} />
              </button>
              <span className="text-xs text-white/70">Accept</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. OUTGOING CALLING SCREEN */}
      {callStatus === 'calling' && (
        <div className="flex flex-col items-center justify-between h-full max-h-[550px] w-full max-w-sm p-6 sm:p-8 text-center text-white">
          <div className="flex flex-col items-center space-y-4 mt-6">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-accent-500/20 animate-pulse" />
              <Avatar name={peerName} avatarUrl={peer?.avatarUrl} size="xl" className="shadow-2xl" />
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{peerName}</h2>
              <p className="text-xs sm:text-sm text-accent-300 font-medium mt-1 animate-pulse">
                Calling {callType === 'video' ? 'Video' : 'Voice'}...
              </p>
            </div>
          </div>

          <div className="mt-10 mb-6">
            <button
              onClick={endCall}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
              aria-label="Cancel Call"
            >
              <PhoneOff size={24} />
            </button>
          </div>
        </div>
      )}

      {/* 3. ACTIVE CONNECTED CALL SCREEN */}
      {callStatus === 'connected' && (
        <div className="relative w-full h-full flex flex-col justify-between overflow-hidden">
          {/* VIDEO CALL LAYOUT */}
          {callType === 'video' ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
              {/* Fullscreen Remote Video */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Picture-in-Picture Local Video */}
              <div className="absolute top-4 right-4 w-24 sm:w-36 h-36 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 z-20 bg-surface-elevated">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Caller Name & Timer Badge */}
              <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white">
                <span className="text-xs font-semibold truncate max-w-[120px] sm:max-w-[200px]">{peerName}</span>
                <CallDurationBadge />
              </div>
            </div>
          ) : (
            /* VOICE CALL LAYOUT */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white">
              <div className="relative mb-6">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-accent-500/20 flex items-center justify-center animate-pulse">
                  <Avatar name={peerName} avatarUrl={peer?.avatarUrl} size="xl" className="shadow-2xl" />
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{peerName}</h2>
              <div className="mt-2 px-3 py-1 bg-white/10 rounded-full text-xs">
                <CallDurationBadge />
              </div>

              {/* Audio visualizer wave bar */}
              <div className="flex items-center space-x-1.5 mt-8 h-8">
                {[6, 12, 20, 8, 16, 24, 12, 18, 10, 14].map((height, i) => (
                  <span
                    key={i}
                    style={{ height: `${height}px` }}
                    className="w-1 bg-accent-400 rounded-full animate-pulse"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Floating In-Call Action Control Bar */}
          <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-3 sm:space-x-4 bg-surface-elevated/90 backdrop-blur-md px-5 sm:px-6 py-3 rounded-full border border-white/10 shadow-2xl">
            {/* Mute Mic */}
            <button
              onClick={toggleMute}
              className={cn(
                'p-3 sm:p-3.5 rounded-full text-white transition-colors',
                isMuted ? 'bg-rose-500/80 hover:bg-rose-600' : 'bg-white/15 hover:bg-white/25'
              )}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Toggle Video (for video call) */}
            {callType === 'video' && (
              <button
                onClick={toggleVideo}
                className={cn(
                  'p-3 sm:p-3.5 rounded-full text-white transition-colors',
                  !isVideoEnabled ? 'bg-rose-500/80 hover:bg-rose-600' : 'bg-white/15 hover:bg-white/25'
                )}
                title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {isVideoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
              </button>
            )}

            {/* End Call */}
            <button
              onClick={endCall}
              className="p-3 sm:p-3.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg transition-transform active:scale-95"
              title="End call"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
