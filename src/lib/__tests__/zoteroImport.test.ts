import { describe, expect, it } from 'vitest';
import {
  itemDisplay,
  itemLabel,
  itemToReference,
  mergeZoteroImports,
  pickBestAttachment,
  zoteroItemToCslItem,
  type IncomingZoteroSource,
  type ZoteroApiItem,
} from '../zoteroImport';
import type { SourceDocument } from '../../types';

const deweyData = {
  title: 'Human Nature and Conduct',
  creators: [{ creatorType: 'author', firstName: 'John', lastName: 'Dewey' }],
  date: 'January 1922',
  publisher: 'Henry Holt',
  abstractNote: 'Habit as the mainspring.',
};

describe('zoteroItemToCslItem', () => {
  it('maps creators, a year buried in a date string, publisher, and abstractNote', () => {
    const csl = zoteroItemToCslItem(deweyData);
    expect(csl.author).toEqual([{ family: 'Dewey', given: 'John' }]);
    expect(csl.issued).toEqual({ 'date-parts': [['1922']] });
    expect(csl.publisher).toBe('Henry Holt');
    expect(csl.abstract).toBe('Habit as the mainspring.');
  });

  it('maps journal fields, editors, and organisation names', () => {
    const csl = zoteroItemToCslItem({
      title: 'A paper',
      creators: [
        { creatorType: 'editor', firstName: 'A', lastName: 'B' },
        { creatorType: 'author', name: 'Some Institute' },
      ],
      publicationTitle: 'Mind',
      volume: '31',
      issue: '2',
      pages: '316-337',
    });
    expect(csl['container-title']).toBe('Mind');
    expect(csl.page).toBe('316-337');
    expect(csl.editor).toEqual([{ family: 'B', given: 'A' }]);
    expect(csl.author).toEqual([{ literal: 'Some Institute' }]);
  });

  it('tolerates junk fields', () => {
    const csl = zoteroItemToCslItem({ creators: 'nope', date: 12 } as never);
    expect(csl.author).toBeUndefined();
    expect(csl.issued).toBeUndefined();
  });
});

describe('itemToReference / itemDisplay / itemLabel', () => {
  const viaData: ZoteroApiItem = { key: 'K1', data: deweyData };

  it('prefers csljson when present', () => {
    const item: ZoteroApiItem = {
      key: 'K1',
      data: deweyData,
      csljson: {
        title: 'CSL Title',
        author: [{ family: 'Csl', given: 'Jane' }],
        issued: { 'date-parts': [[2001]] },
      },
    };
    const ref = itemToReference(item);
    expect(ref?.labelStem).toBe('Csl');
    expect(ref?.year).toBe('2001');
  });

  it('falls back to the data mapping', () => {
    const ref = itemToReference(viaData);
    expect(ref?.labelStem).toBe('Dewey');
    expect(ref?.year).toBe('1922');
    expect(itemLabel(viaData)).toBe('Dewey (1922)');
    expect(itemDisplay(viaData)).toEqual({
      title: 'Human Nature and Conduct',
      stem: 'Dewey',
      year: '1922',
    });
  });

  it('degrades to the key/title for an empty item', () => {
    expect(itemToReference({ key: 'K2' })).toBeNull();
    expect(itemLabel({ key: 'K2' })).toBe('K2');
  });
});

describe('pickBestAttachment', () => {
  const child = (key: string, contentType: string, itemType = 'attachment') => ({
    key,
    data: { itemType, contentType, filename: `${key}.bin` },
  });

  it('prefers pdf over docx over text over html, ignoring notes', () => {
    const picked = pickBestAttachment([
      { key: 'n', data: { itemType: 'note' } },
      child('h', 'text/html'),
      child('t', 'text/plain'),
      child('d', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      child('p', 'application/pdf'),
    ]);
    expect(picked?.key).toBe('p');
  });

  it('returns null when nothing usable exists', () => {
    expect(pickBestAttachment([child('x', 'image/png')])).toBeNull();
    expect(pickBestAttachment([])).toBeNull();
  });
});

describe('mergeZoteroImports', () => {
  const existing: SourceDocument[] = [
    {
      id: 'src_1',
      role: 'bibliographic',
      kind: 'Bibliography',
      label: 'Dewey (1922)',
      glyph: '◎',
      content: 'old entry',
      zoteroKey: 'K1',
    },
  ];
  const inc = (zoteroKey: string, role: IncomingZoteroSource['role']): IncomingZoteroSource => ({
    zoteroKey,
    role,
    label: 'Dewey (1922)',
    content: 'new content',
  });

  it('updates an existing source with the same key AND role', () => {
    const { adds, updates } = mergeZoteroImports(existing, [inc('K1', 'bibliographic')]);
    expect(adds).toHaveLength(0);
    expect(updates).toEqual([{ id: 'src_1', label: 'Dewey (1922)', content: 'new content' }]);
  });

  it('adds when the key matches but the role differs (entry vs full text are two sources)', () => {
    const { adds, updates } = mergeZoteroImports(existing, [inc('K1', 'reference')]);
    expect(updates).toHaveLength(0);
    expect(adds).toHaveLength(1);
  });

  it('adds when the key is new', () => {
    const { adds } = mergeZoteroImports(existing, [inc('K9', 'bibliographic')]);
    expect(adds).toHaveLength(1);
  });
});
