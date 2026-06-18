// .docx ↔ markdown conversion (pure, UI-free).
//
// Both directions run entirely in the webview with lazy-loaded libraries, so
// nothing here lands in the main bundle — each function dynamically imports its
// dependencies on first use (mirrors how App.tsx lazy-loads markdownImport/utils).
//
// Fidelity is deliberately pragmatic: markdown is the lossy middle. Headings,
// paragraphs, lists, tables, bold/italic, links and images survive; tracked
// changes, comments, citation/field codes, equations and footnotes degrade.
// project.md remains the single source of truth; the .docx is a derived artifact.

/** Convert raw .docx bytes (from a file input) to markdown. */
export async function docxArrayBufferToMarkdown(
  arrayBuffer: ArrayBuffer,
): Promise<{ markdown: string; messages: string[] }> {
  // Browser build: the bare `mammoth` entry pulls Node builtins (fs/path/Buffer)
  // and fails in the webview.
  const mammoth = await import('mammoth/mammoth.browser');
  const { default: TurndownService } = await import('turndown');
  const { gfm } = await import('turndown-plugin-gfm');

  const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer });

  // `headingStyle: 'atx'` is mandatory: the default Setext style (=== / ---)
  // is not recognised as a heading by parseMarkdown, so the treemap would be flat.
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  turndown.use(gfm);
  const markdown = turndown.turndown(html);

  return { markdown, messages: messages.map((m) => m.message) };
}

/** Render markdown prose to a .docx Blob. */
export async function markdownToDocxBlob(markdown: string): Promise<Blob> {
  const { default: MarkdownIt } = await import('markdown-it');
  const { default: htmlToDocx } = await import('@turbodocx/html-to-docx');

  const body = new MarkdownIt({ html: false, linkify: true }).render(markdown);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;

  const out = await htmlToDocx(html, undefined, {
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false,
  });

  // html-to-docx returns a Blob in the webview; normalise defensively in case a
  // build returns an ArrayBuffer/Uint8Array.
  if (out instanceof Blob) return out;
  return new Blob([out as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
