import React from 'react';
import { getInitials, getAvatarColor, getMediaUrl, cn } from '../lib/utils';

interface AvatarProps {
  name: string;
  avatarUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  showOnlineDot?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  avatarUrl,
  size = 'md',
  isOnline = false,
  showOnlineDot = false,
  className,
}) => {
  const sizeClasses = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-9 h-9 text-xs',
    md: 'w-11 h-11 text-sm font-medium',
    lg: 'w-16 h-16 text-lg font-semibold',
    xl: 'w-24 h-24 text-2xl font-bold',
  };

  const dotSizes = {
    xs: 'w-2 h-2 ring-1',
    sm: 'w-2.5 h-2.5 ring-2',
    md: 'w-3 h-3 ring-2',
    lg: 'w-3.5 h-3.5 ring-2',
    xl: 'w-5 h-5 ring-4',
  };

  const initials = getInitials(name);
  const bgColor = getAvatarColor(name);
  const resolvedAvatarUrl = getMediaUrl(avatarUrl);

  return (
    <div className={cn('relative inline-flex flex-shrink-0 items-center justify-center', className)}>
      {resolvedAvatarUrl ? (
        <img
          src={resolvedAvatarUrl}
          alt={`${name}'s avatar`}
          className={cn('rounded-full object-cover shadow-subtle', sizeClasses[size])}
          onError={(e) => {
            // Fallback to initials if image fails
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div
          style={{ backgroundColor: bgColor }}
          className={cn(
            'flex items-center justify-center rounded-full text-white font-medium select-none shadow-subtle',
            sizeClasses[size]
          )}
        >
          {initials}
        </div>
      )}

      {showOnlineDot && isOnline && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full bg-emerald-500 ring-surface-base',
            dotSizes[size]
          )}
          aria-label="Online"
        />
      )}
    </div>
  );
};
