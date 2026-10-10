import { describe, it, expect } from 'vitest';
import { exportedFunctions, findUncovered, notCoveredSection } from '../../scripts/test-coverage-check';

const src = `export function a() {}
export async function b() {}
export const c = (x: number) => x;
export const d = async (x: number): Promise<void> => {};
export const e = z.object({});
export type F = string;
function g() {}
`;

describe('exportedFunctions', () => {
  it('finds exported function declarations and arrow consts only', () => {
    expect(exportedFunctions(src)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('notCoveredSection', () => {
  it('returns text between "Not covered" and the next heading', () => {
    expect(notCoveredSection('## A\nx\n## Not covered\n`foo`\n## B\nbar\n')).toBe('`foo`\n');
    expect(notCoveredSection('## Not covered\n`foo`\n')).toBe('`foo`\n');
  });
});

describe('findUncovered', () => {
  it('flags exports absent from both tests and the Not covered list', () => {
    const lib = [{ path: 'src/lib/x.ts', content: src }];
    const res = findUncovered(lib, 'a(); expect(bb)', '`c` is thin');
    expect(res).toEqual([
      { file: 'src/lib/x.ts', name: 'b' },
      { file: 'src/lib/x.ts', name: 'd' },
    ]);
  });
});
