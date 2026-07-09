import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { footnoteTag } from './markdownFootnotes';

// A "Hyper Light Drifter" infused dark/cool aesthetic.
// Colours reference the `--color-hld-*` design tokens (src/index.css) — alpha
// tints via color-mix over the tokens so a token hue change can never desync
// the editor. Heading sizes reference the `--text-h-*` prose scale. Only pure
// white (bold emphasis) and one code-syntax purple (#d080ff, no token) stay
// literal.
export const hldTheme = EditorView.theme({
  "&": {
    color: "var(--color-hld-text)",
    backgroundColor: "var(--color-hld-bg)",
    // Inter at 14px — user-tested as the more readable manuscript face (the
    // serif experiment was reverted after real use; VISION's serif line is
    // superseded by tested preference for this surface).
    fontFamily: "'Inter', sans-serif",
    fontSize: "14px",
    lineHeight: "1.8",
  },
  "&.cm-editor": {
    backgroundColor: "var(--color-hld-bg)"
    /* No `outline: none` here — keyboard focus shows a visible cyan ring on
       `.cm-content:focus-visible` (see src/index.css). */
  },
  ".cm-scroller": {
    fontFamily: "inherit",
    backgroundColor: "var(--color-hld-bg)",
    overflow: "auto",
    scrollbarWidth: "thin",
    scrollbarColor: "var(--color-hld-border-strong) transparent"
  },
  /* HLD scrollbars inside CodeMirror — match the global treatment (fix 01) */
  ".cm-scroller::-webkit-scrollbar": { width: "8px", height: "8px" },
  ".cm-scroller::-webkit-scrollbar-track": {
    background: "transparent",
    borderLeft: "1px solid var(--color-hld-border)"
  },
  ".cm-scroller::-webkit-scrollbar-thumb": {
    background: "var(--color-hld-border-strong)",
    border: "1px solid var(--color-hld-border-strong)",
    borderRadius: "0"
  },
  ".cm-scroller::-webkit-scrollbar-thumb:hover": {
    background: "color-mix(in srgb, var(--color-hld-cyan) 45%, transparent)",
    borderColor: "color-mix(in srgb, var(--color-hld-cyan) 70%, transparent)",
    boxShadow: "0 0 8px color-mix(in srgb, var(--color-hld-cyan) 50%, transparent)"
  },
  ".cm-content": {
    caretColor: "var(--color-hld-cyan)",
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
  /* Precise block-level heading overrides targeting the spans. The H1/H2
     underline is a neutral hairline; heading *hue* is the magenta-intensity
     ladder (--color-heading-1..6, below) — palette 3C reserves magenta for "the
     work" and moved every failing/state use off it, so a magenta heading no
     longer collides with a state meaning. */
  ".cm-content .cm-heading1": {
    display: "block",
    borderBottom: "1px solid var(--color-hld-border-strong)",
    paddingBottom: "8px",
    marginTop: "24px",
    marginBottom: "16px",
    width: "100%",
  },
  ".cm-content .cm-heading2": {
    display: "block",
    borderBottom: "1px solid var(--color-hld-border)",
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
    backgroundColor: "var(--color-hld-bg)",
    color: "var(--color-hld-muted)",
    border: "none",
  },
  /* Active-line styling is INTENTIONALLY INERT by default: the writing-surface
     factory omits `highlightActiveLine()` (an always-on tint read as too much
     ambient noise). These rules are kept ready so a future feature that wants a
     deliberate line emphasis can re-enable the class without re-styling. */
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--color-hld-cyan) 4%, transparent) !important",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent !important",
    color: "var(--color-hld-cyan)",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--color-hld-cyan)",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in srgb, var(--color-hld-cyan) 15%, transparent) !important",
  },
  ".cm-panels": { backgroundColor: "var(--color-hld-surface)", color: "var(--color-hld-text)" },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--color-hld-border)" },
  ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--color-hld-border)" },
  /* Search match rides teal — finding text is navigation ("you are here"),
     the selection family (palette 3C), not the yellow alert. */
  ".cm-searchMatch": {
    backgroundColor: "color-mix(in srgb, var(--color-hld-cyan) 40%, transparent)",
    outline: "1px solid var(--color-hld-cyan)"
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "color-mix(in srgb, var(--color-hld-cyan) 80%, transparent)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--color-hld-surface)",
    border: "1px solid var(--color-hld-border-strong)",
    borderRadius: "4px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
    color: "var(--color-hld-text)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: "color-mix(in srgb, var(--color-hld-cyan) 15%, transparent)",
      color: "var(--color-hld-cyan)",
    }
  },
  ".cm-matchingBracket": {
    backgroundColor: "color-mix(in srgb, var(--color-hld-cyan) 20%, transparent)",
    color: "var(--color-hld-cyan)",
    outline: "1px solid color-mix(in srgb, var(--color-hld-cyan) 50%, transparent)"
  },
  /* Non-matching bracket = an error → yellow, the one alert (palette 3C moved
     failure off magenta; magenta now means content). */
  ".cm-nonmatchingBracket": {
    backgroundColor: "color-mix(in srgb, var(--color-hld-yellow) 20%, transparent)",
    color: "var(--color-hld-yellow)"
  }
}, { dark: true });

// Custom Markdown & Code Highlight Style. Palette 3C: headings speak one hue
// (magenta = "the work") fading by depth, not a 6-hue rainbow — teal never
// appears here, it's reserved for "you." A magenta heading is safe because 3C
// moved every failing/state use off magenta (see index.css), so it no longer
// competes with the app's state vocabulary. Sizes ride --text-h-* (unchanged).
export const hldHighlightStyle = HighlightStyle.define([
  // Markdown Headings — magenta-intensity ladder (--color-heading-1..6)
  { tag: t.heading1, fontSize: 'var(--text-h-xl)', fontWeight: '800', color: 'var(--color-heading-1)', letterSpacing: '-0.02em' },
  { tag: t.heading2, fontSize: 'var(--text-h-lg)', fontWeight: '700', color: 'var(--color-heading-2)', letterSpacing: '-0.01em' },
  { tag: t.heading3, fontSize: 'var(--text-h-md)', fontWeight: '600', color: 'var(--color-heading-3)' },
  { tag: t.heading4, fontSize: 'var(--text-h-sm)', fontWeight: '600', color: 'var(--color-heading-4)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  { tag: t.heading5, fontSize: 'var(--text-h-xs)', fontWeight: '600', color: 'var(--color-heading-5)' },
  { tag: t.heading6, fontSize: 'var(--text-h-xs)', fontWeight: '600', color: 'var(--color-heading-6)' },

  // Markdown Formatting
  { tag: t.quote, fontStyle: 'italic', color: 'var(--color-hld-muted-text-2)', borderLeft: '3px solid var(--color-hld-border-strong)' },
  { tag: t.monospace, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', backgroundColor: 'color-mix(in srgb, var(--color-hld-surface-2) 80%, transparent)', padding: '3px 6px', borderRadius: '4px', color: 'var(--color-hld-cyan)' },
  { tag: t.strong, fontWeight: 'bold', color: '#ffffff' },
  { tag: t.emphasis, fontStyle: 'italic', color: 'var(--color-hld-text)' },
  { tag: t.strikethrough, textDecoration: 'line-through', opacity: '0.5' },
  // Footnote tokens ([^ref] and the [^ref]: definition opener) — quiet
  // superscript, readable but out of the prose's way.
  { tag: footnoteTag, color: 'var(--color-hld-muted-text-2)', fontSize: '0.78em', verticalAlign: 'super', fontFamily: "'JetBrains Mono', monospace" },
  { tag: t.link, color: 'var(--color-hld-cyan)', textDecoration: 'underline' },
  { tag: t.url, color: 'var(--color-hld-muted)', opacity: '0.6' },
  { tag: t.list, color: 'var(--color-hld-muted-text-2)', fontWeight: 'bold' },

  // General Syntax Highlighting (for fenced code blocks)
  { tag: t.comment, color: 'var(--color-hld-muted)', fontStyle: 'italic' },
  { tag: t.punctuation, color: 'var(--color-hld-muted-text)', fontWeight: '400' },
  { tag: [t.keyword, t.operator, t.modifier], color: 'var(--color-hld-magenta)' },
  { tag: [t.string, t.regexp, t.special(t.string)], color: 'var(--color-hld-green)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--color-hld-yellow)' },
  { tag: t.variableName, color: 'var(--color-hld-text)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--color-hld-cyan)' },
  { tag: [t.propertyName], color: 'var(--color-hld-yellow)' },
  // eslint-disable-next-line no-restricted-syntax -- code-syntax purple tint; no matching design token (intentional sub-palette for fenced code)
  { tag: [t.typeName, t.className, t.namespace], color: '#d080ff' },
  { tag: t.tagName, color: 'var(--color-hld-magenta)' },
  { tag: t.attributeName, color: 'var(--color-hld-yellow)' },
  { tag: t.meta, color: 'var(--color-hld-muted)' },
]);

export const hldExtensions = [
  hldTheme,
  syntaxHighlighting(hldHighlightStyle)
];
