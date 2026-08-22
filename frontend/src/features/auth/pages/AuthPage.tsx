import React, { useState } from 'react';
import { LoginForm } from '../components/LoginForm';
import { RegisterForm } from '../components/RegisterForm';
import { MessageSquare } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-surface-base sm:bg-surface-muted">
      <div className="w-full max-w-md bg-surface-elevated sm:border sm:border-border-default rounded-3xl p-6 sm:p-8 sm:shadow-elevated">
        {/* Brand Header */}
        <div className="flex items-center justify-center space-x-2.5 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent-500 flex items-center justify-center text-white shadow-subtle">
            <MessageSquare size={22} className="fill-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-text-primary">Nexus</span>
        </div>

        {isLogin ? (
          <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
        ) : (
          <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
        )}
      </div>

      <footer className="mt-8 text-center text-xs text-text-tertiary">
        Nexus Messaging &copy; {new Date().getFullYear()} &middot; Privacy & Security First
      </footer>
    </div>
  );
};
