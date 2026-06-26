import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { Range, StateField } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import katex from "katex";
import mermaid from "mermaid";

// Use KaTeX for rendering - it's fast, ESM-friendly, and avoids the "require is not defined" 
// errors that MathJax 3's internal CJS structure causes in Vite/Browser environments.
function renderMath(tex: string, display: boolean): HTMLElement {
  const span = document.createElement(display ? "div" : "span");
  try {
    katex.render(tex, span, {
      displayMode: display,
      throwOnError: false,
      output: "html"
    });
  } catch (e) {
    console.error("KaTeX rendering error:", e);
    span.className = "text-red-500 font-mono text-xs";
    span.innerText = tex;
  }
  return span;
}

mermaid.initialize({ startOnLoad: false, theme: 'dark' });
let mermaidCounter = 0;

class MermaidWidget extends WidgetType {
  constructor(readonly code: string) {
    super();
  }

  eq(other: MermaidWidget) {
    return this.code === other.code;
  }

  toDOM(view: EditorView) {
    const div = document.createElement("div");
    div.className = "cm-mermaid-widget overflow-x-auto my-4 p-4 rounded-md border border-[rgba(255,16,96,0.2)] bg-[#05090d] text-center flex justify-center min-h-[100px]";
    
    const id = `mermaid-${++mermaidCounter}`;
    div.id = id;
    
    mermaid.render(id + "-svg", this.code)
      .then(({ svg }) => {
        div.innerHTML = svg;
        view.requestMeasure();
      })
      .catch((e) => {
        div.innerHTML = `<div class="text-hld-magenta font-mono text-sm max-w-full overflow-hidden text-left">Mermaid Error:<br/>${e.message}</div>`;
        view.requestMeasure();
      });
      
    div.innerHTML = `<span class="text-hld-muted-text font-mono text-xs uppercase tracking-widest animate-pulse">Rendering diagram...</span>`;
    
    return div;
  }

  ignoreEvent() {
    return false;
  }
}

class MathWidget extends WidgetType {
  constructor(readonly math: string, readonly displayMode: boolean) {
    super();
  }

  eq(other: MathWidget) {
    return this.math === other.math && this.displayMode === other.displayMode;
  }

  toDOM() {
    const container = document.createElement(this.displayMode ? "div" : "span");
    container.className = "cm-math-widget " + (this.displayMode ? "py-6 my-2 text-center block w-full bg-black/10 rounded-lg" : "inline-block mx-0.5 px-0.5 bg-indigo-500/10 rounded cursor-default align-middle");
    
    // KaTeX handles its own internal structure
    const rendered = renderMath(this.math, this.displayMode);
    container.appendChild(rendered);
    
    return container;
  }

  ignoreEvent() {
    return false;
  }
}

class TableWidget extends WidgetType {
  constructor(readonly mdText: string, readonly tableHtml: HTMLElement) {
    super();
  }

  eq(other: TableWidget) {
    return this.mdText === other.mdText;
  }

  toDOM() {
    const div = document.createElement("div");
    div.className = "cm-table-widget overflow-x-auto my-4 rounded-md border border-[rgba(0,232,245,0.2)] bg-[#0c1520] text-hld-text";
    div.appendChild(this.tableHtml);
    return div;
  }

  ignoreEvent() {
    return false;
  }
}

function renderMarkdownTable(mdText: string): HTMLElement {
  const table = document.createElement("table");
  table.className = "w-full text-left border-collapse text-sm";
  
  const lines = mdText.trim().split('\n').filter(l => l.trim().length > 0).map(l => l.trim().replace(/^\||\|$/g, ''));
  if (lines.length < 2) return table;

  const headers = lines[0].split('|').map(h => h.trim());
  const aligns = lines[1].split('|').map(a => {
    a = a.trim();
    if (a.startsWith(':') && a.endsWith(':')) return 'center';
    if (a.endsWith(':')) return 'right';
    return 'left';
  });

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.className = "border-b border-[rgba(0,232,245,0.3)] bg-black/40";
  headers.forEach((h, i) => {
    const th = document.createElement("th");
    th.className = "p-3 font-semibold text-hld-cyan text-xs uppercase tracking-wider";
    th.style.textAlign = aligns[i] || 'left';
    th.innerText = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i].split('|').map(c => c.trim());
    const tr = document.createElement("tr");
    tr.className = "border-b border-[rgba(0,232,245,0.1)] hover:bg-[rgba(0,232,245,0.05)] transition-colors";
    cells.forEach((c, cIdx) => {
      const td = document.createElement("td");
      td.className = "p-3 font-mono";
      td.style.textAlign = aligns[cIdx] || 'left';
      td.innerText = c;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

function buildDecorations(state: any): DecorationSet {
  const builder: Range<Decoration>[] = [];
  const selection = state.selection.main;
  const doc = state.doc;
  // Ensure the tree is as complete as possible for current viewport
  const tree = syntaxTree(state);
  
  const skipRanges: {from: number, to: number}[] = [];
  
  // 1. First Pass: Find structural elements (Tables, Fenced Code / Mermaid)
  tree.iterate({
    enter: (node) => {
      // Table Rendering
      if (node.name === "Table") {
        // Expand to full line boundaries for the table
        const startLine = doc.lineAt(node.from);
        const endLine = doc.lineAt(node.to);
        
        const isCursorInside = selection.from <= endLine.to && selection.to >= startLine.from;
        
        if (isCursorInside) {
          // If cursor is inside, we still mark it so inline math doesn't trigger inside it
          skipRanges.push({from: startLine.from, to: endLine.to});
          return false;
        }

        const tableText = doc.sliceString(startLine.from, endLine.to);
        if (tableText.trim()) {
          const tableDom = renderMarkdownTable(tableText);
          builder.push(Decoration.replace({
            widget: new TableWidget(tableText, tableDom),
            block: true
          }).range(startLine.from, endLine.to));
          skipRanges.push({from: startLine.from, to: endLine.to});
        }
        return false;
      }

      // Fenced Code / Mermaid Rendering
      if (node.name === "FencedCode") {
        const startLine = doc.lineAt(node.from);
        const endLine = doc.lineAt(node.to);
        
        const isCursorInside = selection.from <= endLine.to && selection.to >= startLine.from;
        
        if (isCursorInside) {
          skipRanges.push({from: startLine.from, to: endLine.to});
          return false;
        }

        let isMermaid = false;
        let codeText = "";
        const cursor = node.node.cursor();
        if (cursor.firstChild()) {
          do {
            if (cursor.name === "CodeInfo") {
              const info = doc.sliceString(cursor.from, cursor.to);
              if (info.trim().toLowerCase() === "mermaid") isMermaid = true;
            }
            if (cursor.name === "CodeText") {
              codeText = doc.sliceString(cursor.from, cursor.to);
            }
          } while (cursor.nextSibling());
        }

        if (isMermaid && codeText.trim()) {
          builder.push(Decoration.replace({
            widget: new MermaidWidget(codeText.trim()),
            block: true
          }).range(startLine.from, endLine.to));
          skipRanges.push({from: startLine.from, to: endLine.to});
        } else {
          // Just normal code or empty mermaid
          skipRanges.push({from: startLine.from, to: endLine.to});
        }
        return false;
      }

      // Atomic skips for simple code
      if (node.name === "CodeBlock" || node.name === "InlineCode") {
        skipRanges.push({from: node.from, to: node.to});
      }
    }
  });

  const isInsideSkipRange = (start: number, end: number) => {
    return skipRanges.some(r => Math.max(start, r.from) < Math.min(end, r.to));
  };

  const text = doc.toString();
  
  // 2. Second Pass: Hand-rolled Math Delimiters (since standard MD doesn't have nodes for them)
  
  // Robust Block Math: $$ ... $$
  const blockMathRegex = /(?:\n|^)\s*\$\$([\s\S]+?)\$\$\s*(?=\n|$)/g;
  let match;
  while ((match = blockMathRegex.exec(text)) !== null) {
    const startOffset = match.index + (match[0].startsWith('\n') ? 1 : 0);
    const endOffset = match.index + match[0].length;
    
    if (isInsideSkipRange(startOffset, endOffset)) continue;
    
    // Expand to full lines to avoid trailing artifacts
    const startLine = doc.lineAt(startOffset);
    const endLine = doc.lineAt(endOffset);
    
    const isCursorInside = selection.from <= endLine.to && selection.to >= startLine.from;
    if (isCursorInside) continue;

    builder.push(Decoration.replace({
      widget: new MathWidget(match[1].trim(), true),
      block: true
    }).range(startLine.from, endLine.to));
    
    skipRanges.push({from: startLine.from, to: endLine.to});
  }

  // Robust Inline Math: $ ... $
  const inlineMathRegex = /([^\\]|^)\$([^\s$](?:[\s\S]*?[^\s$])?)\$/g;
  while ((match = inlineMathRegex.exec(text)) !== null) {
    const prefix = match[1];
    const mathContent = match[2];
    
    const actualStart = match.index + prefix.length;
    const actualEnd = actualStart + mathContent.length + 2; 

    if (isInsideSkipRange(actualStart, actualEnd)) continue;
    
    const isCursorInside = selection.from <= actualEnd && selection.to >= actualStart;
    if (isCursorInside) continue;

    // Check overlaps with already placed decorations
    const hasOverlap = builder.some(d => Math.max(actualStart, d.from) < Math.min(actualEnd, d.to));
    if (hasOverlap) continue;

    builder.push(Decoration.replace({
      widget: new MathWidget(mathContent.trim(), false),
      block: false
    }).range(actualStart, actualEnd));
  }

  builder.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(builder);
}

export const livePreviewPlugin = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },
  update(decorations, tr) {
    if (tr.docChanged) {
      return buildDecorations(tr.state);
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});
