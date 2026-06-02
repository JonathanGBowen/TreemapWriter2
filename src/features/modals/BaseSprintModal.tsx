import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Clock, FileText, Play } from 'lucide-react';
import { Section, TestSuite } from '../../types';
import { useStore } from '../../store';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { GFM, Table } from '@lezer/markdown';
import { hldExtensions, hldTheme } from '../../lib/editorTheme';
import { livePreviewPlugin } from '../../lib/livePreview';
import { EditorView, keymap, drawSelection, highlightSpecialChars, dropCursor, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import { indentOnInput, bracketMatching, foldKeymap } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';

const manualBasicSetup = [
  highlightSpecialChars(),
  history(),
  drawSelection(),
  dropCursor(),
  EditorView.lineWrapping,
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    indentWithTab
  ])
];

function flattenSections(sections: Section[]): Section[] {
  const result: Section[] = [];
  function traverse(nodes: Section[]) {
    nodes.forEach(n => {
      result.push(n);
      traverse(n.children);
    });
  }
  traverse(sections);
  return result;
}

export interface SprintModalProps {
  sections: Section[];
  testSuite: TestSuite;
  mode: 'goal' | 'content';
  onSaveContent?: (id: string, content: string) => void;
  onSaveGoal?: (id: string, goal: string, type: 'manual') => void;
}

export function SprintModal({ sections, testSuite, mode, onSaveContent, onSaveGoal }: SprintModalProps) {
  const showGoal = useStore(s => s.showGoalSprintModal);
  const setShowGoal = useStore(s => s.setShowGoalSprintModal);
  const showContent = useStore(s => s.showContentSprintModal);
  const setShowContent = useStore(s => s.setShowContentSprintModal);
  const isOpen = mode === 'goal' ? showGoal : showContent;
  const onClose = () => (mode === 'goal' ? setShowGoal(false) : setShowContent(false));
  const flattenedSections = flattenSections(sections);
  
  const [isStarted, setIsStarted] = useState(false);
  const [timeLimit, setTimeLimit] = useState<number>(0); // 0 = untimed, defaults to 0
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  
  const currentSection = flattenedSections[currentIndex];
  const totalSections = flattenedSections.length;
  
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const handleNextRef = useRef<() => void>(() => {});

  // Theme config based on mode
  const theme = mode === 'content' ? {
    color: 'amber',
    Icon: FileText,
    title: 'Content Sprint',
    description: 'Quickly iterate through your sections and draft or edit their main content.',
    bgBorder: 'border-amber-500/30',
    shadow: 'shadow-[0_0_40px_rgba(245,158,11,0.1)]',
    titleGradient: 'from-amber-400 to-orange-500',
    btnPrimaryMode: 'bg-amber-500/10 border-amber-500 text-amber-500 hover:bg-amber-500/20 hover:shadow-[0_0_15px_rgba(245,158,11,0.4)] focus:ring-amber-500',
    progressBg: 'bg-amber-500',
    progressShadow: '0 0 10px rgba(245,158,11,0.5)',
    textColor: 'text-amber-500',
    borderColor: 'border-amber-500/10',
    focusBorder: 'focus-within:border-amber-500/30',
    timeValues: [
      { label: 'Fast Draft', desc: '1 minute per section. Auto-advances.', val: 60, colorClass: 'hover:border-orange-500/50', iconColor: 'group-hover:text-orange-400', textColor: 'group-hover:text-orange-400' },
      { label: 'Deep Write', desc: '3 minutes per section. Auto-advances.', val: 180, colorClass: 'hover:border-rose-500/50', iconColor: 'group-hover:text-rose-400', textColor: 'group-hover:text-rose-400' }
    ]
  } : {
    color: 'cyan',
    Icon: Play,
    title: 'Goal Sprint',
    description: 'Quickly iterate through your sections and define their core goals.',
    bgBorder: 'border-[rgba(0,232,245,0.3)]',
    shadow: 'shadow-[0_0_40px_rgba(0,232,245,0.1)]',
    titleGradient: 'from-emerald-400 to-cyan-500',
    btnPrimaryMode: 'bg-hld-cyan/10 border-hld-cyan text-hld-cyan hover:bg-hld-cyan/20 hover:shadow-[0_0_15px_rgba(0,232,245,0.4)] focus:ring-hld-cyan',
    progressBg: 'bg-hld-cyan',
    progressShadow: '0 0 10px rgba(0,232,245,0.5)',
    textColor: 'text-hld-cyan',
    borderColor: 'border-[rgba(0,232,245,0.1)]',
    focusBorder: 'focus-within:border-hld-cyan/30',
    timeValues: [
      { label: 'Lightning Sprint', desc: '30 seconds per section. Auto-advances.', val: 30, colorClass: 'hover:border-hld-cyan/50', iconColor: 'group-hover:text-cyan-400', textColor: 'group-hover:text-cyan-400' },
      { label: 'Deep Sprint', desc: '60 seconds per section. Auto-advances.', val: 60, colorClass: 'hover:border-indigo-500/50', iconColor: 'group-hover:text-indigo-400', textColor: 'group-hover:text-indigo-400' }
    ]
  };

  useEffect(() => {
    if (isOpen) {
      if (!isStarted) {
        setCurrentIndex(0);
      }
    } else {
      setIsStarted(false);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (currentSection) {
      if (mode === 'content' && onSaveContent) {
        onSaveContent(currentSection.id, currentText);
      } else if (mode === 'goal' && onSaveGoal) {
        onSaveGoal(currentSection.id, currentText, 'manual');
      }
    }
    
    if (currentIndex < totalSections - 1) {
      setCurrentIndex(prev => prev + 1);
      if (timeLimit > 0) {
        setTimeLeftMs(timeLimit * 1000); // Reset timer
      }
    } else {
      onClose();
      setIsStarted(false);
      setCurrentIndex(0);
    }
  };

  handleNextRef.current = handleNext;

  useEffect(() => {
    if (!isOpen || !isStarted || timeLimit === 0) return;
    
    const interval = 50; 
    const tick = () => {
      setTimeLeftMs(prev => {
        if (prev <= interval) {
          handleNextRef.current();
          return timeLimit * 1000;
        }
        return prev - interval;
      });
    };
    
    const timerId = setInterval(tick, interval);
    return () => clearInterval(timerId);
  }, [isOpen, isStarted, timeLimit, currentIndex, mode]);

  useEffect(() => {
    if (isOpen && isStarted && currentSection) {
      if (mode === 'content') {
         setCurrentText(currentSection.content);
      } else {
         const existingGoal = testSuite[currentSection.id]?.goals || testSuite[currentSection.id]?.spec?.mainClaim || '';
         setCurrentText(existingGoal);
      }
      
      // Auto focus the editor
      setTimeout(() => {
        if (cmRef.current?.view) {
          cmRef.current.view.focus();
        }
      }, 50);
    }
  }, [isOpen, isStarted, currentIndex, currentSection, mode, testSuite]);

  if (!isOpen || totalSections === 0) return null;

  const progress = ((currentIndex) / totalSections) * 100;
  const timeProgress = timeLimit > 0 ? (timeLeftMs / (timeLimit * 1000)) * 100 : 100;
  
  const mm = Math.floor(timeLeftMs / 60000);
  const ss = Math.floor((timeLeftMs % 60000) / 1000);
  const msStr = (Math.floor((timeLeftMs % 1000) / 10)).toString().padStart(2, '0');
  const timerText = `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}.${msStr}`;

  if (!isStarted) {
    return (
      <div className="fixed inset-0 bg-[#0A0D15]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 isolate">
        <div className={`relative w-full max-w-lg bg-[#121620] border ${theme.bgBorder} ${theme.shadow} rounded-lg overflow-hidden flex flex-col p-8`}>
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className={`text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${theme.titleGradient} flex items-center gap-2`}>
                <theme.Icon size={24} className={theme.textColor} />
                {theme.title}
              </h2>
              <p className="text-gray-400 text-sm mt-2">
                {theme.description.replace('sections', `${totalSections} sections`)}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>
          
          <div className="space-y-4 mb-8">
            <button 
              onClick={() => { setTimeLimit(0); setTimeLeftMs(0); setIsStarted(true); }}
              className={`w-full text-left p-4 rounded bg-[#1A1F2D] border border-gray-700 hover:${theme.bgBorder} hover:bg-[#1f2638] transition-all group`}
            >
              <div className={`font-bold text-gray-200 hover:${theme.textColor}`}>{mode === 'content' ? 'Untimed Session' : 'Untimed Session'}</div>
              <div className="text-xs text-gray-500 mt-1">Take as much time as you need for each section.</div>
            </button>
            
            {theme.timeValues.map((tv, idx) => (
              <button 
                key={idx}
                onClick={() => { setTimeLimit(tv.val); setTimeLeftMs(tv.val * 1000); setIsStarted(true); }}
                className={`w-full text-left p-4 rounded bg-[#1A1F2D] border border-gray-700 hover:bg-[#1f2638] ${tv.colorClass} transition-all flex justify-between items-center group`}
              >
                <div>
                  <div className={`font-bold text-gray-200 ${tv.textColor}`}>{tv.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{tv.desc}</div>
                </div>
                <Clock size={20} className={`text-gray-600 ${tv.iconColor}`} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0A0D15]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 isolate">
      <div className={`relative w-full max-w-4xl bg-[#121620] border ${theme.bgBorder} ${theme.shadow} rounded-lg overflow-hidden flex flex-col h-[85vh] min-h-[500px]`}>
        
        <div className="h-1 bg-[#1A1F2D] w-full">
          <div 
            className={`h-full transition-all duration-300 ${theme.progressBg}`}
            style={{ width: `${progress}%`, boxShadow: theme.progressShadow }} 
          />
        </div>
        
        {timeLimit > 0 && (
          <div className="h-1 bg-red-900/50 w-full absolute top-1 left-0 z-10">
            <div 
              className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
              style={{ width: `${timeProgress}%` }} 
            />
          </div>
        )}

        <div className={`p-4 flex items-center justify-between border-b ${theme.borderColor}`}>
          <div className="flex flex-col">
            <span className={`text-[10px] font-mono uppercase tracking-[0.2em] ${theme.textColor} opacity-70`}>
              {theme.title} mode
            </span>
            <span className="text-sm font-mono text-gray-400 mt-1">
              {currentIndex + 1} of {totalSections}
            </span>
          </div>
          
          {timeLimit > 0 && (
             <div className="font-mono text-2xl tracking-widest text-red-400 font-bold" style={{ textShadow: '0 0 10px rgba(248, 113, 113, 0.5)' }}>
                {timerText}
             </div>
          )}
          
          <button 
            onClick={() => {
              if (currentSection) {
                 if (mode === 'content' && currentText !== currentSection.content && onSaveContent) {
                   onSaveContent(currentSection.id, currentText);
                 } else if (mode === 'goal' && onSaveGoal && currentText !== (testSuite[currentSection.id]?.goals || '')) {
                   onSaveGoal(currentSection.id, currentText, 'manual');
                 }
              }
              onClose();
              setIsStarted(false);
            }}
            className={`${theme.textColor} opacity-50 hover:opacity-100 p-2 transition-opacity focus:outline-none focus:bg-white/5`}
            title="Exit Sprint"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex flex-col p-8 overflow-hidden gap-4">
          
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              {currentSection.title}
            </h2>
            {mode === 'content' && testSuite[currentSection.id]?.goals && (
              <div className="text-amber-500/80 text-sm font-mono p-3 bg-amber-500/5 rounded border border-amber-500/10">
                <span className="font-bold opacity-75 uppercase tracking-wider text-[10px] mr-2">Goal:</span>
                {testSuite[currentSection.id].goals}
              </div>
            )}
          </div>

          <div className={`flex-1 flex flex-col relative group overflow-hidden border border-transparent rounded bg-[#0A0D15] ${theme.focusBorder} transition-colors`}>
            <CodeMirror
              ref={cmRef}
              value={currentText}
              onChange={setCurrentText}
              extensions={[
                markdown({ 
                  base: markdownLanguage, 
                  codeLanguages: languages, 
                  addKeymap: false,
                  extensions: [Table, GFM]
                }), 
                ...hldExtensions, 
                ...manualBasicSetup,
                livePreviewPlugin,
                keymap.of([
                  {
                    key: "Mod-Enter",
                    run: () => {
                      handleNextRef.current();
                      return true;
                    }
                  }
                ])
              ]}
              theme={hldTheme}
              height="100%"
              className="h-full w-full [&>div]:h-full font-mono text-lg"
              autoFocus
              basicSetup={false}
            />
            
            <div className="absolute bottom-4 right-4 flex items-center gap-4 z-10 pointer-events-none font-mono text-[10px]">
              {mode === 'goal' ? (
                <span className={`transition-colors bg-[#0A0D15]/80 px-2 py-1 rounded backdrop-blur-sm ${currentText.length >= 280 ? 'text-red-400' : 'text-gray-500'}`}>
                  {currentText.length} / 280
                </span>
              ) : (
                <span className="transition-colors text-gray-500 bg-[#0A0D15]/80 px-2 py-1 rounded backdrop-blur-sm">
                  {currentText.split(/\s+/).filter(w=>w.length>0).length} words
                </span>
              )}
              <span className={`opacity-50 ${theme.textColor} bg-[#0A0D15]/80 px-2 py-1 rounded backdrop-blur-sm`}>Cmd/Ctrl + Enter to advance</span>
            </div>
          </div>

        </div>

        <div className={`p-4 border-t ${theme.borderColor} flex justify-between items-center bg-[#0D1018]`}>
          <button
             onClick={() => {
              if (currentSection) {
                 if (mode === 'content' && currentText !== currentSection.content && onSaveContent) {
                   onSaveContent(currentSection.id, currentText);
                 } else if (mode === 'goal' && onSaveGoal && currentText !== (testSuite[currentSection.id]?.goals || '')) {
                   onSaveGoal(currentSection.id, currentText, 'manual');
                 }
              }
              onClose();
              setIsStarted(false);
            }}
            className="text-xs font-mono text-gray-500 hover:text-gray-300 px-4 py-2 uppercase tracking-wider"
          >
            Done for now
          </button>

          <button
            onClick={handleNext}
            className={`hld-btn ${theme.btnPrimaryMode} px-8 py-3 font-mono text-xs uppercase tracking-[0.1em] flex items-center gap-2 transition-all group focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-[#121620]`}
          >
            <span>{currentIndex < totalSections - 1 ? 'Next Section' : 'Finish'}</span>
            <Check size={16} className="opacity-70 group-hover:opacity-100" />
          </button>
        </div>
        
      </div>
    </div>
  );
}
