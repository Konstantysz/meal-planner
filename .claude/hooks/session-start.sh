#!/bin/bash
# SessionStart hook for Claude Code cloud sessions: dependencies, base branch for db:order,
# and Matt Pocock's skills (github.com/mattpocock/skills) in ~/.claude/skills.
# Local machines install the skills as a plugin instead: claude plugin install mattpocock-skills@claude-plugins-official
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile

# db:order compares supabase/migrations with origin/main.
git fetch --quiet origin main || echo "session-start: could not fetch origin/main" >&2

# Skills: pinned, so upstream changes reach the agent only when this SHA is bumped on purpose.
# Best effort: a network failure must not block the session.
skills_sha=49dd158d1076134a641b33efb035946536778336
skills_src="$HOME/.cache/mattpocock-skills"
skills_dst="$HOME/.claude/skills"
if [ "$(git -C "$skills_src" rev-parse HEAD 2>/dev/null)" != "$skills_sha" ]; then
  rm -rf "$skills_src"
  git init --quiet "$skills_src" &&
    git -C "$skills_src" fetch --quiet --depth 1 https://github.com/mattpocock/skills "$skills_sha" &&
    git -C "$skills_src" checkout --quiet FETCH_HEAD || rm -rf "$skills_src"
fi
if [ -d "$skills_src/skills" ]; then
  mkdir -p "$skills_dst"
  for group in engineering productivity misc; do
    for dir in "$skills_src/skills/$group"/*/; do
      [ -f "$dir/SKILL.md" ] || continue
      name=$(basename "$dir")
      rm -rf "${skills_dst:?}/$name"
      cp -R "$dir" "$skills_dst/$name"
    done
  done
fi
