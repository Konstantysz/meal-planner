import { describe, it, expect } from 'vitest';
import { hookOutput, reminder } from '../../.claude/hooks/review-before-commit.mjs';

const DIFF = '/repo/.git/review.diff';
const bash = (command: string, writeDiff = () => DIFF) =>
  hookOutput({ tool_name: 'Bash', tool_input: { command } }, writeDiff) as string;

describe('review-before-commit hook', () => {
  it.each(['git commit -m "x"', 'git -C F:/meal-planner commit -q -m x', 'git add a && git commit --amend'])(
    'adds the reminder, pointing at the diff file, for: %s',
    (cmd) => {
      expect(JSON.parse(bash(cmd))).toEqual({
        hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: reminder(DIFF) },
      });
      expect(reminder(DIFF)).toContain(DIFF);
    },
  );

  it('tells the agent how to write the diff when the hook could not', () => {
    const out = JSON.parse(bash('git commit -m x', () => null as never));
    expect(out.hookSpecificOutput.additionalContext).toContain('git diff --cached > .git/review.diff');
  });

  it('does not write a diff for commands that are not commits', () => {
    let writes = 0;
    bash('git status', () => (writes++, DIFF));
    expect(writes).toBe(0);
  });

  it.each(['git status', 'git log --oneline', 'git commit-tree abc', 'pnpm test'])('stays silent for: %s', (cmd) => {
    expect(bash(cmd)).toBe('');
  });

  it('stays silent on a malformed payload', () => {
    expect(hookOutput({})).toBe('');
    expect(hookOutput(null)).toBe('');
  });
});
