import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';
import { Lock, Mail } from 'lucide-react';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const { login, isLoading, error } = useAuthStore();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!emailOrUsername.trim() || !password) {
      setLocalError('Please enter both email/username and password.');
      return;
    }

    try {
      await login(emailOrUsername, password);
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold text-text-primary">Welcome back</h2>
        <p className="text-sm text-text-secondary mt-1">Sign in to your Nexus account</p>
      </div>

      {(localError || error) && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg text-xs font-medium">
          {localError || error}
        </div>
      )}

      <Input
        label="Email, Phone or Username"
        type="text"
        placeholder="alex@example.com, +1 555..., or @alex"
        value={emailOrUsername}
        onChange={(e) => setEmailOrUsername(e.target.value)}
        leftIcon={<Mail size={16} />}
        required
        autoFocus
      />

      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        leftIcon={<Lock size={16} />}
        required
      />

      <Button type="submit" variant="primary" size="lg" className="w-full mt-2" isLoading={isLoading}>
        Sign In
      </Button>

      <div className="text-center pt-2">
        <p className="text-xs text-text-secondary">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-accent-500 hover:text-accent-600 font-semibold focus:outline-none"
          >
            Create account
          </button>
        </p>
      </div>
    </form>
  );
};
