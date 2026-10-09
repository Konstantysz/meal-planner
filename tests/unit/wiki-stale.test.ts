import { describe, it, expect } from 'vitest';
import { parseNumstat, stalePages } from '../../scripts/wiki-stale';

const page = (extra: string) => `---\ntitle: "t"\n${extra}---\n\n# t\n`;

describe('stalePages', () => {
  it('reports pages whose sources changed since verified_commit', () => {
    const files = [
      {
        path: 'concepts/a.md',
        content: page('verified_commit: abc1234\nsources:\n  - title: "x"\n    path: src/a.ts\n'),
      },
      {
        path: 'concepts/b.md',
        content: page('verified_commit: abc1234\nsources:\n  - title: "x"\n    path: src/b.ts\n'),
      },
      { path: 'concepts/c.md', content: page('sources:\n  - title: "x"\n    path: src/c.ts\n') },
      {
        path: 'concepts/d.md',
        content: page(
          'verified_commit: abc1234\nsources:\n  - title: "u"\n    url: "https://x.y"\n    accessed: 2026-10-09\n',
        ),
      },
    ];
    const diff = (_c: string, paths: string[]) =>
      paths[0] === 'src/a.ts' ? [{ path: 'src/a.ts', added: 3, deleted: 1 }] : [];
    expect(stalePages(files, diff)).toEqual([
      { page: 'concepts/a.md', commit: 'abc1234', changed: [{ path: 'src/a.ts', added: 3, deleted: 1 }] },
    ]);
  });
});

describe('parseNumstat', () => {
  it('drops whitespace-only files and counts binary files as changed', () => {
    const out = '3\t1\tsrc/a.ts\n0\t0\tsrc/ws.ts\n-\t-\tpublic/x.png\n';
    expect(parseNumstat(out).map((c) => c.path)).toEqual(['src/a.ts', 'public/x.png']);
  });
});
