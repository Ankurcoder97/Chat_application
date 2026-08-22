import { create } from 'zustand';
import { CallPeer, CallStatus, CallType } from '../../../shared/types';
import { ringtone } from '../../../shared/lib/ringtone';
import { webrtc } from '../../../shared/lib/webrtc';
import { getSocket } from '../../../socket/socketClient';

interface CallState {
  callStatus: CallStatus;
  callType: CallType;
  callId: string | null;
  peer: CallPeer | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  duration: number;
  isMuted: boolean;
  isVideoEnabled: boolean;
  incomingOfferSdp: RTCSessionDescriptionInit | null;

  startOutgoingCall: (peer: CallPeer, callType: CallType) => void;
  receiveIncomingCall: (callId: string, peer: CallPeer, callType: CallType) => void;
  setIncomingOffer: (offer: RTCSessionDescriptionInit) => void;
  acceptCall: () => Promise<void>;
  rejectCall: (reason?: string) => void;
  endCall: () => void;
  onCallAccepted: () => Promise<void>;
  onCallEnded: () => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  incrementDuration: () => void;
}

let callTimer: any = null;

export const useCallStore = create<CallState>((set, get) => {
  // Wire up WebRTC callbacks to Zustand
  webrtc.setCallbacks(
    (stream) => set({ localStream: stream }),
    (stream) => set({ remoteStream: stream })
  );

  return {
    callStatus: 'idle',
    callType: 'voice',
    callId: null,
    peer: null,
    localStream: null,
    remoteStream: null,
    duration: 0,
    isMuted: false,
    isVideoEnabled: true,
    incomingOfferSdp: null,

    startOutgoingCall: (peer, callType) => {
      ringtone.playOutgoing();
      const socket = getSocket();

      socket?.emit(
        'call:initiate',
        { recipientId: peer.id, callType },
        (res: any) => {
          if (res?.success) {
            set({
              callStatus: 'calling',
              callType,
              callId: res.callId,
              peer,
              duration: 0,
              isMuted: false,
              isVideoEnabled: callType === 'video',
            });
          } else {
            ringtone.playEndCall();
            set({ callStatus: 'idle', peer: null, callId: null });
          }
        }
      );
    },

    receiveIncomingCall: (callId, peer, callType) => {
      ringtone.playIncoming();
      set({
        callStatus: 'incoming',
        callType,
        callId,
        peer,
        duration: 0,
        isMuted: false,
        isVideoEnabled: callType === 'video',
      });
    },

    setIncomingOffer: (offer) => {
      set({ incomingOfferSdp: offer });
    },

    acceptCall: async () => {
      ringtone.stop();
      const { callId, peer, callType, incomingOfferSdp } = get();
      if (!callId || !peer) return;

      const socket = getSocket();
      socket?.emit('call:accept', { callId, callerId: peer.id });

      set({ callStatus: 'connected' });

      // Start duration timer
      if (callTimer) clearInterval(callTimer);
      callTimer = setInterval(() => {
        get().incrementDuration();
      }, 1000);

      // If offer SDP arrived, answer it; else get local media ready
      if (incomingOfferSdp) {
        await webrtc.handleOfferAndAnswer(callId, peer.id, incomingOfferSdp, callType);
      } else {
        await webrtc.getLocalMedia(callType);
      }
    },

    onCallAccepted: async () => {
      ringtone.stop();
      const { callId, peer, callType } = get();
      if (!callId || !peer) return;

      set({ callStatus: 'connected' });

      // Start duration timer
      if (callTimer) clearInterval(callTimer);
      callTimer = setInterval(() => {
        get().incrementDuration();
      }, 1000);

      // Create WebRTC Offer
      await webrtc.createOffer(callId, peer.id, callType);
    },

    rejectCall: (reason = 'declined') => {
      ringtone.stop();
      ringtone.playEndCall();
      const { callId, peer } = get();
      if (callId && peer) {
        const socket = getSocket();
        socket?.emit('call:reject', { callId, callerId: peer.id, reason });
      }
      webrtc.cleanup();
      set({ callStatus: 'idle', peer: null, callId: null, localStream: null, remoteStream: null });
    },

    endCall: () => {
      ringtone.stop();
      ringtone.playEndCall();
      if (callTimer) clearInterval(callTimer);

      const { callId, peer } = get();
      if (callId) {
        const socket = getSocket();
        socket?.emit('call:end', { callId, recipientId: peer?.id });
      }

      webrtc.cleanup();
      set({
        callStatus: 'idle',
        peer: null,
        callId: null,
        localStream: null,
        remoteStream: null,
        duration: 0,
      });
    },

    onCallEnded: () => {
      ringtone.stop();
      ringtone.playEndCall();
      if (callTimer) clearInterval(callTimer);
      webrtc.cleanup();
      set({
        callStatus: 'idle',
        peer: null,
        callId: null,
        localStream: null,
        remoteStream: null,
        duration: 0,
      });
    },

    setLocalStream: (stream) => set({ localStream: stream }),
    setRemoteStream: (stream) => set({ remoteStream: stream }),

    toggleMute: () => {
      const next = !get().isMuted;
      webrtc.toggleMute(next);
      set({ isMuted: next });
    },

    toggleVideo: () => {
      const next = !get().isVideoEnabled;
      webrtc.toggleVideo(next);
      set({ isVideoEnabled: next });
    },

    incrementDuration: () => set((state) => ({ duration: state.duration + 1 })),
  };
});
