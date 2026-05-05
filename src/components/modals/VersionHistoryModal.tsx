import React, { useState, useMemo } from 'react';
import { X, Clock, RotateCcw } from 'lucide-react';
import { Snapshot } from '../../types';
import { diffLines } from 'diff';
import { ConfirmModal } from './ConfirmModal';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  revisions: Snapshot[];
  currentContent: string;
  onRestore: (snapshot: Snapshot) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  revisions,
  currentContent,
  onRestore
}) => {
  const [selectedRevId, setSelectedRevId] = useState<string | null>(null);
  const [compareTargetId, setCompareTargetId] = useState<string | 'current'>('current');
  const [confirmState, setConfirmState] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({isOpen: false, message: '', onConfirm: () => {}});

  const selectedRev = useMemo(() => 
    revisions.find(r => r.id === selectedRevId) || (revisions.length > 0 ? revisions[0] : null)
  , [revisions, selectedRevId]);

  const diffResult = useMemo(() => {
    if (!selectedRev) return null;
    const targetContent = compareTargetId === 'current' 
      ? currentContent 
      : revisions.find(r => r.id === compareTargetId)?.markdown || currentContent;
    // Compare old (selectedRev) to new (targetContent)
    return diffLines(selectedRev.markdown, targetContent);
  }, [selectedRev, currentContent, compareTargetId, revisions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-hld-surface rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] border border-slate-200 dark:border-hld-border flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-hld-border flex justify-between items-center bg-slate-50 dark:bg-hld-surface2">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-hld-text flex items-center gap-2 font-sans">
              <Clock size={18} className="text-indigo-500 dark:text-hld-cyan" /> Version History
            </h3>
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 dark:text-hld-muted mt-1">
              Review previous saves and restore older versions.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 dark:text-hld-muted hover:text-slate-600 dark:hover:text-hld-text p-2 rounded-full hover:bg-slate-200 dark:hover:bg-hld-border transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - List of Revisions */}
          <div className="w-64 border-r border-slate-200 dark:border-hld-border bg-slate-50/50 dark:bg-hld-bg overflow-y-auto p-3 space-y-2">
            {revisions.length === 0 ? (
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 dark:text-hld-muted p-4 text-center">
                No saved versions yet. Manually save the document to create a version.
              </div>
            ) : (
              revisions.map((rev, index) => {
                const isSelected = (selectedRevId === rev.id) || (!selectedRevId && index === 0);
                return (
                  <button
                    key={rev.id}
                    onClick={() => setSelectedRevId(rev.id)}
                    className={`w-full text-left p-3 rounded-lg text-sm transition-all border ${
                      isSelected 
                        ? 'bg-indigo-50 dark:bg-hld-cyan/10 border-indigo-200 dark:border-hld-cyan text-indigo-900 dark:text-hld-cyan' 
                        : 'bg-white dark:bg-hld-surface border-transparent hover:border-slate-300 dark:hover:border-hld-border text-slate-700 dark:text-hld-text shadow-sm'
                    }`}
                  >
                    <div className="font-semibold font-mono text-xs flex justify-between items-center">
                      <span>{new Date(rev.timestamp).toLocaleString()}</span>
                      {rev.trigger && <span className="opacity-50 text-[8px] uppercase">{rev.trigger}</span>}
                    </div>
                    <div className="text-[10px] font-mono opacity-70 truncate mt-1 text-slate-500 dark:text-hld-muted">{rev.markdown.slice(0, 40)}...</div>
                  </button>
                );
              })
            )}
          </div>

          {/* Main Diff Area */}
          <div className="flex-1 flex flex-col bg-white dark:bg-hld-bg overflow-hidden">
            {selectedRev ? (
              <>
                <div className="p-3 border-b border-slate-200 dark:border-hld-border flex justify-between items-center bg-slate-50 dark:bg-hld-surface2">
                  <div className="text-[10px] font-mono uppercase tracking-widest font-medium text-slate-600 dark:text-hld-muted flex items-center gap-2">
                    Comparing: 
                    <span className="text-rose-600 dark:text-hld-magenta font-semibold bg-rose-50 dark:bg-hld-magenta/10 px-2 py-0.5 rounded border border-rose-200 dark:border-hld-magenta/30">
                      Version ({new Date(selectedRev.timestamp).toLocaleString()})
                    </span> 
                    <span>vs</span> 
                    <select
                      value={compareTargetId}
                      onChange={(e) => setCompareTargetId(e.target.value)}
                      className="text-emerald-600 dark:text-hld-green font-semibold bg-emerald-50 dark:bg-hld-green/10 px-2 py-0.5 rounded border border-emerald-200 dark:border-hld-green/30 outline-none cursor-pointer"
                    >
                      <option value="current">Current Draft</option>
                      {revisions.filter(r => r?.id !== selectedRev.id).map(r => (
                        <option key={r.id} value={r.id}>
                          Version ({new Date(r.timestamp).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => {
                        setConfirmState({
                          isOpen: true,
                          message: "Are you sure you want to restore this version? Current unsaved changes will be lost.",
                          onConfirm: () => {
                            onRestore(selectedRev);
                            setConfirmState(prev => ({ ...prev, isOpen: false }));
                            onClose();
                          }
                        });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-hld-cyan hover:bg-indigo-700 dark:hover:bg-hld-cyan/80 text-white dark:text-hld-bg rounded-md text-[10px] font-mono uppercase tracking-widest font-bold shadow-sm transition-all active:scale-95 hld-glow-cyan"
                  >
                    <RotateCcw size={16} /> Restore This Version
                  </button>
                </div>
                
                {/* Diff Viewer */}
                <div className="flex-1 overflow-y-auto p-6 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                  {diffResult?.map((part, index) => (
                    <span
                      key={index}
                      className={`${
                        part.added 
                          ? 'bg-emerald-100 dark:bg-hld-green/20 text-emerald-900 dark:text-hld-green px-1 rounded' 
                          : part.removed 
                            ? 'bg-rose-100 dark:bg-hld-magenta/20 text-rose-900 dark:text-hld-magenta line-through opacity-70 px-1 rounded' 
                            : 'text-slate-800 dark:text-hld-muted'
                      }`}
                    >
                      {part.value}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-hld-muted text-[10px] font-mono uppercase tracking-widest">
                Select a version from the sidebar to view changes.
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
