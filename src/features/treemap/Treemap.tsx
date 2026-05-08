import React, { useEffect, useMemo } from "react";
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
import { Section, TestSuite } from "../../types";
import { flattenTree } from "../../lib/utils";

const Plot = createPlotlyComponent(Plotly);

interface TreemapProps {
  sections: Section[];
  onSelect: (id: string) => void;
  selectedId: string;
  isDarkMode: boolean;
  hiddenSectionIds: string[];
  testSuite: TestSuite;
}

export const Treemap: React.FC<TreemapProps> = ({ 
  sections, 
  onSelect, 
  selectedId, 
  isDarkMode,
  hiddenSectionIds = [], 
  testSuite
}) => {
  // Filter the sections tree based on hidden IDs
  // We use a recursive filter to exclude nodes (and implicitly their children if the parent is removed)
  const filteredSections = useMemo(() => {
    const idsToHide = hiddenSectionIds || []; // Defensive check
    const filterNodes = (nodes: Section[]): Section[] => {
      return nodes
        .filter(node => !idsToHide.includes(node.id))
        .map(node => ({
          ...node,
          children: filterNodes(node.children)
        }));
    };
    return filterNodes(sections);
  }, [sections, hiddenSectionIds]);

  // Memoize data to prevent unnecessary re-calculations
  const plotData = useMemo(() => {
    if (filteredSections.length === 0) return [];

    const flatData = flattenTree(filteredSections);
    
    // Calculate total for root based on FILTERED sections
    const totalWordCount = filteredSections.reduce((acc, s) => acc + s.wordCount, 0);
    
    // Construct IDs array to map colors accurately
    const ids = ['root', ...flatData.map(d => d.id)];

    // Create parent map for inheritance
    const parentMap = new Map<string, string>();
    flatData.forEach(d => parentMap.set(d.id, d.parent));

    const checkIsBlocked = (nodeId: string): boolean => {
      let currentId = nodeId;
      while (currentId && currentId !== 'root') {
        const dependencies = testSuite[currentId]?.dependencies || [];
        const blockedByOwnDeps = dependencies.some(dep => {
            if (dep.type === 'reference') return false; // References don't block
            const depStatus = testSuite[dep.id]?.status;
            return depStatus !== 'success';
        });
        if (blockedByOwnDeps) return true;
        
        currentId = parentMap.get(currentId) || '';
      }
      return false;
    };

    // Color & Border Logic
    const colors: string[] = [];
    const lineColors: string[] = [];
    const lineWidths: number[] = [];
    const fontColors: string[] = [];

    ids.forEach(id => {
      if (id === 'root') {
        colors.push(isDarkMode ? '#05090d' : '#f8fafc');
        lineColors.push(isDarkMode ? '#0c1520' : '#f8fafc');
        lineWidths.push(0);
        fontColors.push(isDarkMode ? '#ffffff' : '#000000');
        return;
      }

      const status = testSuite[id]?.status;
      const isBlocked = checkIsBlocked(id);

      let bgColor = '';
      let lineColor = '';
      let lineWidth = 2;

      if (isBlocked) {
        // Blocked: Gray/Slate with a distinct look
        bgColor = isDarkMode ? '#111d2b' : '#e2e8f0'; // hld-surface2 / slate-200
        lineColor = isDarkMode ? '#1e293b' : '#cbd5e1'; // Neutral border
        lineWidth = 1;
      } else if (status === 'stale') {
        bgColor = isDarkMode ? 'rgba(255,230,0,0.09)' : '#fbbf24'; // tc-2 yellow dim
        lineColor = isDarkMode ? 'rgba(255,230,0,0.6)' : '#f59e0b';
        lineWidth = 2;
      } else if (status === 'fail') {
        bgColor = isDarkMode ? 'rgba(255,16,96,0.08)' : '#fb7185'; // tc-3 mag dim
        lineColor = isDarkMode ? 'rgba(255,16,96,0.7)' : '#f43f5e';
        lineWidth = 2;
      } else if (status === 'running') {
        bgColor = isDarkMode ? 'rgba(170,0,255,0.06)' : '#60a5fa'; // tc-6 purple dim
        lineColor = isDarkMode ? 'rgba(170,0,255,0.7)' : '#8b5cf6';
        lineWidth = 2;
      } else if (status === 'success') {
        const readiness = testSuite[id]?.lastDiagnostic?.overallReadiness;
        
        if (readiness === 'draft') {
          // Draft: Look unfinished, muted red/magenta bg, thin distinct border
          bgColor = isDarkMode ? 'rgba(255,16,96,0.03)' : '#fff1f2';
          lineColor = isDarkMode ? 'rgba(255,16,96,0.4)' : '#fda4af';
          lineWidth = 1;
        } else if (readiness === 'developing') {
          // Developing: Amber/yellow, slightly thicker border
          bgColor = isDarkMode ? 'rgba(255,230,0,0.05)' : '#fffbeb';
          lineColor = isDarkMode ? 'rgba(255,230,0,0.6)' : '#fcd34d';
          lineWidth = 2;
        } else if (readiness === 'nearly-there') {
          // Nearly There: Cyan/blue, thicker confident border
          bgColor = isDarkMode ? 'rgba(0,232,245,0.1)' : '#e0f2fe';
          lineColor = isDarkMode ? 'rgba(0,232,245,0.7)' : '#7dd3fc';
          lineWidth = 3;
        } else if (readiness === 'solid') {
          // Solid: Bright Green, strong thick border
          bgColor = isDarkMode ? 'rgba(0,232,112,0.15)' : '#d1fae5';
          lineColor = isDarkMode ? 'rgba(0,232,112,0.9)' : '#10b981';
          lineWidth = 4;
        } else {
          // Fallback (e.g. legacy test result without diagnostic)
          bgColor = isDarkMode ? 'rgba(0,232,112,0.12)' : '#34d399';
          lineColor = isDarkMode ? 'rgba(0,232,112,0.7)' : '#34d399';
          lineWidth = 2;
        }
      } else {
        // Default Neutral Colors
        bgColor = isDarkMode ? 'rgba(0,232,245,0.05)' : '#cbd5e1'; // tc-5 cyan dim
        lineColor = isDarkMode ? '#0c1520' : '#f8fafc';
        lineWidth = 2;
      }

      let fontColor = isDarkMode ? '#f8fafc' : '#0f172a';

      // Highlight selected node (HLD Focus Mode)
      if (selectedId && id !== 'root') {
        if (id === selectedId) {
          // ACTIVE FOCUS
          lineColor = isDarkMode ? '#00e8f5' : '#0284c7'; // HLD Cyan
          lineWidth = 4;
          if (bgColor.startsWith('rgba')) {
            bgColor = bgColor.replace(/[\d.]+\)$/, '0.35)');
          } else {
            bgColor = isDarkMode ? 'rgba(0, 232, 245, 0.25)' : 'rgba(2, 132, 199, 0.2)';
          }
          fontColor = isDarkMode ? '#ffffff' : '#000000';
        } else {
          // DIMMED BACKGROUND
          lineWidth = 1;
          if (bgColor.startsWith('rgba')) {
            bgColor = bgColor.replace(/[\d.]+\)$/, '0.015)');
          } else {
            bgColor = isDarkMode ? 'rgba(255,255,255,0.005)' : 'rgba(0,0,0,0.015)';
          }
          
          if (lineColor.startsWith('rgba')) {
            lineColor = lineColor.replace(/[\d.]+\)$/, '0.1)');
          } else {
            lineColor = isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)';
          }
          fontColor = isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)';
        }
      }

      colors.push(bgColor);
      lineColors.push(lineColor);
      lineWidths.push(lineWidth);
      fontColors.push(fontColor);
    });

      // Add root node for context
    return [{
      type: "treemap",
      sort: false, // DISABLE SORTING to preserve Markdown reading order
      ids: ids,
      labels: ['Dissertation', ...flatData.map(d => d.label.length > 25 ? d.label.substring(0, 22).trim() + '...' : d.label)],
      customdata: ['', ...flatData.map(d => d.label)],
      parents: ['', ...flatData.map(d => d.parent)],
      values: [Math.max(1, totalWordCount), ...flatData.map(d => d.value)], // Ensure at least 1
      text: [`${totalWordCount} words`, ...flatData.map(d => `${d.value} words`)],
      textinfo: "label+text",
      hoverinfo: "label+text",
      hovertemplate: "<b>%{customdata}</b><br>%{text}<extra></extra>",
      textfont: { color: fontColors, family: '"JetBrains Mono", monospace' },
      marker: {
        colors: colors,
        line: { width: lineWidths, color: lineColors },
        depthfade: false // Disable depthfade to ensure status colors are distinct
      },
      pathbar: {visible: false},
      branchvalues: "total",
      tiling: {
        packing: "squarify",
        pad: 4
      }
    }];
  }, [filteredSections, isDarkMode, testSuite, selectedId]);

  const layout = useMemo(() => ({
    margin: { t: 0, l: 0, r: 0, b: 0 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: {
      family: 'JetBrains Mono, monospace', // HLD prefers mono for data
      color: isDarkMode ? '#c5d8e8' : '#334155' // hld-text / slate-700
    },
    autosize: true
  }), [isDarkMode]);

  const config = { responsive: true, displayModeBar: false };

  const onClick = (e: any) => {
    if (e.points && e.points.length > 0) {
      const point = e.points[0];
      const id = point.id;
      if (id && id !== 'root') {
        onSelect(id);
      }
    }
  };

  if (filteredSections.length === 0) {
     return <div className="flex items-center justify-center h-full text-slate-400 dark:text-hld-muted text-[10px] font-mono uppercase tracking-widest px-4 text-center">No visible sections. Adjust filters or content.</div>;
  }

  return (
    <div className="w-full h-full min-h-[300px]">
      <Plot
        data={plotData as any}
        layout={layout}
        config={config}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        onClick={onClick}
      />
    </div>
  );
};
