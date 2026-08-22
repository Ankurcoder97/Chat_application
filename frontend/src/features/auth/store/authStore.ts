import { create } from 'zustand';
import api from '../../../shared/lib/axios';
import { User } from '../../../shared/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, username?: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  // Listen for auth expired event
  if (typeof window !== 'undefined') {
    window.addEventListener('nexus_auth_expired', () => {
      set({ user: null, isAuthenticated: false });
    });
  }

  return {
    user: null,
    isAuthenticated: !!localStorage.getItem('nexus_access_token'),
    isLoading: true,
    error: null,

    fetchCurrentUser: async () => {
      const token = localStorage.getItem('nexus_access_token');
      if (!token) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      try {
        set({ isLoading: true, error: null });
        const { data } = await api.get('/auth/me');
        set({ user: data.data, isAuthenticated: true, isLoading: false });
      } catch (err: any) {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    },

    login: async (emailOrUsername: string, password: string) => {
      try {
        set({ isLoading: true, error: null });
        const { data } = await api.post('/auth/login', { emailOrUsername, password });
        const { user, accessToken, refreshToken } = data.data;

        localStorage.setItem('nexus_access_token', accessToken);
        localStorage.setItem('nexus_refresh_token', refreshToken);

        set({ user, isAuthenticated: true, isLoading: false });
      } catch (err: any) {
        const message = err.response?.data?.error || 'Login failed. Please check your credentials.';
        set({ error: message, isLoading: false });
        throw new Error(message);
      }
    },

    register: async (name: string, email: string, password: string, username?: string, phone?: string) => {
      try {
        set({ isLoading: true, error: null });
        const { data } = await api.post('/auth/register', { name, email, password, username, phone });
        const { user, accessToken, refreshToken } = data.data;

        localStorage.setItem('nexus_access_token', accessToken);
        localStorage.setItem('nexus_refresh_token', refreshToken);

        set({ user, isAuthenticated: true, isLoading: false });
      } catch (err: any) {
        const message = err.response?.data?.error || 'Registration failed.';
        set({ error: message, isLoading: false });
        throw new Error(message);
      }
    },

    logout: async () => {
      try {
        const refreshToken = localStorage.getItem('nexus_refresh_token');
        await api.post('/auth/logout', { refreshToken });
      } catch {
        // Ignore network error on logout
      } finally {
        localStorage.removeItem('nexus_access_token');
        localStorage.removeItem('nexus_refresh_token');
        set({ user: null, isAuthenticated: false });
      }
    },

    updateProfile: async (data: Partial<User>) => {
      try {
        const res = await api.patch('/users/me', data);
        set((state) => ({
          user: state.user ? { ...state.user, ...res.data.data } : null,
        }));
      } catch (err: any) {
        throw new Error(err.response?.data?.error || 'Failed to update profile');
      }
    },
  };
});
