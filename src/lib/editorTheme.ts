import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';

// A "Hyper Light Drifter" infused dark/cool aesthetic
// We use a specific theme object to ensure our styles are the "source of truth"
export const hldTheme = EditorView.theme({
  "&": {
    color: "#c5d8e8",
    backgroundColor: "#05090d",
    fontFamily: "'Inter', sans-serif",
    fontSize: "14px",
    lineHeight: "1.8",
  },
  "&.cm-editor": {
    backgroundColor: "#05090d",
    outline: "none"
  },
  ".cm-scroller": {
    fontFamily: "inherit",
    backgroundColor: "#05090d",
    overflow: "auto",
    scrollbarWidth: "thin",
    scrollbarColor: "#22364e transparent"
  },
  /* HLD scrollbars inside CodeMirror — match the global treatment (fix 01) */
  ".cm-scroller::-webkit-scrollbar": { width: "8px", height: "8px" },
  ".cm-scroller::-webkit-scrollbar-track": {
    background: "transparent",
    borderLeft: "1px solid #172335"
  },
  ".cm-scroller::-webkit-scrollbar-thumb": {
    background: "#22364e",
    border: "1px solid #2a4258",
    borderRadius: "0"
  },
  ".cm-scroller::-webkit-scrollbar-thumb:hover": {
    background: "rgba(0, 232, 245, 0.45)",
    borderColor: "rgba(0, 232, 245, 0.7)",
    boxShadow: "0 0 8px rgba(0, 232, 245, 0.5)"
  },
  ".cm-content": {
    caretColor: "#00f0ff",
    fontFamily: "'Inter', sans-serif",
    paddingBottom: "120px",
    paddingTop: "36px",
    paddingLeft: "64px",
    paddingRight: "64px"
  },
  ".cm-line": {
    padding: "0 4px",
    lineHeight: "1.8",
  },
  /* Precise block-level heading overrides targeting the spans */
  ".cm-content .cm-heading1": {
    display: "block",
    borderBottom: "1px solid rgba(255, 16, 96, 0.3)",
    paddingBottom: "8px",
    marginTop: "24px",
    marginBottom: "16px",
    width: "100%",
  },
  ".cm-content .cm-heading2": {
    display: "block",
    borderBottom: "1px solid rgba(0, 232, 245, 0.2)",
    paddingBottom: "6px",
    marginTop: "20px",
    marginBottom: "12px",
    width: "100%",
  },
  ".cm-content .cm-heading3": {
    display: "block",
    marginTop: "16px",
    marginBottom: "8px",
  },
  ".cm-gutters": {
    backgroundColor: "#05090d",
    color: "#3d5570",
    border: "none",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(0, 232, 245, 0.04) !important",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent !important",
    color: "#00e8f5",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#00f0ff",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(0, 240, 255, 0.15) !important",
  },
  ".cm-panels": { backgroundColor: "#0c1520", color: "#c5d8e8" },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid #172335" },
  ".cm-panels.cm-panels-bottom": { borderTop: "1px solid #172335" },
  ".cm-searchMatch": {
    backgroundColor: "rgba(255, 16, 96, 0.4)",
    outline: "1px solid #ff1060"
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "rgba(255, 16, 96, 0.8)",
  },
  ".cm-tooltip": {
    backgroundColor: "#0c1520",
    border: "1px solid #1f3050",
    borderRadius: "4px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
    color: "#c5d8e8",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: "rgba(0, 232, 245, 0.15)",
      color: "#00e8f5",
    }
  },
  ".cm-matchingBracket": {
    backgroundColor: "rgba(0, 232, 245, 0.2)",
    color: "#00e8f5",
    outline: "1px solid rgba(0, 232, 245, 0.5)"
  },
  ".cm-nonmatchingBracket": {
    backgroundColor: "rgba(255, 16, 96, 0.2)",
    color: "#ff1060"
  }
}, { dark: true });

// Custom Markdown & Code Highlight Style
export const hldHighlightStyle = HighlightStyle.define([
  // Markdown Headings
  { tag: t.heading1, fontSize: '2.2rem', fontWeight: '800', color: '#ff1060', letterSpacing: '-0.02em' },
  { tag: t.heading2, fontSize: '1.7rem', fontWeight: '700', color: '#00e8f5', letterSpacing: '-0.01em' },
  { tag: t.heading3, fontSize: '1.3rem', fontWeight: '600', color: '#ffe600' },
  { tag: t.heading4, fontSize: '1.1rem', fontWeight: '600', color: '#00e870', textTransform: 'uppercase', letterSpacing: '0.05em' },
  { tag: t.heading5, fontSize: '1rem', fontWeight: '600', color: '#ff8800' },
  { tag: t.heading6, fontSize: '1rem', fontWeight: '600', color: '#c5d8e8', opacity: '0.7' },
  
  // Markdown Formatting
  { tag: t.quote, fontStyle: 'italic', color: '#8a9cad', borderLeft: '3px solid #ff1060' },
  { tag: t.monospace, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', backgroundColor: 'rgba(17, 29, 43, 0.8)', padding: '3px 6px', borderRadius: '4px', color: '#00e8f5' },
  { tag: t.strong, fontWeight: 'bold', color: '#ffffff' },
  { tag: t.emphasis, fontStyle: 'italic', color: '#c5d8e8' },
  { tag: t.strikethrough, textDecoration: 'line-through', opacity: '0.5' },
  { tag: t.link, color: '#00e8f5', textDecoration: 'underline' },
  { tag: t.url, color: '#3d5570', opacity: '0.6' },
  { tag: t.list, color: '#ff1060', fontWeight: 'bold' },
  
  // General Syntax Highlighting (for fenced code blocks)
  { tag: t.comment, color: '#3d5570', fontStyle: 'italic' },
  { tag: t.punctuation, color: '#688cae', fontWeight: '400' }, 
  { tag: [t.keyword, t.operator, t.modifier], color: '#ff1060' }, 
  { tag: [t.string, t.regexp, t.special(t.string)], color: '#00e870' },
  { tag: [t.number, t.bool, t.null], color: '#ff8800' },
  { tag: t.variableName, color: '#c5d8e8' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#00e8f5' },
  { tag: [t.propertyName], color: '#ffe600' },
  { tag: [t.typeName, t.className, t.namespace], color: '#d080ff' },
  { tag: t.tagName, color: '#ff1060' },
  { tag: t.attributeName, color: '#ffe600' },
  { tag: t.meta, color: '#3d5570' },
]);

export const hldExtensions = [
  hldTheme,
  syntaxHighlighting(hldHighlightStyle)
];
