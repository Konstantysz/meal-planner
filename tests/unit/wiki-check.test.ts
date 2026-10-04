import { describe, it, expect } from 'vitest';
import { checkWiki, type WikiFile } from '../../scripts/wiki-check';

const fm = (title: string, extra = '') => `---
title: "${title}"
summary: "s"
tags: [meta]
status: review
owner: "@o"
created: 2026-10-04
updated: 2026-10-04
last_reviewed: null
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "m"
human_reviewed: false
sources: []
${extra}---
`;

const page = (title: string, body: string, extra = '') =>
  `${fm(title, extra)}\n# ${title}\n\n> [!tldr]\n> t\n\n## Context\n\n${body}\n\n## Related\n\n## Sources\n\n## Changelog\n`;

const valid = (): WikiFile[] => [
  { path: 'README.md', content: page('Home', 'See [[concepts]] and [[taxonomy]].') },
  { path: 'concepts/concepts.md', content: page('Concepts', 'Back to [[README]], see [[week-plan#Slots]].') },
  { path: 'concepts/week-plan.md', content: page('Week plan', 'Index: [[concepts]].\n\n## Slots') },
  { path: '_meta/meta.md', content: page('Meta', '[[README]] [[taxonomy]]') },
  { path: '_meta/taxonomy.md', content: page('Taxonomy', '[[meta]]', 'allowed_tags: [meta]\n') },
];

const exists = () => true;

describe('checkWiki', () => {
  it('accepts a well-formed wiki', () => {
    expect(checkWiki(valid(), exists)).toEqual([]);
  });

  it('reports broken links, bad anchors, orphans and unknown tags', () => {
    const files = valid();
    files[1].content = page('Concepts', '[[README]] [[nope]] [[week-plan#Missing]]');
    files.push({
      path: 'concepts/lonely.md',
      content: page('Lonely', '[[concepts]]').replace('tags: [meta]', 'tags: [bogus]'),
    });
    const errors = checkWiki(files, exists).join('\n');
    expect(errors).toContain('broken link [[nope]]');
    expect(errors).toContain('[[week-plan#Missing]] anchor not found');
    expect(errors).toContain('concepts/lonely.md: orphan');
    expect(errors).toContain('tag "bogus" not in taxonomy');
  });

  it('enforces the stable-page invariants and repo source paths', () => {
    const files = valid();
    files[2].content = page('Week plan', '[[concepts]]\n\n## Slots')
      .replace('status: review', 'status: stable')
      .replace('sources: []', 'sources:\n  - title: "x"\n    path: src/missing.ts');
    const errors = checkWiki(files, (p) => p !== 'src/missing.ts').join('\n');
    expect(errors).toContain('stable page needs last_reviewed');
    expect(errors).toContain('stable page needs human_reviewed: true');
    expect(errors).toContain('source path not found: src/missing.ts');
  });

  it('ignores links inside code and resolves aliases', () => {
    const files = valid();
    files[2].content = page(
      'Week plan',
      '[[concepts]] `[[ghost]]`\n\n```md\n[[ghost]]\n```\n\n## Slots',
      'aliases: [plan]\n',
    );
    files[1].content = page('Concepts', '[[README]] [[plan|Week plan]]');
    expect(checkWiki(files, exists)).toEqual([]);
  });
});
