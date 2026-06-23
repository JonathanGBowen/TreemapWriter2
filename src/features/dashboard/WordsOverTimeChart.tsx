import React, { useMemo } from 'react';
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponentImport from 'react-plotly.js/factory';
import type { DayPoint } from './dashboardData';

// Same defensive unwrap as Treemap.tsx (react-plotly.js/factory is CJS).
const createPlotlyComponent: (plotly: typeof Plotly) => React.ComponentType<any> =
  typeof createPlotlyComponentImport === 'function'
    ? (createPlotlyComponentImport as any)
    : (createPlotlyComponentImport as any).default;

const Plot = createPlotlyComponent(Plotly);

/**
 * Cumulative word count over calendar days — the observed trajectory only. No
 * goal lines, no targets. Reuses the project's existing Plotly dependency.
 */
export function WordsOverTimeChart({ points }: { points: DayPoint[] }) {
  const data = useMemo(
    () => [
      {
        x: points.map((p) => p.day),
        y: points.map((p) => p.cumulative),
        type: 'scatter' as const,
        mode: 'lines' as const,
        fill: 'tozeroy' as const,
        line: { color: '#3bd6c6', width: 2 },
        fillcolor: 'rgba(59,214,198,0.10)',
        hovertemplate: '%{x}<br>%{y:,} words<extra></extra>',
      },
    ],
    [points],
  );

  const layout = useMemo(
    () => ({
      autosize: true,
      margin: { l: 44, r: 16, t: 8, b: 32 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#6b7d8c', family: 'monospace', size: 10 },
      xaxis: { gridcolor: 'rgba(255,255,255,0.04)', zeroline: false },
      yaxis: { gridcolor: 'rgba(255,255,255,0.04)', zeroline: false, rangemode: 'tozero' as const },
      showlegend: false,
    }),
    [],
  );

  if (points.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center font-mono text-[10px] tracking-[0.1em] uppercase text-hld-muted-text">
        No sessions recorded yet
      </div>
    );
  }

  return (
    <Plot
      data={data}
      layout={layout}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '220px' }}
      useResizeHandler
    />
  );
}
