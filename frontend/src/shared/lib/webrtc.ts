import { getSocket } from '../../socket/socketClient';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onLocalStreamCallback: ((stream: MediaStream) => void) | null = null;

  public setCallbacks(
    onLocalStream: (stream: MediaStream) => void,
    onRemoteStream: (stream: MediaStream) => void
  ) {
    this.onLocalStreamCallback = onLocalStream;
    this.onRemoteStreamCallback = onRemoteStream;
  }

  // Get local audio and/or video stream
  public async getLocalMedia(callType: 'voice' | 'video'): Promise<MediaStream> {
    if (this.localStream && this.localStream.active) {
      const hasVideo = this.localStream.getVideoTracks().length > 0;
      if (callType === 'video' && !hasVideo) {
        this.cleanup();
      } else {
        return this.localStream;
      }
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video:
        callType === 'video'
          ? {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              facingMode: 'user',
            }
          : false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.localStream = stream;
    if (this.onLocalStreamCallback) {
      this.onLocalStreamCallback(stream);
    }
    return stream;
  }

  private initPeerConnection(callId: string, peerId: string): RTCPeerConnection {
    if (this.peerConnection) {
      return this.peerConnection;
    }

    console.log('⚡ Initializing RTCPeerConnection for call:', callId, 'peer:', peerId);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnection = pc;

    // Initialize remote stream container
    const remote = new MediaStream();
    this.remoteStream = remote;

    // Attach local tracks if already available
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      console.log('🎥 Remote track received:', event.track.kind, event.track.id);
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }

      if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
        this.remoteStream.addTrack(event.track);
      }

      // Create new MediaStream instance so React/Zustand state detects change
      const updatedStream = new MediaStream(this.remoteStream.getTracks());
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(updatedStream);
      }
    };

    // Forward ICE candidates to peer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket?.emit('call:signal', {
          callId,
          recipientId: peerId,
          signalData: { type: 'candidate', candidate: event.candidate.toJSON() },
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('📡 ICE Connection State:', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log('🔗 Peer Connection State:', pc.connectionState);
    };

    return pc;
  }

  // Caller creates and sends WebRTC Offer
  public async createOffer(callId: string, recipientId: string, callType: 'voice' | 'video') {
    try {
      console.log('📞 Creating WebRTC Offer for:', recipientId);
      const stream = await this.getLocalMedia(callType);
      const pc = this.initPeerConnection(callId, recipientId);

      // Ensure local tracks are attached to peer connection
      stream.getTracks().forEach((track) => {
        const senders = pc.getSenders();
        if (!senders.some((s) => s.track?.id === track.id)) {
          pc.addTrack(track, stream);
        }
      });

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      });
      await pc.setLocalDescription(offer);

      const socket = getSocket();
      socket?.emit('call:signal', {
        callId,
        recipientId,
        signalData: { type: 'offer', sdp: offer },
      });
      console.log('📤 WebRTC Offer sent successfully');
    } catch (err) {
      console.error('Error creating WebRTC offer:', err);
    }
  }

  // Recipient handles Offer and creates Answer
  public async handleOfferAndAnswer(
    callId: string,
    callerId: string,
    offerSdp: RTCSessionDescriptionInit,
    callType: 'voice' | 'video'
  ) {
    try {
      console.log('📥 Handling WebRTC Offer from:', callerId);
      const stream = await this.getLocalMedia(callType);
      const pc = this.initPeerConnection(callId, callerId);

      // Ensure local tracks are attached to peer connection
      stream.getTracks().forEach((track) => {
        const senders = pc.getSenders();
        if (!senders.some((s) => s.track?.id === track.id)) {
          pc.addTrack(track, stream);
        }
      });

      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
      console.log('✅ Remote Description (Offer) set');

      // Drain queued ICE candidates
      await this.drainPendingCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const socket = getSocket();
      socket?.emit('call:signal', {
        callId,
        recipientId: callerId,
        signalData: { type: 'answer', sdp: answer },
      });
      console.log('📤 WebRTC Answer sent successfully');
    } catch (err) {
      console.error('Error handling WebRTC offer/answer:', err);
    }
  }

  // Handle incoming signals (SDP Answer or ICE Candidate)
  public async handleSignal(signalData: any) {
    try {
      if (signalData.type === 'answer' && signalData.sdp) {
        if (this.peerConnection) {
          console.log('📥 Received WebRTC Answer, setting Remote Description');
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          await this.drainPendingCandidates();
        }
      } else if (signalData.type === 'candidate' && signalData.candidate) {
        if (
          this.peerConnection &&
          this.peerConnection.remoteDescription &&
          this.peerConnection.remoteDescription.type
        ) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(signalData.candidate));
          } catch (err) {
            console.error('Error adding ICE candidate', err);
          }
        } else {
          // Queue candidate safely even if peerConnection is not yet initialized
          this.pendingCandidates.push(signalData.candidate);
        }
      }
    } catch (err) {
      console.error('Error in handleSignal:', err);
    }
  }

  private async drainPendingCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    const candidates = [...this.pendingCandidates];
    this.pendingCandidates = [];
    for (const candidate of candidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding queued ICE candidate', err);
      }
    }
  }

  public toggleMute(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  public cleanup() {
    console.log('🧹 Cleaning up WebRTC Manager');
    this.pendingCandidates = [];
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}

export const webrtc = new WebRTCManager();
