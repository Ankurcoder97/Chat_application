import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChatListItem } from './ChatListItem';
import { UserSearchModal } from './UserSearchModal';
import { Conversation } from '../../../shared/types';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../../auth/store/authStore';
import { useUIStore } from '../../../shared/store/uiStore';
import { Search, Plus, MessageSquare, Moon, Sun, LogOut, Settings as SettingsIcon } from 'lucide-react';
import api from '../../../shared/lib/axios';

export const ChatList: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { activeConversation, searchQuery, setSearchQuery } = useChatStore();
  const { theme, setTheme, setMobileTab } = useUIStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'archived'>('all');

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data } = await api.get('/conversations');
      return data.data;
    },
    refetchInterval: 30000,
  });

  const toggleTheme = () => {
    if (theme === 'dark') setTheme('light');
    else setTheme('dark');
  };

  const filteredConversations = conversations.filter((c) => {
    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = c.participant?.name?.toLowerCase().includes(q);
      const usernameMatch = c.participant?.username?.toLowerCase().includes(q);
      const messageMatch = c.lastMessage?.content?.toLowerCase().includes(q);
      if (!nameMatch && !usernameMatch && !messageMatch) return false;
    }

    // 2. Tab Filter
    if (filter === 'unread') return c.unreadCount > 0 && !c.isArchived;
    if (filter === 'archived') return c.isArchived;
    return !c.isArchived;
  });

  return (
    <div className="flex flex-col h-full bg-surface-base border-r border-border-subtle select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border-subtle bg-surface-elevated/80 backdrop-blur-sm">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center text-white shadow-subtle">
            <MessageSquare size={18} className="fill-white" />
          </div>
          <h1 className="text-lg font-bold text-text-primary tracking-tight">Nexus</h1>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={toggleTheme}
            className="p-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-muted transition-colors"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 text-white bg-accent-500 hover:bg-accent-600 rounded-full transition-colors shadow-subtle"
            title="New Chat"
            aria-label="Start new chat"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="px-3.5 py-2.5 border-b border-border-subtle/50">
        <div className="relative flex items-center">
          <Search size={15} className="absolute left-3 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search messages or people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs bg-surface-muted text-text-primary rounded-lg border border-transparent focus:border-border-default focus:bg-surface-elevated focus:outline-none transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-2 mt-2 px-0.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-accent-500 text-white shadow-subtle'
                : 'bg-surface-muted text-text-secondary hover:text-text-primary'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-accent-500 text-white shadow-subtle'
                : 'bg-surface-muted text-text-secondary hover:text-text-primary'
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => setFilter('archived')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === 'archived'
                ? 'bg-accent-500 text-white shadow-subtle'
                : 'bg-surface-muted text-text-secondary hover:text-text-primary'
            }`}
          >
            Archived
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border-subtle/20">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-full skeleton flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-1/2 h-3.5 rounded skeleton" />
                  <div className="w-3/4 h-3 rounded skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map((conversation) => (
            <ChatListItem
              key={conversation.id}
              conversation={conversation}
              isSelected={activeConversation?.id === conversation.id}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center h-64 text-text-tertiary">
            <MessageSquare size={36} className="mb-3 stroke-1 text-text-tertiary" />
            <p className="text-sm font-medium text-text-secondary">No conversations yet</p>
            <p className="text-xs text-text-tertiary mt-1 max-w-[200px]">
              Tap the &quot;+&quot; icon above to search for people and start chatting.
            </p>
          </div>
        )}
      </div>

      {/* User Footer Profile Strip */}
      {user && (
        <div className="p-3 border-t border-border-subtle flex items-center justify-between bg-surface-muted/50">
          <div
            onClick={() => setMobileTab('settings')}
            className="flex items-center space-x-2.5 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center text-white text-xs font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-text-primary truncate max-w-[120px]">{user.name}</span>
              <span className="text-[10px] text-text-tertiary">Online</span>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setMobileTab('settings')}
              className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-elevated transition-colors"
              title="Settings"
            >
              <SettingsIcon size={16} />
            </button>
            <button
              onClick={() => logout()}
              className="p-1.5 text-text-secondary hover:text-rose-500 rounded-lg hover:bg-surface-elevated transition-colors"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Search & Start Modal */}
      <UserSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
};
