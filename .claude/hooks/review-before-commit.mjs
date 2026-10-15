// PreToolUse hook (Bash): at `git commit`, puts the review step in context. Never blocks the command.
// Reads the hook payload from stdin; prints additionalContext JSON only for commit commands.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

// ponytail: `git ... commit` within one command segment; also fires on e.g. `git log --grep commit`.
export const COMMIT = /\bgit\b[^;&|\n]*?\scommit(?![\w-])/;

/** Writes `git diff --cached` to a file inside the git dir (never committed) and returns its path, or null on failure. */
export function writeStagedDiff(cwd) {
  try {
    const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const path = git('rev-parse', '--path-format=absolute', '--git-path', 'review.diff').trim();
    writeFileSync(path, git('diff', '--cached'));
    return path;
  } catch {
    return null;
  }
}

export function reminder(diffPath) {
  const where = diffPath
    ? `This hook wrote the staged diff to ${diffPath}.`
    : 'Write the staged diff with `git diff --cached > .git/review.diff`.';
  return `Review gate: the user rules require the code-reviewer agent on the staged diff after code changes, before a commit. The agent has no shell and reads the diff from a file: ${where} Give the agent that path instead of pasting the diff, and tell it to Read every file the diff touches. If this command stages files itself, stage first and rewrite the file. A commit that only touches docs or fixtures needs no review. A subagent without the Agent tool commits without pushing; its orchestrator reviews the branch diff before pushing.`;
}

export function hookOutput(payload, writeDiff = writeStagedDiff) {
  const command = payload?.tool_input?.command;
  if (typeof command !== 'string' || !COMMIT.test(command)) return '';
  const additionalContext = reminder(writeDiff(payload.cwd ?? process.cwd()));
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext } });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    process.exit(0); // unreadable payload: stay out of the way
  }
  const out = hookOutput(payload);
  if (out) console.log(out);
}
