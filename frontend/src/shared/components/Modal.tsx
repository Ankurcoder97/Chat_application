import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={onClose} />

      {/* Dialog */}
      <div
        className={cn(
          'relative w-full max-w-md bg-surface-elevated rounded-2xl border border-border-default shadow-elevated overflow-hidden z-10 flex flex-col',
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
            <h3 className="text-base font-semibold text-text-primary">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-text-tertiary hover:text-text-primary hover:bg-surface-muted transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-5 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </div>
  );
};
