import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ isOpen, message, onConfirm, onCancel }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 dark:bg-[#05090d]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-hld-surface border border-slate-200 dark:border-hld-cyan/30 rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col items-center p-6 mx-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-hld-magenta/20 flex items-center justify-center mb-4">
          <AlertCircle className="text-rose-600 dark:text-hld-magenta shrink-0" size={24} />
        </div>
        <h3 className="text-slate-800 dark:text-hld-text font-bold text-lg mb-2 text-center uppercase tracking-wider font-mono">Confirm Action</h3>
        <p className="text-slate-500 dark:text-hld-muted text-sm text-center mb-6">{message}</p>
        <div className="flex w-full gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-2 px-4 border border-slate-300 dark:border-hld-surface2 text-slate-700 dark:text-hld-muted hover:bg-slate-50 dark:hover:bg-hld-surface2 rounded font-mono uppercase tracking-wider text-xs transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-700 dark:bg-hld-magenta dark:hover:bg-hld-magenta/80 text-white rounded font-mono uppercase tracking-wider text-xs transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
