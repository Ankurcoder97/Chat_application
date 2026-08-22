import React from 'react';
import { cn } from '../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && <div className="absolute left-3 text-text-tertiary flex items-center">{leftIcon}</div>}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full h-11 px-3.5 bg-surface-elevated text-text-primary text-sm rounded-lg border border-border-default transition-all placeholder:text-text-tertiary focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 disabled:opacity-50',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500',
              className
            )}
            {...props}
          />
          {rightIcon && <div className="absolute right-3 text-text-tertiary flex items-center">{rightIcon}</div>}
        </div>
        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
