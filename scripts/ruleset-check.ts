/**
 * Compares the status checks GitHub requires on the default branch with `.github/rulesets/main-protection.json`.
 * Merging a change to the file does nothing on GitHub by itself (docs/wiki/references/github-workflows.md, "Syncing the
 * ruleset after editing the file"), so this goes red until an admin has applied it.
 *
 * Usage: pnpm ruleset:check      (needs `gh` signed in, or GH_TOKEN)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

const Rules = z.array(
  z.object({
    type: z.string(),
    parameters: z
      .object({ required_status_checks: z.array(z.object({ context: z.string() })) })
      .partial()
      .optional(),
  }),
);
const RulesetFile = z.object({ rules: Rules });

/** The `context` of every required status check among `rules`, sorted. */
export function requiredChecks(rules: z.infer<typeof Rules>): string[] {
  return rules
    .filter((r) => r.type === 'required_status_checks')
    .flatMap((r) => r.parameters?.required_status_checks?.map((c) => c.context) ?? [])
    .sort();
}

/** What the file wants that GitHub lacks (`missing`), and what GitHub enforces that the file dropped (`extra`). */
export function diffChecks(wanted: string[], live: string[]) {
  return { missing: wanted.filter((c) => !live.includes(c)), extra: live.filter((c) => !wanted.includes(c)) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const file = RulesetFile.parse(JSON.parse(readFileSync('.github/rulesets/main-protection.json', 'utf8')));
  const live = Rules.parse(
    JSON.parse(execFileSync('gh', ['api', 'repos/{owner}/{repo}/rules/branches/main'], { encoding: 'utf8' })),
  );
  const { missing, extra } = diffChecks(requiredChecks(file.rules), requiredChecks(live));
  if (missing.length || extra.length) {
    console.error(
      `ruleset-check: GitHub does not enforce the ruleset file. Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}.\n` +
        'An admin applies the file: docs/wiki/references/github-workflows.md, "Syncing the ruleset after editing the file".',
    );
    process.exit(1);
  }
  console.log('ruleset-check: GitHub requires exactly the checks in the ruleset file');
}
