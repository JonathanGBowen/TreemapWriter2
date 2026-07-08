// Client-side text extraction for uploaded source files (PDF / DOCX / plain text).
// Pure transform in spirit (mirrors lib/bibImport.ts): ArrayBuffer/File -> text, no
// React and no store. The heavy parsers (pdfjs-dist, mammoth) are DYNAMICALLY imported
// so they never enter the main bundle — a writer who never uploads a PDF never pays for
// pdf.js. Runs in both the browser and the Tauri webview (no Rust dependency), which is
// why extraction lives here and not in a desktop-only command.

// The pdf.js worker is an ESM asset; Vite rewrites this `?url` import to the emitted
// worker's URL (a small string — importing it does NOT pull in the whole library). We
// set it on GlobalWorkerOptions once, lazily, the first time a PDF is parsed.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** File extensions the source picker accepts, as an `<input accept>` string. */
export const SOURCE_ACCEPT = '.pdf,.docx,.md,.markdown,.txt';

/** ~4 chars/token; warn when one source alone eats a big chunk of any window. */
export const LARGE_SOURCE_CHARS = 120_000;

/** Lower-cased extension of a filename, without the dot (''.md'' -> 'md'). */
const extOf = (name: string): string => {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : '';
};

/** Collapse runs of blank lines / trailing whitespace so extracted text stays readable. */
const tidy = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Extract text from a PDF ArrayBuffer, page by page, in reading order. */
export async function extractPdf(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // Point the library at the bundled worker (idempotent — set once).
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const doc = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      // Each item is a TextItem with `.str`; markedContent items have no `str`.
      const line = content.items
        .map((it) => ('str' in it ? it.str : ''))
        .join(' ');
      pages.push(line);
      page.cleanup();
    }
    return tidy(pages.join('\n\n'));
  } finally {
    // Release the worker-side document so a big PDF doesn't linger in memory.
    await loadingTask.destroy();
  }
}

/** Extract raw text from a DOCX ArrayBuffer via mammoth. */
export async function extractDocx(buf: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
  return tidy(value);
}

/**
 * Extract text from a picked source file, dispatching by extension. PDF/DOCX go
 * through their parsers; everything else is read as UTF-8 text. Throws a friendly
 * Error on an unsupported type or when a file yields no usable text (e.g. a
 * scanned, image-only PDF), so the caller can toast it rather than add an empty
 * source.
 */
export async function extractSourceText(file: File): Promise<string> {
  const ext = extOf(file.name);
  let text: string;
  if (ext === 'pdf') {
    text = await extractPdf(await file.arrayBuffer());
  } else if (ext === 'docx') {
    text = await extractDocx(await file.arrayBuffer());
  } else if (ext === 'md' || ext === 'markdown' || ext === 'txt' || ext === '') {
    text = tidy(await file.text());
  } else {
    throw new Error(`Unsupported file type “.${ext}”. Upload a PDF, DOCX, or text/markdown file.`);
  }
  if (!text.trim()) {
    throw new Error(
      ext === 'pdf'
        ? 'No text found in that PDF (it may be a scanned image — OCR isn’t supported yet).'
        : 'That file appears to be empty.',
    );
  }
  return text;
}
