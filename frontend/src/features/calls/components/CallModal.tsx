import React, { useEffect, useRef } from 'react';
import { useCallStore } from '../store/callStore';
import { Avatar } from '../../../shared/components/Avatar';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

export const CallModal: React.FC = () => {
  const {
    callStatus,
    callType,
    peer,
    localStream,
    remoteStream,
    duration,
    isMuted,
    isVideoEnabled,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  } = useCallStore();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (callStatus === 'idle') return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const peerName = peer?.name || 'Unknown User';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none animate-message-in">
      {/* 1. INCOMING CALL SCREEN */}
      {callStatus === 'incoming' && (
        <div className="flex flex-col items-center justify-between h-full max-h-[550px] w-full max-w-sm p-8 text-center text-white">
          <div className="flex flex-col items-center space-y-4 mt-6">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-accent-500/30 animate-ping" />
              <Avatar name={peerName} avatarUrl={peer?.avatarUrl} size="xl" className="shadow-2xl" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">{peerName}</h2>
              <p className="text-sm text-accent-300 font-medium mt-1">
                Incoming {callType === 'video' ? 'Video' : 'Voice'} Call...
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-around w-full mt-12 mb-6">
            {/* Decline */}
            <div className="flex flex-col items-center space-y-2">
              <button
                onClick={() => rejectCall('declined')}
                className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
                aria-label="Decline Call"
              >
                <PhoneOff size={26} />
              </button>
              <span className="text-xs text-white/70">Decline</span>
            </div>

            {/* Accept */}
            <div className="flex flex-col items-center space-y-2">
              <button
                onClick={acceptCall}
                className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 animate-bounce"
                aria-label="Accept Call"
              >
                <Phone size={26} />
              </button>
              <span className="text-xs text-white/70">Accept</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. OUTGOING CALLING SCREEN */}
      {callStatus === 'calling' && (
        <div className="flex flex-col items-center justify-between h-full max-h-[550px] w-full max-w-sm p-8 text-center text-white">
          <div className="flex flex-col items-center space-y-4 mt-6">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-accent-500/20 animate-pulse" />
              <Avatar name={peerName} avatarUrl={peer?.avatarUrl} size="xl" className="shadow-2xl" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">{peerName}</h2>
              <p className="text-sm text-accent-300 font-medium mt-1 animate-pulse">
                Calling {callType === 'video' ? 'Video' : 'Voice'}...
              </p>
            </div>
          </div>

          <div className="mt-12 mb-6">
            <button
              onClick={endCall}
              className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
              aria-label="Cancel Call"
            >
              <PhoneOff size={26} />
            </button>
          </div>
        </div>
      )}

      {/* 3. ACTIVE CONNECTED CALL SCREEN */}
      {callStatus === 'connected' && (
        <div className="relative w-full h-full flex flex-col justify-between overflow-hidden">
          {/* VIDEO CALL LAYOUT */}
          {callType === 'video' ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              {/* Fullscreen Remote Video */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Picture-in-Picture Local Video */}
              <div className="absolute top-4 right-4 w-28 sm:w-36 h-40 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 z-20 bg-surface-elevated">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Caller Name & Timer Badge */}
              <div className="absolute top-6 left-6 z-20 flex items-center space-x-2.5 bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-white">
                <span className="text-xs font-semibold">{peerName}</span>
                <span className="text-[11px] font-mono text-emerald-400">{formatTimer(duration)}</span>
              </div>
            </div>
          ) : (
            /* VOICE CALL LAYOUT */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-white">
              <div className="relative mb-6">
                <div className="w-32 h-32 rounded-full bg-accent-500/20 flex items-center justify-center animate-pulse">
                  <Avatar name={peerName} avatarUrl={peer?.avatarUrl} size="xl" className="shadow-2xl" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white tracking-tight">{peerName}</h2>
              <span className="mt-2 px-3 py-1 bg-white/10 rounded-full text-xs font-mono text-emerald-400">
                {formatTimer(duration)}
              </span>

              {/* Audio visualizer wave bar */}
              <div className="flex items-center space-x-1.5 mt-8 h-8">
                {[4, 8, 14, 6, 12, 18, 10, 16, 8, 12].map((height, i) => (
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
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-4 bg-surface-elevated/90 backdrop-blur-md px-6 py-3.5 rounded-full border border-white/10 shadow-2xl">
            {/* Mute Mic */}
            <button
              onClick={toggleMute}
              className={cn(
                'p-3.5 rounded-full text-white transition-colors',
                isMuted ? 'bg-rose-500/80 hover:bg-rose-600' : 'bg-white/15 hover:bg-white/25'
              )}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {/* Toggle Video (for video call) */}
            {callType === 'video' && (
              <button
                onClick={toggleVideo}
                className={cn(
                  'p-3.5 rounded-full text-white transition-colors',
                  !isVideoEnabled ? 'bg-rose-500/80 hover:bg-rose-600' : 'bg-white/15 hover:bg-white/25'
                )}
                title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
            )}

            {/* End Call */}
            <button
              onClick={endCall}
              className="p-3.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg transition-transform active:scale-95"
              title="End call"
            >
              <PhoneOff size={22} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
