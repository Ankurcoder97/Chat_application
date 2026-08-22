import React from 'react';
import { cn } from '../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none';

  const variants = {
    primary: 'bg-accent-500 hover:bg-accent-600 text-white shadow-subtle',
    secondary: 'bg-surface-muted hover:bg-surface-elevated text-text-primary border border-border-default',
    ghost: 'bg-transparent hover:bg-surface-muted text-text-secondary hover:text-text-primary',
    danger: 'bg-rose-500 hover:bg-rose-600 text-white',
    icon: 'bg-transparent hover:bg-surface-muted text-text-secondary hover:text-text-primary rounded-full p-2.5 min-w-[40px] min-h-[40px]',
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
    icon: 'h-10 w-10 p-0',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : null}
      {children}
    </button>
  );
};
