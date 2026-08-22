import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';
import { Lock, Mail, User as UserIcon, AtSign, Phone } from 'lucide-react';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const { register, isLoading, error } = useAuthStore();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!name.trim() || !email.trim() || !password) {
      setLocalError('Please fill in all required fields.');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long.');
      return;
    }

    try {
      await register(
        name,
        email,
        password,
        username ? username.toLowerCase() : undefined,
        phone ? phone.trim() : undefined
      );
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-3">
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold text-text-primary">Create an account</h2>
        <p className="text-sm text-text-secondary mt-1">Get started with Nexus Messaging</p>
      </div>

      {(localError || error) && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg text-xs font-medium">
          {localError || error}
        </div>
      )}

      <Input
        label="Full Name"
        type="text"
        placeholder="Sarah Connor"
        value={name}
        onChange={(e) => setName(e.target.value)}
        leftIcon={<UserIcon size={16} />}
        required
      />

      <Input
        label="Phone Number (Optional)"
        type="tel"
        placeholder="+1 555 123 4567"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        leftIcon={<Phone size={16} />}
      />

      <Input
        label="Username (Optional)"
        type="text"
        placeholder="sarahc"
        value={username}
        onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
        leftIcon={<AtSign size={16} />}
      />

      <Input
        label="Email address"
        type="email"
        placeholder="sarah@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        leftIcon={<Mail size={16} />}
        required
      />

      <Input
        label="Password (min 8 chars)"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        leftIcon={<Lock size={16} />}
        required
      />

      <Button type="submit" variant="primary" size="lg" className="w-full mt-2" isLoading={isLoading}>
        Create Account
      </Button>

      <div className="text-center pt-2">
        <p className="text-xs text-text-secondary">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-accent-500 hover:text-accent-600 font-semibold focus:outline-none"
          >
            Sign In
          </button>
        </p>
      </div>
    </form>
  );
};
