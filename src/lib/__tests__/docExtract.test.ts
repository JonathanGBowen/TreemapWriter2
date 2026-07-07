import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { extractDocx, extractSourceText, SOURCE_ACCEPT } from '../docExtract';

// In the browser/webview build Vite swaps in mammoth's `browser/unzip.js`, which
// accepts an `arrayBuffer` option; vitest's node resolver keeps the node build, which
// only takes `buffer`. Bridge the two so extractDocx exercises the REAL mammoth parser
// through our code path (arrayBuffer -> Buffer).
vi.mock('mammoth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('mammoth')>();
  return {
    ...actual,
    default: actual,
    extractRawText: (opts: { arrayBuffer?: ArrayBuffer }) =>
      actual.extractRawText(
        opts.arrayBuffer ? { buffer: Buffer.from(opts.arrayBuffer) } : (opts as never),
      ),
  };
});

// The pdf.js worker `?url` import resolves to a string in the Vitest/Vite transform;
// mock the heavy `pdfjs-dist` import so tests never load the DOM-only library.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (args: { data: Uint8Array }) => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: (n: number) =>
        Promise.resolve({
          getTextContent: () =>
            Promise.resolve({ items: [{ str: `page ${n}` }, { str: 'text' }] }),
          cleanup: () => {},
        }),
    }),
    destroy: () => Promise.resolve(),
    // Echo the byte length so a test can assert the buffer reached the parser.
    _bytes: args.data.length,
  }),
}));

/** Exact ArrayBuffer for a Uint8Array (Node pools Buffers, so `.buffer` over-reads). */
const toArrayBuffer = (b: Uint8Array): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

const docxBytes = new Uint8Array(
  readFileSync(fileURLToPath(new URL('./fixtures/sample.docx', import.meta.url))),
);

/** Build a File whose arrayBuffer()/text() resolve from `bytes`/`text`. */
function fakeFile(name: string, opts: { text?: string; bytes?: Uint8Array; type?: string }): File {
  return {
    name,
    type: opts.type ?? '',
    arrayBuffer: async () =>
      toArrayBuffer(opts.bytes ?? new TextEncoder().encode(opts.text ?? '')),
    text: async () => opts.text ?? new TextDecoder().decode(opts.bytes ?? new Uint8Array()),
  } as unknown as File;
}

describe('docExtract', () => {
  it('SOURCE_ACCEPT covers pdf, docx, and text/markdown', () => {
    expect(SOURCE_ACCEPT).toContain('.pdf');
    expect(SOURCE_ACCEPT).toContain('.docx');
    expect(SOURCE_ACCEPT).toContain('.md');
    expect(SOURCE_ACCEPT).toContain('.txt');
  });

  it('extracts real text from a DOCX (mammoth)', async () => {
    const text = await extractDocx(toArrayBuffer(docxBytes));
    expect(text).toContain('Hello from a DOCX fixture.');
    expect(text).toContain('Second paragraph here.');
  });

  it('dispatches a .docx File to the DOCX extractor', async () => {
    const text = await extractSourceText(fakeFile('paper.docx', { bytes: docxBytes }));
    expect(text).toContain('Hello from a DOCX fixture.');
  });

  it('dispatches a .pdf File through the (mocked) PDF extractor, page by page', async () => {
    const text = await extractSourceText(fakeFile('paper.pdf', { bytes: new Uint8Array([1, 2, 3]) }));
    expect(text).toContain('page 1 text');
    expect(text).toContain('page 2 text');
  });

  it('reads a plain-text / markdown file as-is', async () => {
    const text = await extractSourceText(fakeFile('notes.md', { text: '# Notes\n\nsome prose' }));
    expect(text).toContain('some prose');
  });

  it('throws on an unsupported extension', async () => {
    await expect(extractSourceText(fakeFile('data.xlsx', { text: 'x' }))).rejects.toThrow(
      /unsupported file type/i,
    );
  });

  it('throws when a text file is empty', async () => {
    await expect(extractSourceText(fakeFile('empty.txt', { text: '   ' }))).rejects.toThrow(
      /empty/i,
    );
  });
});
