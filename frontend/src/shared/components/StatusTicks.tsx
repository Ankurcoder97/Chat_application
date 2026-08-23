import React from 'react';
import { MessageStatus } from '../types';
import { Clock, Bluetooth } from 'lucide-react';

interface StatusTicksProps {
  status?: MessageStatus;
  isOptimistic?: boolean;
  hasError?: boolean;
  transportType?: 'internet' | 'bluetooth' | 'local_mesh' | 'offline_queue';
  deliveryState?: string;
}

export const StatusTicks: React.FC<StatusTicksProps> = ({
  status,
  isOptimistic,
  hasError,
  transportType,
  deliveryState,
}) => {
  if (hasError) {
    return <span className="text-rose-400 text-xs font-bold" title="Failed to send">!</span>;
  }

  // Bluetooth Transfer In Progress
  if (deliveryState === 'BLUETOOTH_TRANSFER' || deliveryState === 'BLUETOOTH_RECEIVED') {
    return (
      <span className="flex items-center space-x-0.5 text-cyan-300 text-[10px]" title="Relayed via Bluetooth">
        <Bluetooth size={10} className="animate-pulse" />
      </span>
    );
  }

  // Pending Local Sync
  if (isOptimistic || deliveryState === 'PENDING_LOCAL' || deliveryState === 'SYNC_PENDING') {
    return (
      <span className="flex items-center space-x-0.5 text-white/60">
        {transportType === 'bluetooth' && <Bluetooth size={9} className="opacity-70 mr-0.5" />}
        <Clock size={11} className="animate-pulse" />
      </span>
    );
  }

  const isRead = status?.read && status.read.length > 0;
  const isDelivered = status?.delivered && status.delivered.length > 0;

  if (isRead) {
    // Double Blue Check
    return (
      <span className="inline-flex items-center">
        {transportType === 'bluetooth' && <Bluetooth size={9} className="text-blue-300 opacity-80 mr-0.5" />}
        <svg
          className="w-3.5 h-3.5 text-blue-300 inline-block align-middle"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-label="Read"
        >
          <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 2.354 7.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l7-7z" />
          <path d="M15.354 4.354a.5.5 0 0 0-.708-.708L8 10.293l-.646-.647a.5.5 0 0 0-.708.708l1 1a.5.5 0 0 0 .708 0l7-7z" />
        </svg>
      </span>
    );
  }

  if (isDelivered) {
    // Double Gray Check
    return (
      <span className="inline-flex items-center">
        {transportType === 'bluetooth' && <Bluetooth size={9} className="text-white/70 opacity-80 mr-0.5" />}
        <svg
          className="w-3.5 h-3.5 text-white/70 inline-block align-middle"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-label="Delivered"
        >
          <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 2.354 7.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l7-7z" />
          <path d="M15.354 4.354a.5.5 0 0 0-.708-.708L8 10.293l-.646-.647a.5.5 0 0 0-.708.708l1 1a.5.5 0 0 0 .708 0l7-7z" />
        </svg>
      </span>
    );
  }

  // Single Sent Check
  return (
    <span className="inline-flex items-center">
      {transportType === 'bluetooth' && <Bluetooth size={9} className="text-white/70 opacity-80 mr-0.5" />}
      <svg
        className="w-3.5 h-3.5 text-white/70 inline-block align-middle"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-label="Sent"
      >
        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
      </svg>
    </span>
  );
};
