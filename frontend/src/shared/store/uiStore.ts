import { create } from 'zustand';
import { MediaPayload } from '../types';

export type ThemeMode = 'light' | 'dark' | 'system';
export type MobileTab = 'chats' | 'search' | 'settings';

interface UIState {
  theme: ThemeMode;
  mobileTab: MobileTab;
  activeMedia: MediaPayload | null;
  setTheme: (theme: ThemeMode) => void;
  setMobileTab: (tab: MobileTab) => void;
  setActiveMedia: (media: MediaPayload | null) => void;
}

const getInitialTheme = (): ThemeMode => {
  const saved = localStorage.getItem('nexus_theme') as ThemeMode;
  if (saved && ['light', 'dark', 'system'].includes(saved)) {
    return saved;
  }
  return 'system';
};

export const useUIStore = create<UIState>((set) => ({
  theme: getInitialTheme(),
  mobileTab: 'chats',
  activeMedia: null,

  setTheme: (theme) => {
    localStorage.setItem('nexus_theme', theme);
    set({ theme });

    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  },

  setMobileTab: (mobileTab) => set({ mobileTab }),
  setActiveMedia: (activeMedia) => set({ activeMedia }),
}));
