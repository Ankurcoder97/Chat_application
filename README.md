# Nexus Chat (Phase 1 & Phase 2 Complete)

Production-grade, mobile-first real-time messaging SaaS built on the MERN stack with TypeScript, Socket.IO, WebRTC, Redis, and Tailwind CSS.

## Features

### 📞 WebRTC Voice & Video Calling (Phase 2)
- **1-to-1 Voice & Video Calls**: WebRTC (`RTCPeerConnection`) voice/video with STUN and configurable TURN relay servers.
- **Signaling via Socket.IO**: Real-time SDP Offer/Answer exchanges and ICE candidate relay.
- **Synthetic Ringtone Engine**: Web Audio API generated ringtones, dial tones, and end-call audio feedback.
- **Complete In-Call Controls**: Fullscreen remote video, picture-in-picture local preview, mic mute, camera toggle, duration timer.

### 📱 Phone Number Messaging & Auth (Phase 2)
- **Phone Number Support**: Register and log in using phone number, email, or username.
- **Contact Discovery**: Search users by phone number and start conversations directly.

### 💬 Real-Time Messaging & Media (Phase 1)
- **Real-Time Engine**: Socket.IO with Redis pub/sub adapter and presence tracking.
- **Durable Store**: MongoDB with Mongoose and compound indexes for fast cursor pagination.
- **Message Consistency**: Client UUID `clientId` for idempotency and monotonic `seqNo` per conversation.
- **Voice & Media**: Direct recording, waveform preview, audio player, image/video/doc support, fullscreen viewer.
- **Design System**: Calm Sage green accents (`#4A9B6F`), Inter font typography, Light/Dark/System themes, mobile-first layout.

## Quick Start

### 1. Run with Docker Compose
```bash
docker compose up --build
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api/v1`

### 2. Run Locally with npm

**Backend**:
```bash
cd backend
npm install
npm run dev
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```
