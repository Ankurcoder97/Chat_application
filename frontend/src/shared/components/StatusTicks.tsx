import React from 'react';
import { MessageStatus } from '../types';
import { Clock } from 'lucide-react';

interface StatusTicksProps {
  status?: MessageStatus;
  isOptimistic?: boolean;
  hasError?: boolean;
}

export const StatusTicks: React.FC<StatusTicksProps> = ({ status, isOptimistic, hasError }) => {
  if (hasError) {
    return <span className="text-rose-400 text-xs font-bold" title="Failed to send">!</span>;
  }

  if (isOptimistic) {
    return <Clock size={11} className="text-white/60 animate-pulse" />;
  }

  const isRead = (status?.read && status.read.length > 0);
  const isDelivered = (status?.delivered && status.delivered.length > 0);

  if (isRead) {
    // Double Blue Check
    return (
      <svg
        className="w-3.5 h-3.5 text-blue-300 inline-block align-middle"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-label="Read"
      >
        <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 2.354 7.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l7-7z" />
        <path d="M15.354 4.354a.5.5 0 0 0-.708-.708L8 10.293l-.646-.647a.5.5 0 0 0-.708.708l1 1a.5.5 0 0 0 .708 0l7-7z" />
      </svg>
    );
  }

  if (isDelivered) {
    // Double Gray Check
    return (
      <svg
        className="w-3.5 h-3.5 text-white/70 inline-block align-middle"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-label="Delivered"
      >
        <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 2.354 7.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l7-7z" />
        <path d="M15.354 4.354a.5.5 0 0 0-.708-.708L8 10.293l-.646-.647a.5.5 0 0 0-.708.708l1 1a.5.5 0 0 0 .708 0l7-7z" />
      </svg>
    );
  }

  // Single Sent Check
  return (
    <svg
      className="w-3.5 h-3.5 text-white/70 inline-block align-middle"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-label="Sent"
    >
      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
    </svg>
  );
};
