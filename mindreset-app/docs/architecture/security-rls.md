# Security — Postgres Row-Level Security

## The fix (20 May 2026)

Supabase security advisor flagged 10 public tables with RLS **disabled**.
This meant `anon` and `authenticated` Postgres roles — exposed through
PostgREST — could in principle read/write the data. No breach occurred
(the app uses Clerk, not Supabase Auth, and never calls Supabase with
the anon key), but the gap was a real one.

Resolution: **RLS enabled + REVOKE ALL** from `anon`/`authenticated` on
all 10 tables. Codified in `mindreset-app/db/rls.sql`. PR #20
(SHA `c60f007`).

## Why this is compatible with Prisma

Prisma connects as the `postgres.<project-ref>` role, which has the
`BYPASSRLS` privilege. RLS policies do not apply to this role. The app
keeps working without any policy authoring; the only effect of enabling
RLS is that `anon`/`authenticated` are now blocked from reading the
tables (which they should never have been able to read anyway).

## Canonical SQL

See `mindreset-app/db/rls.sql`. The file wraps two blocks in a
transaction:

1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for each of the 10 tables
2. `REVOKE ALL ON TABLE ... FROM anon, authenticated` for each

This is a **disaster-recovery file**, not a Prisma migration. It's run
manually by Julia in the Supabase SQL editor when needed (e.g. restoring
from a backup, or any time a table is created without RLS).

## When a new table is added

Whenever `prisma/schema.prisma` gains a new model and Julia runs the
manual SQL to create the table, the same RLS + REVOKE block must be
applied to the new table. The canonical text to append to `db/rls.sql`:

```sql
ALTER TABLE "NewTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "NewTable" FROM anon, authenticated;
```

This pattern is also documented in `docs/carry-forward.md` under the
"Security — RLS enabled" section.

## Why no policies

The app never authenticates a user as `anon`/`authenticated` against
Supabase. All data access goes through Prisma → postgres role
(BYPASSRLS). There is no need for granular RLS policies, only the
table-level blanket REVOKE that prevents anon access via PostgREST.

If/when the app ever uses Supabase Auth or PostgREST directly, real
RLS policies would need to be authored. That is not on the roadmap.

## What auditors will look for

- ✅ All tables have RLS enabled
- ✅ All tables are revoked from public/anon roles
- ✅ The app uses a privileged role (postgres.*) that bypasses RLS
- ✅ The privileged role's credentials are stored in environment
  variables only, never in client-shipped code
- ✅ Supabase anon key is not embedded in the app (since the app doesn't
  use Supabase Auth)

## Related security notes

- Version-bump deferrals for `next`, `@clerk/nextjs`, `eslint-config-next`
  live in `docs/security-deferrals.md`
- No XSS / CSRF / injection concerns flagged on the current codebase as
  of 20 May 2026
- Anthropic API key, Clerk secret, Stripe secret, Resend key all live in
  Vercel env vars only
