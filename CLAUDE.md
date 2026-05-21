# MindReset.ai — persistent project rules

This file is read by every Claude Code session. Anything written here is
load-bearing across sessions; treat it as authoritative until the owner
(Julia) revises it.

## What this project is

**MindReset.ai** is a UK-based, trauma-informed AI self-help platform. It is
**not** therapy, medical, or clinical — it is a self-guided emotional
wellbeing tool. The legal stance is preserved across all surfaces; see
`mindreset-app/docs/product/philosophy.md` for the brand voice and the
language constraints.

## Tech stack at a glance

- **Framework**: Next.js 14.2 App Router, locale-prefixed routes via `[locale]`
- **Auth**: Clerk v5 (not Supabase Auth — `auth.uid()` will not resolve)
- **DB**: Prisma + Supabase Postgres (Prisma connects as `postgres.*` which
  has `BYPASSRLS`)
- **AI**: Anthropic SDK (`@anthropic-ai/sdk` ^0.30.1) — current model is
  `claude-opus-4-7`
- **Payments**: Stripe SDK ^17 (installed; wiring in progress, Block B)
- **Email**: Resend (installed; not yet wired)
- **i18n**: next-intl v4.12, 8 locales (en + ru native; fr/de/es/it/pl/pt
  placeholders synced from en)

App lives in `mindreset-app/`. Run `npm` commands from inside that directory.

## Branch and merge policy

- Each task gets a feature branch: `claude/<topic>`
- The current session's branch is communicated in the launch system prompt
- **Never push to `main`**. Always open a PR; the agent (you) clicks the
  squash-merge button via GitHub MCP. Julia does not click merge buttons.
- The remote is `juli2admin/mindreset` — but the GitHub MCP **owner**
  parameter must be `Juli2admin` with a capital J
- Old branches are deleted after merge

## Migration policy — DO NOT TOUCH

- **All schema migrations are run MANUALLY by Julia in the Supabase SQL
  editor.**
- **Never run `prisma migrate dev`, `prisma migrate deploy`, or
  `prisma db push` against any environment.**
- When you change `schema.prisma`, propose the migration SQL in the PR body
  as a copy-pasteable block. Julia runs it manually before/after merge as
  appropriate.
- The Prisma client is regenerated automatically on `npm install` and
  `npm run build`.

## Stop-hook + propose-and-pause workflow

- A user stop-hook forces commits on feature branches before any pause.
  This means the agent MUST commit work-in-progress before going idle.
- The "review gate" therefore moves to the PR boundary, not mid-session.
- When the agent proposes copy/code that needs owner sign-off, draft it
  inline for line review first. Once approved, write to files in one batch.

## i18n rules

- **8 locales**: en, ru, fr, de, es, it, pl, pt (see
  `mindreset-app/i18n/routing.ts`)
- **Native bundles**: en (source of truth), ru (hand-curated)
- **Placeholder bundles**: fr, de, es, it, pl, pt — byte-identical copies of
  en.json, propagated by `npm run i18n:sync`
- Native-locale set lives in `mindreset-app/components/LanguagePicker.tsx`
  (`NATIVE_CONTENT_LOCALES`) — mirrors what `sync-placeholders.mjs` does NOT
  touch
- Pre-build runs `npm run i18n:check` (catches drift); pre-commit hook also
  exists but isn't installed on Julia's Windows machine — Vercel's
  pre-build provides equivalent protection
- See `mindreset-app/docs/architecture/i18n.md` for the full picture

## RU translation style — locked

- **Formal Вы** by default; informal **ты** at trauma-soft moments only
  (the existing `Screening.yellowCta = "Когда будешь готова"` is an
  intentional soft-moment exception)
- **Feminine grammatical forms** are RU canonical (your reader is assumed
  female-presenting in the absence of a gender signal)
- **Locale-specific quote marks**: RU/FR/ES/IT/PT use «», DE/PL use „"
- Full rules + glossary + examples in
  `mindreset-app/i18n-tools/translate-prompt.md`

## Brand language — Stripe surfaces only

These constraints apply to Stripe product names, Stripe Checkout copy,
receipts, and any payment-surface-adjacent UI. They do **not** apply to
in-app screening, MiniMind prompt, or Landing copy.

**Forbidden on payment surfaces**: therapy, therapeutic, treatment,
medical, mental illness, diagnosis, counseling, counselling, clinical
intervention, unlimited.

**Approved**: self-help, self-guided reflection, emotional wellbeing,
personal growth, trauma-informed self-development, recovery support,
companion for daily reflection.

See `mindreset-app/docs/product/philosophy.md` for the full list and
rationale.

## Pricing — locked (Block B, spec v2 — 2026-05-21)

### MiniMind
- **Free taster** — **50 messages lifetime** (per email, one shot), no card
- **MiniMind Essential** — £14.99/month or £129/year — 200 msgs/cycle
- **MiniMind Extended** — £24.99/month or £209/year — 800–1,200 msgs/cycle
- **Message top-up** — £4.99 one-off — +200 msgs to current cycle, expires at reset

### States & Themes (Block B — billing wired, content delivery Block C)
- **S&T module (non-subscriber)** — £59 per module, one-off, permanent access
- **S&T module (subscriber)** — £29 per module (discount auto-applied at checkout)
- **S&T All Access subscription — DROPPED.** Does not exist. Do not create in Stripe.

### The Journey (Block B — billing wired, content delivery Block C)
- **One-off** — £599, non-refundable once first block accessed
- **Installment** — 12 × £55/week, NOT a subscription; can stop, no refund on paid weeks

Full spec: `mindreset-app/docs/implementation/block-b-stripe-plan.md`

## VAT / market

- **Julia is NOT VAT-registered.** Stripe Tax stays OFF.
- **UK-only at launch** — Stripe Checkout restricts billing to GB.
- Prices are final (no VAT added at checkout).

## MiniMind prompt — dual source of truth

The MiniMind v2.3 system prompt exists in TWO places:

1. `mindreset-app/lib/minimind/prompt.ts` — the code-loaded string
2. `mindreset-app/docs/minimind/MiniMind_System_Prompt_v2.3.md` — the
   reviewable canonical document

**Any change to one MUST be mirrored in the other in the same commit.**

## Untracked diagnostic scripts

- `mindreset-app/scripts/` is gitignored. It holds `test-db.mjs` and any
  other local diagnostic scripts.
- **Do not `git add scripts/`.**

## GitHub MCP

- Restricted to `juli2admin/mindreset` (owner param: `Juli2admin`)
- Use `gh`-equivalent MCP tools (no CLI gh access)
- Don't post review comments unless genuinely necessary — Julia reads the
  diff directly

## Where things live

| Document | Path |
|---|---|
| Roadmap (v1, 15 May 2026 — out of date in places) | `mindreset-app/docs/roadmap/MindReset_Roadmap_v1.md` |
| MiniMind prompt canonical | `mindreset-app/docs/minimind/MiniMind_System_Prompt_v2.3.md` |
| Data-model overview | `mindreset-app/architecture.md` |
| Running log of lessons / dropped features | `docs/carry-forward.md` |
| Legal documents | `docs/MindReset_Legal_Documents_EN.md` |
| Security version-bump deferrals | `docs/security-deferrals.md` |
| RLS SQL canonical | `mindreset-app/db/rls.sql` |
| Architecture details (new) | `mindreset-app/docs/architecture/` |
| Product spec (new) | `mindreset-app/docs/product/` |
| Implementation plans (new) | `mindreset-app/docs/implementation/` |
| Locked decisions log (new) | `mindreset-app/docs/decisions/locked-decisions.md` |
| Open questions log (new) | `mindreset-app/docs/decisions/open-questions.md` |

## Tone of agent output

Be tight. Short user-facing updates; no narrating internal deliberation. If
copy needs owner sign-off, propose inline and pause. Don't add features,
refactors, or abstractions beyond what was asked.
