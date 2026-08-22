import React, { useState, useEffect } from 'react';
import { Modal } from '../../../shared/components/Modal';
import { Input } from '../../../shared/components/Input';
import { Avatar } from '../../../shared/components/Avatar';
import { Search, Loader2 } from 'lucide-react';
import api from '../../../shared/lib/axios';
import { User, Conversation } from '../../../shared/types';
import { useChatStore } from '../store/chatStore';
import { useQueryClient } from '@tanstack/react-query';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { setActiveConversation } = useChatStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data.data);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectUser = async (user: User) => {
    try {
      setIsCreating(true);
      const { data } = await api.post('/conversations', { participantId: user.id });
      const conversation: Conversation = data.data;

      // Update conversations cache
      queryClient.setQueryData(['conversations'], (old: Conversation[] | undefined) => {
        if (!old) return [conversation];
        const exists = old.some((c) => c.id === conversation.id);
        if (exists) return old;
        return [conversation, ...old];
      });

      setActiveConversation(conversation);
      onClose();
    } catch (err) {
      console.error('Failed to create conversation', err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Message">
      <div className="flex flex-col space-y-4">
        <Input
          placeholder="Search by name, username, phone or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftIcon={<Search size={16} />}
          autoFocus
        />

        <div className="flex flex-col space-y-1 min-h-[160px] max-h-[320px] overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-8 text-text-tertiary">
              <Loader2 size={20} className="animate-spin mr-2" /> Searching...
            </div>
          ) : results.length > 0 ? (
            results.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSelectUser(u)}
                disabled={isCreating}
                className="flex items-center space-x-3 p-2.5 rounded-xl hover:bg-surface-muted transition-colors text-left w-full focus:outline-none focus:bg-surface-muted"
              >
                <Avatar name={u.name} avatarUrl={u.avatarUrl} size="md" isOnline={u.isOnline} showOnlineDot />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary truncate">{u.name}</span>
                    {u.isOnline && <span className="text-xs text-emerald-500 font-medium">Online</span>}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-text-secondary truncate">
                    <span>@{u.username}</span>
                    {u.phone && <span className="text-accent-600 dark:text-accent-400 font-mono text-[11px]">&middot; {u.phone}</span>}
                  </div>
                </div>
              </button>
            ))
          ) : query.trim().length >= 2 ? (
            <div className="text-center py-8 text-xs text-text-tertiary">No users found matching "{query}"</div>
          ) : (
            <div className="text-center py-8 text-xs text-text-tertiary">
              Type name, username, phone or email to find contacts
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
