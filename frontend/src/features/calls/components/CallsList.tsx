import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '../../../shared/components/Avatar';
import { useCallStore } from '../store/callStore';
import { useUIStore } from '../../../shared/store/uiStore';
import { CallHistoryItem } from '../../../shared/types';
import { UserSearchModal } from '../../conversations/components/UserSearchModal';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Plus,
  MessageSquare,
  Settings as SettingsIcon,
  Loader2,
  Calendar,
} from 'lucide-react';
import api from '../../../shared/lib/axios';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { cn } from '../../../shared/lib/utils';

export const CallsList: React.FC = () => {
  const { startOutgoingCall } = useCallStore();
  const { mobileTab, setMobileTab } = useUIStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { data: calls = [], isLoading } = useQuery<CallHistoryItem[]>({
    queryKey: ['call-history'],
    queryFn: async () => {
      const { data } = await api.get('/calls');
      return data.data;
    },
    refetchInterval: 10000,
  });

  const formatCallDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      if (isToday(date)) {
        return `Today, ${format(date, 'h:mm a')}`;
      }
      if (isYesterday(date)) {
        return `Yesterday, ${format(date, 'h:mm a')}`;
      }
      return format(date, 'MMM d, h:mm a');
    } catch {
      return dateStr;
    }
  };

  const formatDuration = (sec: number) => {
    if (!sec || sec <= 0) return '';
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    if (mins === 0) return `(${remainingSecs}s)`;
    return `(${mins}m ${remainingSecs}s)`;
  };

  return (
    <div className="flex flex-col h-full bg-surface-base border-r border-border-subtle select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-surface-base border-b border-border-subtle">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">Calls</h1>
        <button
          onClick={() => setIsSearchOpen(true)}
          className="p-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-muted transition-colors"
          title="New call"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Calls Feed */}
      <div className="flex-1 overflow-y-auto divide-y divide-border-subtle/50">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <Loader2 size={24} className="animate-spin mb-2" />
            <span className="text-xs">Loading call history...</span>
          </div>
        ) : calls.length > 0 ? (
          calls.map((call) => {
            const peer = call.peer;
            const isMissed = call.direction === 'missed';

            return (
              <div
                key={call.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface-muted/60 transition-colors group"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <Avatar name={peer?.name || 'User'} avatarUrl={peer?.avatarUrl} size="md" />

                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      className={cn(
                        'text-sm font-semibold truncate',
                        isMissed ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-text-primary'
                      )}
                    >
                      {peer?.name || 'Unknown'}
                    </span>

                    <div className="flex items-center space-x-1.5 mt-0.5 text-xs text-text-secondary">
                      {/* Direction Icon */}
                      {call.direction === 'missed' ? (
                        <PhoneMissed size={13} className="text-rose-500 flex-shrink-0" />
                      ) : call.direction === 'incoming' ? (
                        <PhoneIncoming size={13} className="text-emerald-500 flex-shrink-0" />
                      ) : (
                        <PhoneOutgoing size={13} className="text-accent-500 flex-shrink-0" />
                      )}

                      {/* Call Type Indicator */}
                      <span className="capitalize font-medium">{call.callType} call</span>

                      {/* Duration */}
                      {call.duration > 0 && (
                        <span className="text-text-tertiary font-mono text-[11px]">
                          {formatDuration(call.duration)}
                        </span>
                      )}

                      <span>&middot;</span>
                      <span className="text-text-tertiary text-[11px] truncate">
                        {formatCallDate(call.startedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Callback Button */}
                <button
                  onClick={() => peer && startOutgoingCall(peer, call.callType)}
                  className="p-2.5 text-accent-600 dark:text-accent-400 hover:bg-accent-500/10 rounded-full transition-colors flex-shrink-0 ml-2"
                  title={`Start ${call.callType} call`}
                  aria-label={`Call ${peer?.name}`}
                >
                  {call.callType === 'video' ? <Video size={18} /> : <Phone size={18} />}
                </button>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface-muted flex items-center justify-center text-text-tertiary mb-3">
              <Calendar size={24} />
            </div>
            <p className="text-sm font-semibold text-text-primary">No recent calls</p>
            <p className="text-xs text-text-secondary mt-1 max-w-xs">
              Voice and video calls you make or receive will appear here.
            </p>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="mt-4 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-xs font-semibold shadow-subtle transition-colors"
            >
              Start a new call
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation Tabs */}
      <div className="flex items-center justify-around py-2 bg-surface-elevated border-t border-border-subtle flex-shrink-0">
        <button
          onClick={() => setMobileTab('chats')}
          className={cn(
            'flex flex-col items-center space-y-1 py-1 px-4 rounded-lg transition-colors',
            mobileTab === 'chats' ? 'text-accent-500 font-semibold' : 'text-text-tertiary hover:text-text-primary'
          )}
        >
          <MessageSquare size={20} />
          <span className="text-[10px]">Chats</span>
        </button>

        <button
          onClick={() => setMobileTab('calls')}
          className={cn(
            'flex flex-col items-center space-y-1 py-1 px-4 rounded-lg transition-colors',
            mobileTab === 'calls' ? 'text-accent-500 font-semibold' : 'text-text-tertiary hover:text-text-primary'
          )}
        >
          <Phone size={20} />
          <span className="text-[10px]">Calls</span>
        </button>

        <button
          onClick={() => setMobileTab('settings')}
          className={cn(
            'flex flex-col items-center space-y-1 py-1 px-4 rounded-lg transition-colors',
            mobileTab === 'settings' ? 'text-accent-500 font-semibold' : 'text-text-tertiary hover:text-text-primary'
          )}
        >
          <SettingsIcon size={20} />
          <span className="text-[10px]">Settings</span>
        </button>
      </div>

      <UserSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
};
