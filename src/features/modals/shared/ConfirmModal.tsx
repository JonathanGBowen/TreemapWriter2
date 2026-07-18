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
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-hld-bg/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-hld-surface border border-hld-cyan/30 rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col items-center p-6 mx-4">
        <div className="w-12 h-12 rounded-full bg-hld-yellow/20 flex items-center justify-center mb-4">
          <AlertCircle className="text-hld-yellow shrink-0" size={24} />
        </div>
        <h3 className="text-hld-text font-bold text-lg mb-2 text-center uppercase tracking-wider font-mono">Confirm Action</h3>
        <p className="text-hld-muted text-sm text-center mb-6">{message}</p>
        <div className="flex w-full gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-2 px-4 border border-hld-surface-2 text-hld-muted hover:bg-hld-surface-2 rounded font-mono uppercase tracking-wider text-xs transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 py-2 px-4 bg-hld-yellow hover:bg-hld-yellow/80 text-black rounded font-mono uppercase tracking-wider text-xs transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
