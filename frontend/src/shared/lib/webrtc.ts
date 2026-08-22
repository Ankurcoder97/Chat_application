import { getSocket } from '../../socket/socketClient';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
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
    if (this.localStream) {
      return this.localStream;
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

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnection = pc;
    this.pendingCandidates = [];

    // Create a new remote MediaStream
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
      event.streams[0]?.getTracks().forEach((track) => {
        if (!remote.getTracks().some((t) => t.id === track.id)) {
          remote.addTrack(track);
        }
      });
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(remote);
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

    pc.onconnectionstatechange = () => {
      console.log('WebRTC Connection State:', pc.connectionState);
    };

    return pc;
  }

  // Caller creates and sends WebRTC Offer
  public async createOffer(callId: string, recipientId: string, callType: 'voice' | 'video') {
    const stream = await this.getLocalMedia(callType);
    const pc = this.initPeerConnection(callId, recipientId);

    // Ensure tracks are added
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
  }

  // Recipient handles Offer and creates Answer
  public async handleOfferAndAnswer(
    callId: string,
    callerId: string,
    offerSdp: RTCSessionDescriptionInit,
    callType: 'voice' | 'video'
  ) {
    const stream = await this.getLocalMedia(callType);
    const pc = this.initPeerConnection(callId, callerId);

    // Ensure local tracks are added
    stream.getTracks().forEach((track) => {
      const senders = pc.getSenders();
      if (!senders.some((s) => s.track?.id === track.id)) {
        pc.addTrack(track, stream);
      }
    });

    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));

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
  }

  // Handle incoming signals (SDP Answer or ICE Candidate)
  public async handleSignal(signalData: any) {
    if (!this.peerConnection) return;

    if (signalData.type === 'answer' && signalData.sdp) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
      await this.drainPendingCandidates();
    } else if (signalData.type === 'candidate' && signalData.candidate) {
      const candidate = new RTCIceCandidate(signalData.candidate);
      if (this.peerConnection.remoteDescription) {
        try {
          await this.peerConnection.addIceCandidate(candidate);
        } catch (err) {
          console.error('Error adding ICE candidate', err);
        }
      } else {
        this.pendingCandidates.push(signalData.candidate);
      }
    }
  }

  private async drainPendingCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding queued ICE candidate', err);
        }
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
