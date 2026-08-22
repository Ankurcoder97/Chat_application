import { getSocket } from '../../socket/socketClient';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

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
      video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.localStream = stream;
    if (this.onLocalStreamCallback) {
      this.onLocalStreamCallback(stream);
    }
    return stream;
  }

  // Caller initiates Peer Connection and creates Offer
  public async createOffer(callId: string, recipientId: string, callType: 'voice' | 'video') {
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);
    this.remoteStream = new MediaStream();

    const stream = await this.getLocalMedia(callType);
    stream.getTracks().forEach((track) => {
      this.peerConnection?.addTrack(track, stream);
    });

    // Handle remote tracks
    this.peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        this.remoteStream?.addTrack(track);
      });
      if (this.onRemoteStreamCallback && this.remoteStream) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    // Forward ICE candidates to recipient
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket?.emit('call:signal', {
          callId,
          recipientId,
          signalData: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

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
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);
    this.remoteStream = new MediaStream();

    const stream = await this.getLocalMedia(callType);
    stream.getTracks().forEach((track) => {
      this.peerConnection?.addTrack(track, stream);
    });

    this.peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        this.remoteStream?.addTrack(track);
      });
      if (this.onRemoteStreamCallback && this.remoteStream) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket?.emit('call:signal', {
          callId,
          recipientId: callerId,
          signalData: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerSdp));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    const socket = getSocket();
    socket?.emit('call:signal', {
      callId,
      recipientId: callerId,
      signalData: { type: 'answer', sdp: answer },
    });
  }

  // Process incoming signal (Answer or ICE candidate)
  public async handleSignal(signalData: any) {
    if (!this.peerConnection) return;

    if (signalData.type === 'answer') {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
    } else if (signalData.type === 'candidate' && signalData.candidate) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      } catch (err) {
        console.error('Error adding ICE candidate', err);
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
