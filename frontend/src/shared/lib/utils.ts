import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMessageTime(dateString?: string | Date | null): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
  try {
    return format(date, 'HH:mm');
  } catch {
    return '';
  }
}

export function formatChatTimestamp(dateString?: string | Date | null): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;

  try {
    if (isToday(date)) {
      return format(date, 'HH:mm');
    }
    if (isYesterday(date)) {
      return 'Yesterday';
    }
    if (isThisWeek(date)) {
      return format(date, 'EEE');
    }
    return format(date, 'dd/MM/yy');
  } catch {
    return '';
  }
}

export function formatLastSeen(dateString?: string | Date | null): string {
  if (!dateString) return 'Offline';
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
  try {
    if (isToday(date)) {
      return `last seen today at ${format(date, 'HH:mm')}`;
    }
    if (isYesterday(date)) {
      return `last seen yesterday at ${format(date, 'HH:mm')}`;
    }
    return `last seen on ${format(date, 'MMM d, HH:mm')}`;
  } catch {
    return 'Offline';
  }
}

export function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Generate deterministic background color for avatar fallback
export function getAvatarColor(name: string): string {
  const colors = [
    '#2563EB', // Blue
    '#7C3AED', // Violet
    '#DB2777', // Pink
    '#D97706', // Amber
    '#059669', // Emerald
    '#0891B2', // Cyan
    '#4F46E5', // Indigo
    '#EA580C', // Orange
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getMediaUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  const backendBase =
    import.meta.env.VITE_SOCKET_URL ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : '');
  return `${backendBase.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
}
