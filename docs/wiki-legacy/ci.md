# CI/CD: Backup and keepalive workflows

## Workflows

Two GitHub Actions workflows maintain the Supabase database:

1. **Keepalive** (`.github/workflows/keepalive.yml`)
   - Runs every 5 days at 06:00 UTC
   - Pings Supabase `GET /rest/v1/ingredients?select=id&limit=1` to prevent database suspension
   - Manual trigger: `gh workflow run keepalive.yml`

2. **Backup** (`.github/workflows/backup.yml`)
   - Runs every Sunday at 03:00 UTC
   - Exports full Supabase PostgreSQL dump using `supabase db dump`
   - Uploads artifact retained for 90 days
   - Manual trigger: `gh workflow run backup.yml`

## Required GitHub Secrets

Before workflows run, configure these in repo Settings → Secrets → Actions:

| Secret | Source | Notes |
|---|---|---|
| `SUPABASE_URL` | Supabase dashboard → Settings → API | Base URL like `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API | Anon key for public REST access |
| `SUPABASE_DB_URL` | Supabase dashboard → Database → Connection string → URI | Service role connection string (starts with `postgresql://`) |

## Status

- ✗ Secrets not yet configured (no GitHub remote)
- ✗ Workflows not tested live (no GitHub Actions run history)
- → Set secrets when pushing to GitHub before workflows will execute

## Notes

- Backup artifacts are ephemeral (90-day retention); for long-term backups, consider integrating with external storage (S3, GCS)
- Keepalive ping is a lightweight health check; a real database monitoring solution (e.g., database query alerts) is recommended for production
- Both workflows support manual dispatch for testing via `gh workflow run`
