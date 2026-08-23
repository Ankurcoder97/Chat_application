import { getSocket } from '../../socket/socketClient';

const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.services.mozilla.com' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

function parseIceServersFromEnv(): RTCIceServer[] {
  const raw = import.meta.env.VITE_RTC_ICE_SERVERS;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('VITE_RTC_ICE_SERVERS must be a JSON array. Falling back to STUN only.');
      return [];
    }

    return parsed.filter((server): server is RTCIceServer => {
      const urls = (server as RTCIceServer)?.urls;
      return typeof urls === 'string' || (Array.isArray(urls) && urls.every((url) => typeof url === 'string'));
    });
  } catch (err) {
    console.warn('Invalid VITE_RTC_ICE_SERVERS JSON. Falling back to STUN only.', err);
    return [];
  }
}

const configuredIceServers = parseIceServersFromEnv();

const RTC_CONFIG: RTCConfiguration = {
  iceServers: configuredIceServers.length > 0 ? configuredIceServers : DEFAULT_STUN_SERVERS,
  iceCandidatePoolSize: 10,
  iceTransportPolicy: import.meta.env.VITE_RTC_FORCE_RELAY === 'true' ? 'relay' : 'all',
};

type CameraFacingMode = 'user' | 'environment';

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingCandidates: any[] = [];
  private isHandlingOffer = false;
  private cameraFacingMode: CameraFacingMode = 'user';

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
      const hasAudio = this.localStream.getAudioTracks().length > 0;
      if (hasAudio && (callType === 'voice' || hasVideo)) {
        return this.localStream;
      }
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
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
              facingMode: { ideal: this.cameraFacingMode },
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

  public async switchCamera(): Promise<MediaStream | null> {
    if (!this.localStream || this.localStream.getVideoTracks().length === 0) {
      return this.getLocalMedia('video');
    }

    const previousFacingMode = this.cameraFacingMode;
    const nextFacingMode: CameraFacingMode = previousFacingMode === 'user' ? 'environment' : 'user';
    const oldVideoTrack = this.localStream.getVideoTracks()[0];
    const wasEnabled = oldVideoTrack?.enabled ?? true;

    try {
      this.cameraFacingMode = nextFacingMode;
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: { ideal: nextFacingMode },
        },
      });

      const nextVideoTrack = nextStream.getVideoTracks()[0];
      if (!nextVideoTrack) {
        nextStream.getTracks().forEach((track) => track.stop());
        this.cameraFacingMode = previousFacingMode;
        return this.localStream;
      }

      nextVideoTrack.enabled = wasEnabled;

      const videoSender = this.peerConnection
        ?.getSenders()
        .find((sender) => sender.track?.kind === 'video');

      if (videoSender) {
        await videoSender.replaceTrack(nextVideoTrack);
      }

      if (oldVideoTrack) {
        this.localStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }

      this.localStream.addTrack(nextVideoTrack);

      const updatedStream = new MediaStream(this.localStream.getTracks());
      this.localStream = updatedStream;
      this.onLocalStreamCallback?.(updatedStream);

      return updatedStream;
    } catch (err) {
      this.cameraFacingMode = previousFacingMode;
      console.error('Error switching camera:', err);
      return this.localStream;
    }
  }

  private initPeerConnection(callId: string, peerId: string): RTCPeerConnection {
    if (this.peerConnection && this.peerConnection.signalingState !== 'closed') {
      return this.peerConnection;
    }

    console.log('⚡ Initializing RTCPeerConnection for call:', callId, 'peer:', peerId);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnection = pc;

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

      const incomingStream = event.streams?.[0];
      const tracks = incomingStream?.getTracks().length ? incomingStream.getTracks() : [event.track];

      tracks.forEach((track) => {
        if (!this.remoteStream!.getTracks().some((existingTrack) => existingTrack.id === track.id)) {
          this.remoteStream!.addTrack(track);
        }
      });

      if (!this.remoteStream.getTracks().some((track) => track.id === event.track.id)) {
        this.remoteStream.addTrack(event.track);
      }

      event.track.onunmute = () => {
        if (this.remoteStream && this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(new MediaStream(this.remoteStream.getTracks()));
        }
      };

      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(new MediaStream(this.remoteStream.getTracks()));
      }
    };

    // Forward ICE candidates to peer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidatePayload =
          typeof event.candidate.toJSON === 'function'
            ? event.candidate.toJSON()
            : {
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
                usernameFragment: event.candidate.usernameFragment,
              };

        const socket = getSocket();
        socket?.emit('call:signal', {
          callId,
          recipientId: peerId,
          signalData: { type: 'candidate', candidate: candidatePayload },
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
    if (this.isHandlingOffer) {
      console.log('⏳ Already processing offer/answer, ignoring duplicate call');
      return;
    }
    this.isHandlingOffer = true;

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

      // Avoid resetting if already stable with answer
      if (pc.signalingState !== 'stable' || pc.remoteDescription === null) {
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
      }
    } catch (err) {
      console.error('Error handling WebRTC offer/answer:', err);
    } finally {
      this.isHandlingOffer = false;
    }
  }

  // Handle incoming signals (SDP Answer or ICE Candidate)
  public async handleSignal(signalData: any) {
    try {
      if (signalData.type === 'answer' && signalData.sdp) {
        if (this.peerConnection && this.peerConnection.signalingState === 'have-local-offer') {
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
            if (signalData.candidate.candidate) {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(signalData.candidate));
            }
          } catch (err) {
            console.error('Error adding ICE candidate', err);
          }
        } else {
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
        if (candidate && candidate.candidate) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
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
    this.isHandlingOffer = false;
    this.cameraFacingMode = 'user';
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
