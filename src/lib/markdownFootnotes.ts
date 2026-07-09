// Footnote support for academic prose: an inline @lezer/markdown extension
// recognizing `[^ref]` (references AND the token opening a `[^ref]: …`
// definition line), styled via a dedicated highlight tag. Pandoc-compatible
// syntax; rendering-to-widget deliberately out of scope — the source view
// keeps footnotes visible, just quiet.

import type { MarkdownConfig } from '@lezer/markdown';
import { Tag } from '@lezer/highlight';

/** Style hook for `[^ref]` tokens (wired in lib/editorTheme). */
export const footnoteTag = Tag.define();

const BRACKET_OPEN = 91; // [
const CARET = 94; // ^
const BRACKET_CLOSE = 93; // ]

export const Footnotes: MarkdownConfig = {
  defineNodes: [{ name: 'FootnoteRef', style: footnoteTag }],
  parseInline: [
    {
      name: 'FootnoteRef',
      parse(cx, next, pos) {
        if (next !== BRACKET_OPEN || cx.char(pos + 1) !== CARET) return -1;
        let end = pos + 2;
        while (end < cx.end) {
          const ch = cx.char(end);
          if (ch === BRACKET_CLOSE) break;
          // A footnote label is a compact identifier: bail on whitespace or a
          // nested bracket rather than swallowing prose.
          if (ch === BRACKET_OPEN || ch === 32 || ch === 9 || ch === 10) return -1;
          end++;
        }
        if (end >= cx.end || end === pos + 2) return -1;
        return cx.addElement(cx.elt('FootnoteRef', pos, end + 1));
      },
      before: 'Link',
    },
  ],
};

/** The `[^id]` token containing `pos` in `text`, if any. */
export const footnoteAt = (
  text: string,
  pos: number,
): { id: string; from: number; to: number } | null => {
  const re = /\[\^([^\s[\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (pos >= m.index && pos <= m.index + m[0].length) {
      return { id: m[1], from: m.index, to: m.index + m[0].length };
    }
    if (m.index > pos) break;
  }
  return null;
};

/**
 * Where a jump from the footnote at `pos` should land: from a definition line
 * (`[^id]: …`) to the first in-text reference, otherwise to the definition.
 * Null when the caret isn't on a footnote token or no counterpart exists.
 */
export const footnoteJumpTarget = (text: string, pos: number): number | null => {
  const fn = footnoteAt(text, pos);
  if (!fn) return null;
  const defRe = new RegExp(`^\\[\\^${escapeRe(fn.id)}\\]:`, 'm');
  const defMatch = defRe.exec(text);
  const onDefinition = defMatch !== null && pos >= defMatch.index && pos <= defMatch.index + defMatch[0].length;
  if (onDefinition) {
    // Jump to the first REFERENCE that isn't the definition itself.
    const refRe = new RegExp(`\\[\\^${escapeRe(fn.id)}\\](?!:)`, 'g');
    const ref = refRe.exec(text);
    return ref ? ref.index : null;
  }
  return defMatch ? defMatch.index : null;
};

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
