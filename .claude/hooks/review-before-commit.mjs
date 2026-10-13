// PreToolUse hook (Bash): at `git commit`, puts the review step in context. Never blocks the command.
// Reads the hook payload from stdin; prints additionalContext JSON only for commit commands.
import { readFileSync } from 'node:fs';

// ponytail: `git ... commit` within one command segment; also fires on e.g. `git log --grep commit`.
export const COMMIT = /\bgit\b[^;&|\n]*?\scommit(?![\w-])/;

export const REMINDER =
  'Review gate: the user rules require the code-reviewer agent on the staged diff after code changes, before a commit. The agent has no shell: paste the output of `git diff --cached` into its prompt. A commit that only touches docs or fixtures needs no review.';

export function hookOutput(payload) {
  const command = payload?.tool_input?.command;
  if (typeof command !== 'string' || !COMMIT.test(command)) return '';
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: REMINDER } });
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
