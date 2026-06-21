import { describe, expect, it } from 'vitest';
import { parseCslJson, referenceToSourceContent } from '../bibImport';

const article = {
  type: 'article-journal',
  title: 'The Reflex Arc Concept in Psychology',
  author: [{ family: 'Dewey', given: 'John' }],
  issued: { 'date-parts': [[1896]] },
  'container-title': 'Psychological Review',
  volume: '3',
  issue: '4',
  page: '357-370',
  DOI: '10.1037/h0070405',
  abstract: 'A critique of the reflex arc.',
};

const book = {
  type: 'book',
  title: 'Human Nature and Conduct',
  author: [{ family: 'Dewey', given: 'John' }],
  issued: { 'date-parts': [[1922]] },
  publisher: 'Henry Holt',
};

describe('parseCslJson', () => {
  it('parses a single object', () => {
    const refs = parseCslJson(JSON.stringify(article));
    expect(refs).toHaveLength(1);
    expect(refs[0].labelStem).toBe('Dewey');
    expect(refs[0].year).toBe('1896');
  });

  it('parses a top-level array', () => {
    const refs = parseCslJson(JSON.stringify([article, book]));
    expect(refs).toHaveLength(2);
  });

  it('formats a journal article in APA, with volume/issue/page and a DOI link', () => {
    const { apa } = parseCslJson(JSON.stringify(article))[0];
    expect(apa).toBe(
      'Dewey, J. (1896). The Reflex Arc Concept in Psychology. Psychological Review, 3(4), 357-370. https://doi.org/10.1037/h0070405',
    );
  });

  it('formats a book in APA, using the publisher', () => {
    const { apa } = parseCslJson(JSON.stringify(book))[0];
    expect(apa).toBe('Dewey, J. (1922). Human Nature and Conduct. Henry Holt.');
  });

  it('joins two authors with an ampersand in both stem and APA', () => {
    const ref = parseCslJson(
      JSON.stringify({
        title: 'Knowing and the Known',
        author: [
          { family: 'Dewey', given: 'John' },
          { family: 'Bentley', given: 'Arthur F.' },
        ],
        issued: { 'date-parts': [[1949]] },
        publisher: 'Beacon Press',
      }),
    )[0];
    expect(ref.labelStem).toBe('Dewey & Bentley');
    expect(ref.apa).toContain('Dewey, J., & Bentley, A. F.');
  });

  it('collapses three or more authors to "et al." in the stem', () => {
    const ref = parseCslJson(
      JSON.stringify({
        title: 'X',
        author: [
          { family: 'Adams', given: 'A' },
          { family: 'Brown', given: 'B' },
          { family: 'Clark', given: 'C' },
        ],
        issued: { 'date-parts': [[2000]] },
      }),
    )[0];
    expect(ref.labelStem).toBe('Adams et al.');
  });

  it('falls back to "n.d." when no year is present', () => {
    const ref = parseCslJson(
      JSON.stringify({ title: 'Untitled work', author: [{ family: 'Smith', given: 'Jane' }] }),
    )[0];
    expect(ref.year).toBe('n.d.');
    expect(ref.apa).toBe('Smith, J. (n.d.). Untitled work.');
  });

  it('handles a missing author by leading with the title', () => {
    const ref = parseCslJson(
      JSON.stringify({
        title: 'Publication Manual of the APA',
        issued: { 'date-parts': [[2020]] },
        publisher: 'APA',
      }),
    )[0];
    expect(ref.labelStem).toBe('Publication Manual of');
    expect(ref.apa).toBe('Publication Manual of the APA. (2020). APA.');
  });

  it('uses an editor when no author is present', () => {
    const ref = parseCslJson(
      JSON.stringify({
        title: 'A Collection',
        editor: [{ family: 'Jones', given: 'Pat' }],
        issued: { 'date-parts': [[2010]] },
      }),
    )[0];
    expect(ref.labelStem).toBe('Jones');
    expect(ref.apa).toContain('Jones, P.');
  });

  it('returns [] for invalid JSON, null, or non-object input', () => {
    expect(parseCslJson('{not json')).toEqual([]);
    expect(parseCslJson('null')).toEqual([]);
    expect(parseCslJson('42')).toEqual([]);
    expect(parseCslJson('[]')).toEqual([]);
  });
});

describe('referenceToSourceContent', () => {
  it('appends the abstract under an ABSTRACT heading when present', () => {
    const ref = parseCslJson(JSON.stringify(article))[0];
    const content = referenceToSourceContent(ref);
    expect(content).toBe(
      'Dewey, J. (1896). The Reflex Arc Concept in Psychology. Psychological Review, 3(4), 357-370. https://doi.org/10.1037/h0070405\n\nABSTRACT\nA critique of the reflex arc.',
    );
  });

  it('is just the APA line when no abstract is present', () => {
    const ref = parseCslJson(JSON.stringify(book))[0];
    expect(referenceToSourceContent(ref)).toBe(
      'Dewey, J. (1922). Human Nature and Conduct. Henry Holt.',
    );
  });
});
