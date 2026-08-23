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
  switchCamera: () => Promise<void>;
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

    startOutgoingCall: async (peer: any, callType) => {
      const peerId = (peer?.id || peer?._id || '').toString();
      if (!peerId) {
        console.error('Cannot start call: invalid peer ID', peer);
        return;
      }

      const normalizedPeer: CallPeer = {
        id: peerId,
        name: peer.name || 'User',
        username: peer.username,
        avatarUrl: peer.avatarUrl,
      };

      ringtone.playOutgoing();

      // Acquire media immediately so local preview is visible
      try {
        await webrtc.getLocalMedia(callType);
      } catch (err) {
        console.error('Failed to get media devices', err);
      }

      // Reset WebRTC manager for clean session
      webrtc.cleanup();

      const socket = getSocket();
      socket?.emit(
        'call:initiate',
        { recipientId: peerId, callType },
        (res: any) => {
          if (res?.success) {
            set({
              callStatus: 'calling',
              callType,
              callId: res.callId,
              peer: normalizedPeer,
              duration: 0,
              isMuted: false,
              isVideoEnabled: callType === 'video',
              incomingOfferSdp: null,
              localStream: null,
              remoteStream: null,
            });
          } else {
            ringtone.playEndCall();
            webrtc.cleanup();
            set({ callStatus: 'idle', peer: null, callId: null, incomingOfferSdp: null });
          }
        }
      );
    },

    receiveIncomingCall: (callId, peer, callType) => {
      // Reset WebRTC manager for clean session
      webrtc.cleanup();
      ringtone.playIncoming();
      set({
        callStatus: 'incoming',
        callType,
        callId,
        peer,
        duration: 0,
        isMuted: false,
        isVideoEnabled: callType === 'video',
        incomingOfferSdp: null,
        localStream: null,
        remoteStream: null,
      });
    },

    setIncomingOffer: (offer) => {
      set({ incomingOfferSdp: offer });
    },

    acceptCall: async () => {
      ringtone.stop();
      const { callId, peer, callType, incomingOfferSdp } = get();
      if (!callId || !peer) return;

      set({ callStatus: 'connected' });

      // Notify caller that call was accepted
      const socket = getSocket();
      socket?.emit('call:accept', { callId, callerId: peer.id });

      // Start duration timer
      if (callTimer) clearInterval(callTimer);
      callTimer = setInterval(() => {
        get().incrementDuration();
      }, 1000);

      // Acquire local media
      await webrtc.getLocalMedia(callType);

      // If offer SDP has arrived, process it immediately!
      const currentOffer = get().incomingOfferSdp || incomingOfferSdp;
      if (currentOffer) {
        await webrtc.handleOfferAndAnswer(callId, peer.id, currentOffer, callType);
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

      // Caller creates WebRTC Offer and sends it to recipient
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
      set({
        callStatus: 'idle',
        peer: null,
        callId: null,
        localStream: null,
        remoteStream: null,
        incomingOfferSdp: null,
      });
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
        incomingOfferSdp: null,
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
        incomingOfferSdp: null,
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

    switchCamera: async () => {
      const stream = await webrtc.switchCamera();
      if (stream) {
        set({ localStream: stream, isVideoEnabled: stream.getVideoTracks().some((track) => track.enabled) });
      }
    },

    incrementDuration: () => set((state) => ({ duration: state.duration + 1 })),
  };
});
