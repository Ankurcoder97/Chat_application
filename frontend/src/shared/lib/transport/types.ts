export type TransportType = 'internet' | 'bluetooth' | 'local_mesh' | 'offline_queue';

export type DeliveryState =
  | 'PENDING_LOCAL'
  | 'BLUETOOTH_TRANSFER'
  | 'BLUETOOTH_RECEIVED'
  | 'SYNC_PENDING'
  | 'SERVER_SYNCED'
  | 'DELIVERED'
  | 'READ';

export interface BluetoothPeerDevice {
  id: string;
  name: string;
  device?: any; // Web Bluetooth Device or native BLE representation
  connected: boolean;
  rssi?: number;
  lastSeen: number;
}

export interface BluetoothMessagePayload {
  clientId: string;
  conversationId: string;
  senderId: string;
  recipientId?: string;
  content: string;
  type: string;
  media?: any;
  replyToId?: string;
  sentAt: string;
  signature?: string;
  relayedBy?: string;
}

export interface BluetoothPacket {
  packetId: string;
  chunkIndex: number;
  totalChunks: number;
  payload: string; // Base64 chunk
  checksum: string;
}

export interface ITransport {
  readonly name: TransportType;
  isAvailable(): boolean;
  send(message: BluetoothMessagePayload): Promise<boolean>;
}
