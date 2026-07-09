/* eslint-disable no-restricted-syntax -- tile/line/font colours are passed to
   Plotly as trace properties (rendered into SVG attributes), where CSS `var()`
   does not resolve; they must be literal hex. They mirror the @theme tokens. */
import React, { useEffect, useMemo } from "react";
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponentImport from 'react-plotly.js/factory';
import { Section, TestSuite } from "../../types";
import { flattenTree } from "../../lib/utils";
import { magnitudeBand, roundedCount } from "../../lib/magnitude";
import { summarizeReadiness } from "../tests-panel/diagnostic-config";

// `react-plotly.js/factory` is a CommonJS module (module.exports.default = factory).
// Under Vite 8's Rolldown bundler a default import can resolve to the module
// namespace object instead of the function, so unwrap `.default` defensively.
const createPlotlyComponent: (plotly: typeof Plotly) => React.ComponentType<any> =
  typeof createPlotlyComponentImport === 'function'
    ? (createPlotlyComponentImport as any)
    : (createPlotlyComponentImport as any).default;

const Plot = createPlotlyComponent(Plotly);

interface TreemapProps {
  sections: Section[];
  onSelect: (id: string) => void;
  selectedId: string;
  hiddenSectionIds: string[];
  testSuite: TestSuite;
  /** Section ids matching the active search; highlighted distinctly. Optional —
   *  only the sidebar treemap passes it, so other usages are unaffected. */
  matchedIds?: Set<string>;
}

export const Treemap: React.FC<TreemapProps> = ({
  sections,
  onSelect,
  selectedId,
  hiddenSectionIds = [],
  testSuite,
  matchedIds,
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
        colors.push('#05090d');
        lineColors.push('#0c1520');
        lineWidths.push(0);
        fontColors.push('#ffffff');
        return;
      }

      const status = testSuite[id]?.status;
      const isBlocked = checkIsBlocked(id);

      let bgColor = '';
      let lineColor = '';
      let lineWidth = 2;

      if (isBlocked) {
        // Blocked: Gray/Slate with a distinct look
        bgColor = '#111d2b'; // hld-surface-2 / slate-200
        lineColor = '#1e293b'; // Neutral border
        lineWidth = 1;
      } else if (status === 'stale') {
        bgColor = 'rgba(255,230,0,0.09)'; // tc-2 yellow dim
        lineColor = 'rgba(255,230,0,0.6)';
        lineWidth = 2;
      } else if (status === 'fail') {
        // Palette 3C: fail is the one alert (yellow), not content-magenta —
        // same hue as stale, distinguished by the section's status label.
        bgColor = 'rgba(255,230,0,0.08)';
        lineColor = 'rgba(255,230,0,0.7)';
        lineWidth = 2;
      } else if (status === 'running') {
        bgColor = 'rgba(170,0,255,0.06)'; // tc-6 purple dim
        lineColor = 'rgba(170,0,255,0.7)';
        lineWidth = 2;
      } else if (status === 'success') {
        const readiness = testSuite[id]?.lastDiagnostic?.overallReadiness;
        
        // Palette 3C: readiness is a single teal-fill signal, not a 4-hue
        // ladder — draft→solid stays one hue (--color-hld-cyan), fading in and
        // thickening border-width as the readiness step count rises (mirrors
        // the --readiness-fill bar elsewhere; never a rainbow).
        if (readiness === 'draft') {
          bgColor = 'rgba(0,232,245,0.04)';
          lineColor = 'rgba(0,232,245,0.4)';
          lineWidth = 1;
        } else if (readiness === 'developing') {
          bgColor = 'rgba(0,232,245,0.07)';
          lineColor = 'rgba(0,232,245,0.55)';
          lineWidth = 2;
        } else if (readiness === 'nearly-there') {
          bgColor = 'rgba(0,232,245,0.1)';
          lineColor = 'rgba(0,232,245,0.7)';
          lineWidth = 3;
        } else if (readiness === 'solid') {
          bgColor = 'rgba(0,232,245,0.15)';
          lineColor = 'rgba(0,232,245,0.9)';
          lineWidth = 4;
        } else {
          // Fallback (e.g. legacy test result without diagnostic)
          bgColor = 'rgba(0,232,112,0.12)';
          lineColor = 'rgba(0,232,112,0.7)';
          lineWidth = 2;
        }
      } else {
        // Default Neutral Colors
        bgColor = 'rgba(0,232,245,0.05)'; // tc-5 cyan dim
        lineColor = '#0c1520';
        lineWidth = 2;
      }

      let fontColor = '#f8fafc';

      // Highlight selected node (HLD Focus Mode)
      if (selectedId && id !== 'root') {
        if (id === selectedId) {
          // ACTIVE FOCUS
          lineColor = '#00e8f5'; // HLD Cyan
          lineWidth = 4;
          if (bgColor.startsWith('rgba')) {
            bgColor = bgColor.replace(/[\d.]+\)$/, '0.35)');
          } else {
            bgColor = 'rgba(0, 232, 245, 0.25)';
          }
          fontColor = '#ffffff';
        } else {
          // DIMMED BACKGROUND — recede behind the selection but stay legible.
          // (The previous 0.015 bg / width-1 / 0.3 font made unselected
          // sections all but invisible, so focus mode erased the structure.)
          lineWidth = 1.5;
          if (bgColor.startsWith('rgba')) {
            bgColor = bgColor.replace(/[\d.]+\)$/, '0.09)');
          } else {
            bgColor = 'rgba(255,255,255,0.04)';
          }

          if (lineColor.startsWith('rgba')) {
            lineColor = lineColor.replace(/[\d.]+\)$/, '0.28)');
          } else {
            lineColor = 'rgba(255,255,255,0.16)';
          }
          fontColor = 'rgba(255,255,255,0.72)';
        }
      }

      // Search hit: a distinct amber highlight applied AFTER the focus-mode
      // dimming so matches stay visible even when another tile is selected.
      // The actively-selected tile keeps its cyan focus styling.
      if (matchedIds && matchedIds.has(id) && id !== selectedId) {
        bgColor = 'rgba(255,176,32,0.30)';
        lineColor = '#ffb020';
        lineWidth = 4;
        fontColor = '#ffffff';
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
      // customdata carries [full untruncated label, EXACT word count] per node — the
      // hover keeps both, even though the on-tile `text` shows an approximate magnitude
      // (Wertheimer's zones of indifference: a glance wants the shape, not false
      // precision; hover is the measurement gesture and stays exact). See magnitude.ts.
      customdata: [['Dissertation', `${totalWordCount} words`], ...flatData.map(d => [d.label, `${d.value} words`])],
      parents: ['', ...flatData.map(d => d.parent)],
      values: [Math.max(1, totalWordCount), ...flatData.map(d => d.value)], // Ensure at least 1
      text: [`${roundedCount(totalWordCount)} words`, ...flatData.map(d => magnitudeBand(d.value).label)],
      textinfo: "label+text",
      hoverinfo: "label+text",
      hovertemplate: "<b>%{customdata[0]}</b><br>%{customdata[1]}<extra></extra>",
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
  }, [filteredSections, testSuite, selectedId, matchedIds]);

  const layout = useMemo(() => ({
    margin: { t: 0, l: 0, r: 0, b: 0 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: {
      family: 'JetBrains Mono, monospace', // HLD prefers mono for data
      color: '#c5d8e8' // hld-text / slate-700
    },
    autosize: true
  }), []);

  const config = { responsive: true, displayModeBar: false };

  const onClick = (e: any) => {
    if (e.points && e.points.length > 0) {
      const point = e.points[0];
      const id = point.id;
      if (id) {
        onSelect(id);
      }
    }
  };

  if (filteredSections.length === 0) {
     return <div className="flex items-center justify-center h-full text-hld-muted-text text-[10px] font-mono uppercase tracking-widest px-4 text-center">No visible sections. Adjust filters or content.</div>;
  }

  return (
    <div className="w-full h-full min-h-[300px]">
      {/* Text alternative for the canvas/SVG treemap (Plotly tiles aren't
          keyboard-navigable). Mirrors the visible structure for assistive tech;
          the section tree + ⌘K command palette carry the keyboard navigation. */}
      <ul className="sr-only" aria-label="Document structure">
        {flattenTree(filteredSections).map((d) => {
          const readiness = summarizeReadiness(testSuite[d.id]?.lastDiagnostic?.overallReadiness);
          return (
            <li key={d.id}>
              {`Level ${d.level}: ${d.title} — ${magnitudeBand(d.wordCount).label} (${d.wordCount} words), ${readiness.label}`}
              {d.id === selectedId ? ', selected' : ''}
            </li>
          );
        })}
      </ul>
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
