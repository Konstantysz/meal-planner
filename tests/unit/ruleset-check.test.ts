import { describe, it, expect } from 'vitest';
import { diffChecks, requiredChecks } from '../../scripts/ruleset-check';

const rules = [
  { type: 'deletion' },
  {
    type: 'required_status_checks',
    parameters: { required_status_checks: [{ context: 'test' }, { context: 'lint' }] },
  },
];

describe('requiredChecks', () => {
  it('lists the required status checks, sorted, and ignores other rules', () => {
    expect(requiredChecks(rules)).toEqual(['lint', 'test']);
    expect(requiredChecks([{ type: 'deletion' }])).toEqual([]);
  });
});

describe('diffChecks', () => {
  it('reports checks the file wants that GitHub lacks, and the reverse', () => {
    expect(diffChecks(['lint', 'db'], ['lint', 'build'])).toEqual({ missing: ['db'], extra: ['build'] });
    expect(diffChecks(['lint'], ['lint'])).toEqual({ missing: [], extra: [] });
  });
});
