import { describe, expect, it } from 'vitest';
import { plan, slugify, type BackupFile } from '../importer';

const sampleBackup = (): BackupFile => ({
  schemaVersion: 'twriter-backup/v1',
  exportedAt: '2026-01-01T00:00:00.000Z',
  entries: [
    {
      key: 'socratic_meta_v1',
      // Meta entries are ignored by the importer; the per-project blobs
      // are the source of truth for content.
      value: [{ id: 'proj_1', name: 'A', lastModified: 1, wordCount: 0 }],
    },
    {
      key: 'socratic_p_proj_1',
      value: {
        projectName: 'On Insight',
        markdown: '# Chapter 1\n\nSome prose.',
        testSuite: {},
        revisions: [
          {
            id: 'snap_a',
            timestamp: 100,
            trigger: 'manual',
            affectedScope: 'all',
            contentHash: 'h1',
            markdown: '# Chapter 1\n\nFirst draft.',
            testSuite: {},
          },
          {
            id: 'snap_b',
            timestamp: 200,
            trigger: 'pre-ai-write',
            affectedScope: { sectionIds: ['s1'] },
            contentHash: 'h2',
            markdown: '# Chapter 1\n\nSecond draft.',
            testSuite: { s1: { goals: 'be clear', status: 'idle' } },
            interpolationConfig: undefined,
          },
        ],
        promptsConfig: undefined,
      },
    },
    {
      key: 'socratic_p_proj_2',
      value: {
        projectName: 'On Insight',
        // Same name as proj_1 — exercises the slug-collision suffix.
        markdown: '# Different project',
        revisions: [],
      },
    },
  ],
});

describe('importer.plan', () => {
  it('emits one project_create + 2N revision steps + final commit per project', () => {
    const backup = sampleBackup();
    const result = plan(backup, '/tmp/imports');

    expect(result.projects).toHaveLength(2);
    expect(result.projects[0]).toMatchObject({
      name: 'On Insight',
      revisionCount: 2,
    });
    expect(result.projects[1]).toMatchObject({
      name: 'On Insight',
      revisionCount: 0,
    });

    // Project A: project_create + 2 × (project_write + snapshot_commit) +
    //            final (project_write + snapshot_commit) = 1 + 4 + 2 = 7
    // Project B: project_create + 0 × ... + final 2 = 3
    expect(result.commands).toHaveLength(7 + 3);
  });

  it("slugifies and disambiguates colliding project folder names", () => {
    const backup = sampleBackup();
    const result = plan(backup, '/tmp/imports');
    expect(result.projects[0].folder).toBe('/tmp/imports/on-insight');
    expect(result.projects[1].folder).toBe('/tmp/imports/on-insight-2');
  });

  it('chronologically orders revisions before the final commit', () => {
    const backup: BackupFile = {
      schemaVersion: 'twriter-backup/v1',
      exportedAt: '2026-01-01T00:00:00Z',
      entries: [
        {
          key: 'socratic_p_x',
          value: {
            projectName: 'X',
            markdown: 'final',
            revisions: [
              {
                id: 'newer',
                timestamp: 200,
                trigger: 'manual',
                affectedScope: 'all',
                contentHash: 'h2',
                markdown: 'newer',
                testSuite: {},
              },
              {
                id: 'older',
                timestamp: 100,
                trigger: 'manual',
                affectedScope: 'all',
                contentHash: 'h1',
                markdown: 'older',
                testSuite: {},
              },
            ],
          },
        },
      ],
    };
    const result = plan(backup, '/tmp');
    const writes = result.commands.filter((c) => c.kind === 'project_write');
    // Order: older revision, newer revision, then current state.
    expect(writes[0].kind === 'project_write' && writes[0].data.markdown).toBe(
      'older',
    );
    expect(writes[1].kind === 'project_write' && writes[1].data.markdown).toBe(
      'newer',
    );
    expect(writes[2].kind === 'project_write' && writes[2].data.markdown).toBe(
      'final',
    );
  });

  it('normalizes legacy interpolationConfig to promptsConfig', () => {
    const backup: BackupFile = {
      schemaVersion: 'twriter-backup/v1',
      exportedAt: '2026-01-01T00:00:00Z',
      entries: [
        {
          key: 'socratic_p_y',
          value: {
            projectName: 'Y',
            markdown: 'body',
            interpolationConfig: { systemInstruction: 'legacy' },
            revisions: [],
          },
        },
      ],
    };
    const result = plan(backup, '/tmp');
    const writes = result.commands.filter((c) => c.kind === 'project_write');
    // The final write should carry promptsConfig = the legacy
    // interpolationConfig.
    expect(
      writes[0].kind === 'project_write' &&
        writes[0].data.promptsConfig?.systemInstruction,
    ).toBe('legacy');
  });

  it('skips non-project entries in the backup', () => {
    const backup: BackupFile = {
      schemaVersion: 'twriter-backup/v1',
      exportedAt: '2026-01-01T00:00:00Z',
      entries: [
        { key: 'socratic_meta_v1', value: [] },
        { key: 'treemap_writer_tutorial_seen', value: true },
      ],
    };
    const result = plan(backup, '/tmp');
    expect(result.commands).toHaveLength(0);
    expect(result.projects).toHaveLength(0);
  });

  it('treats unknown trigger values as "manual"', () => {
    const backup: BackupFile = {
      schemaVersion: 'twriter-backup/v1',
      exportedAt: '2026-01-01T00:00:00Z',
      entries: [
        {
          key: 'socratic_p_z',
          value: {
            projectName: 'Z',
            markdown: 'body',
            revisions: [
              {
                id: 's',
                timestamp: 1,
                trigger: 'something-unrecognized' as unknown as 'manual',
                affectedScope: 'all',
                contentHash: 'h',
                markdown: 'body',
                testSuite: {},
              },
            ],
          },
        },
      ],
    };
    const result = plan(backup, '/tmp');
    const commits = result.commands.filter((c) => c.kind === 'snapshot_commit');
    expect(commits[0].kind === 'snapshot_commit' && commits[0].trigger).toBe(
      'manual',
    );
  });
});

describe('slugify', () => {
  it('lower-cases and replaces non-alphanumerics with hyphens', () => {
    expect(slugify('On Insight')).toBe('on-insight');
    expect(slugify('  Hello, World!  ')).toBe('hello-world');
    expect(slugify('NEW-Project_v2')).toBe('new-project-v2');
  });

  it("returns 'project' when the input has nothing to slug", () => {
    expect(slugify('   ')).toBe('project');
    expect(slugify('!!!')).toBe('project');
  });

  it('caps length at 60 chars', () => {
    const long = 'x'.repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });
});
