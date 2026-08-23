import React, { useRef, useState } from 'react';
import { useAuthStore } from '../../auth/store/authStore';
import { useUIStore } from '../../../shared/store/uiStore';
import { Avatar } from '../../../shared/components/Avatar';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';
import api from '../../../shared/lib/axios';
import { ArrowLeft, Moon, Sun, Monitor, Shield, User as UserIcon, Check, MessageSquare, Phone, Settings as SettingsIcon, Camera, Trash2, Loader2 } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, updateProfile, logout } = useAuthStore();
  const { theme, setTheme, setMobileTab } = useUIStore();

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [showLastSeen, setShowLastSeen] = useState(user?.privacy?.showLastSeen ?? true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(user?.privacy?.showOnlineStatus ?? true);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Profile picture must be 5 MB or smaller.');
      return;
    }

    try {
      setAvatarError(null);
      setIsUploadingAvatar(true);
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await updateProfile({ avatarUrl: data.data.url });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      console.error('Failed to upload profile picture', err);
      setAvatarError('Could not upload profile picture. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setAvatarError(null);
      setIsUploadingAvatar(true);
      await updateProfile({ avatarUrl: '' });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      console.error('Failed to remove profile picture', err);
      setAvatarError('Could not remove profile picture. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await updateProfile({
        name,
        bio,
        privacy: {
          showLastSeen,
          showOnlineStatus,
        },
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      console.error('Failed to update profile', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-base select-none overflow-y-auto">
      {/* Header */}
      <div className="flex items-center space-x-3 px-4 py-3.5 border-b border-border-subtle bg-surface-elevated">
        <button
          onClick={() => setMobileTab('chats')}
          className="p-1.5 -ml-1 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-muted transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-base font-bold text-text-primary">Settings</h2>
      </div>

      <div className="max-w-xl mx-auto w-full p-4 sm:p-6 space-y-6">
        {/* Profile Card */}
        <div className="flex items-center space-x-4 p-4 bg-surface-elevated rounded-2xl border border-border-default shadow-subtle">
          <div className="relative flex-shrink-0">
            <Avatar name={user?.name || 'User'} avatarUrl={user?.avatarUrl} size="lg" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent-500 hover:bg-accent-600 text-white border-2 border-surface-elevated flex items-center justify-center shadow-subtle transition-colors disabled:opacity-60"
              title="Change profile picture"
              aria-label="Change profile picture"
            >
              {isUploadingAvatar ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-text-primary truncate">{user?.name}</h3>
            <p className="text-xs text-text-secondary">@{user?.username}</p>
            <p className="text-xs text-text-tertiary truncate">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="text-xs font-semibold text-accent-600 dark:text-accent-400 hover:underline disabled:opacity-60"
              >
                Change photo
              </button>
              {user?.avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={isUploadingAvatar}
                  className="inline-flex items-center text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-60"
                >
                  <Trash2 size={12} className="mr-1" />
                  Remove
                </button>
              )}
            </div>
            {avatarError && <p className="text-[11px] text-rose-500 mt-1">{avatarError}</p>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4 bg-surface-elevated p-4 sm:p-6 rounded-2xl border border-border-default shadow-subtle">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Edit Profile</h4>

          <Input
            label="Display Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            leftIcon={<UserIcon size={16} />}
            required
          />

          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Bio / About</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Hey there! I am using Nexus."
              rows={3}
              maxLength={150}
              className="w-full p-3 bg-surface-base text-text-primary text-sm rounded-lg border border-border-default focus:border-accent-500 focus:outline-none resize-none"
            />
            <span className="text-[10px] text-right text-text-tertiary">{bio.length}/150</span>
          </div>

          <div className="pt-2">
            <Button type="submit" variant="primary" isLoading={isLoading} className="w-full">
              {isSaved ? (
                <span className="flex items-center">
                  <Check size={16} className="mr-1.5" /> Saved Successfully
                </span>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>

        {/* Appearance Settings */}
        <div className="bg-surface-elevated p-4 sm:p-6 rounded-2xl border border-border-default shadow-subtle space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Appearance</h4>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                theme === 'light'
                  ? 'border-accent-500 bg-accent-500/10 text-accent-600 dark:text-accent-400'
                  : 'border-border-default text-text-secondary hover:bg-surface-muted'
              }`}
            >
              <Sun size={20} className="mb-1.5" />
              <span>Light</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                theme === 'dark'
                  ? 'border-accent-500 bg-accent-500/10 text-accent-600 dark:text-accent-400'
                  : 'border-border-default text-text-secondary hover:bg-surface-muted'
              }`}
            >
              <Moon size={20} className="mb-1.5" />
              <span>Dark</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('system')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                theme === 'system'
                  ? 'border-accent-500 bg-accent-500/10 text-accent-600 dark:text-accent-400'
                  : 'border-border-default text-text-secondary hover:bg-surface-muted'
              }`}
            >
              <Monitor size={20} className="mb-1.5" />
              <span>System</span>
            </button>
          </div>
        </div>

        {/* Privacy Toggles */}
        <div className="bg-surface-elevated p-4 sm:p-6 rounded-2xl border border-border-default shadow-subtle space-y-4">
          <div className="flex items-center space-x-2">
            <Shield size={16} className="text-accent-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Privacy</h4>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-text-primary">Show Online Status</span>
              <span className="text-xs text-text-secondary">Allow contacts to see when you are active</span>
            </div>
            <input
              type="checkbox"
              checked={showOnlineStatus}
              onChange={(e) => setShowOnlineStatus(e.target.checked)}
              className="w-4 h-4 accent-accent-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between py-1 border-t border-border-subtle/50 pt-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-text-primary">Show Last Seen</span>
              <span className="text-xs text-text-secondary">Display your last active timestamp</span>
            </div>
            <input
              type="checkbox"
              checked={showLastSeen}
              onChange={(e) => setShowLastSeen(e.target.checked)}
              className="w-4 h-4 accent-accent-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Sign Out Button */}
        <div className="pt-2 pb-6">
          <Button variant="danger" size="lg" className="w-full" onClick={() => logout()}>
            Sign Out
          </Button>
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <div className="flex items-center justify-around py-2 bg-surface-elevated border-t border-border-subtle flex-shrink-0">
        <button
          onClick={() => setMobileTab('chats')}
          className="flex flex-col items-center space-y-1 py-1 px-4 text-text-tertiary hover:text-text-primary transition-colors"
        >
          <MessageSquare size={20} />
          <span className="text-[10px]">Chats</span>
        </button>

        <button
          onClick={() => setMobileTab('calls')}
          className="flex flex-col items-center space-y-1 py-1 px-4 text-text-tertiary hover:text-text-primary transition-colors"
        >
          <Phone size={20} />
          <span className="text-[10px]">Calls</span>
        </button>

        <button
          onClick={() => setMobileTab('settings')}
          className="flex flex-col items-center space-y-1 py-1 px-4 text-accent-500 font-semibold transition-colors"
        >
          <SettingsIcon size={20} />
          <span className="text-[10px]">Settings</span>
        </button>
      </div>
    </div>
  );
};
