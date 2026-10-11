import { describe, it, expect } from 'vitest';
import { hookOutput, REMINDER } from '../../.claude/hooks/review-before-commit.mjs';

const bash = (command: string) => hookOutput({ tool_name: 'Bash', tool_input: { command } }) as string;

describe('review-before-commit hook', () => {
  it.each(['git commit -m "x"', 'git -C F:/meal-planner commit -q -m x', 'git add a && git commit --amend'])(
    'adds the reminder for: %s',
    (cmd) => {
      expect(JSON.parse(bash(cmd))).toEqual({
        hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: REMINDER },
      });
    },
  );

  it.each(['git status', 'git log --oneline', 'git commit-tree abc', 'pnpm test'])('stays silent for: %s', (cmd) => {
    expect(bash(cmd)).toBe('');
  });

  it('stays silent on a malformed payload', () => {
    expect(hookOutput({})).toBe('');
    expect(hookOutput(null)).toBe('');
  });
});
