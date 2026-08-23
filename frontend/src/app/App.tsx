import React, { useEffect } from 'react';
import { useAuthStore } from '../features/auth/store/authStore';
import { useChatStore } from '../features/conversations/store/chatStore';
import { useUIStore } from '../shared/store/uiStore';
import { AuthPage } from '../features/auth/pages/AuthPage';
import { ChatList } from '../features/conversations/components/ChatList';
import { ChatView } from '../features/messages/components/ChatView';
import { SettingsPage } from '../features/settings/pages/SettingsPage';
import { MediaViewer } from '../features/media/components/MediaViewer';
import { CallModal } from '../features/calls/components/CallModal';
import { CallsList } from '../features/calls/components/CallsList';
import { connectSocket, disconnectSocket } from '../socket/socketClient';
import { useSocketEvents } from '../socket/useSocketEvents';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { isAuthenticated, isLoading, fetchCurrentUser } = useAuthStore();
  const { activeConversation } = useChatStore();
  const { mobileTab, theme } = useUIStore();

  // Initialize Auth on App mount
  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Apply Theme on load
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [theme]);

  // Connect Socket when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      connectSocket();
    } else {
      disconnectSocket();
    }
    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated]);

  // Real-time Socket Event Handlers
  useSocketEvents();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-surface-base text-accent-500">
        <Loader2 size={32} className="animate-spin mb-2" />
        <span className="text-xs text-text-secondary font-medium tracking-wide">Loading Nexus...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden flex flex-col bg-surface-base select-none">
      {/* Desktop Two-Column Layout (Sidebar 360px + ChatView) */}
      <div className="flex-1 flex overflow-hidden min-h-0 w-full h-full">
        {/* Left Column / Sidebar */}
        <div
          className={`h-full w-full md:w-[360px] lg:w-[400px] flex-shrink-0 min-h-0 ${
            activeConversation ? 'hidden md:flex flex-col' : 'flex flex-col'
          }`}
        >
          {mobileTab === 'calls' ? (
            <CallsList />
          ) : mobileTab === 'settings' ? (
            <SettingsPage />
          ) : (
            <ChatList />
          )}
        </div>

        {/* Right Column / Active Chat Area */}
        <div
          className={`h-full flex-1 flex flex-col min-h-0 overflow-hidden ${
            !activeConversation ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConversation ? (
            <ChatView />
          ) : mobileTab === 'calls' ? (
            <div className="hidden md:flex flex-1 min-h-0">
              <CallsList />
            </div>
          ) : mobileTab === 'settings' ? (
            <div className="hidden md:flex flex-1 min-h-0">
              <SettingsPage />
            </div>
          ) : (
            <ChatView />
          )}
        </div>
      </div>

      {/* Global Fullscreen Lightbox Media Viewer */}
      <MediaViewer />

      {/* Global WebRTC Voice & Video Call Modal */}
      <CallModal />
    </div>
  );
};
