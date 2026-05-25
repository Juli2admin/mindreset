# Architecture overview

High-level map of how the parts connect. For the plain-language
data-model tour, see `../../architecture.md`.

## Stack

- **Next.js 14.2 App Router**, locale-prefixed (`app/[locale]/...`)
- **Clerk v5** for auth (sign-in/sign-up routes mounted at
  `/[locale]/sign-in` and `/[locale]/sign-up`, NOT the Clerk-hosted
  defaults)
- **Prisma 5** ORM against **Supabase Postgres**
- **Anthropic SDK** for MiniMind chat + future translation pass
- **Stripe SDK v17** (installed, wiring in progress — Block B)
- **Resend v4** (installed, not yet wired)
- **next-intl v4.12** for i18n
- **Tailwind 3.4** for styling, plus a brand-token system in `lib/brand/`
- Hosted on **Vercel**

## Request flow

```
Browser
  ↓
Vercel Edge (middleware: Clerk auth + next-intl locale match)
  ↓
app/[locale]/<route>/page.tsx
  ↓ (server component, reads cookies/Clerk session)
  ↓
app/[locale]/<route>/<Client>.tsx     (client-rendered UI)
  ↓ (fetch)
app/api/<...>/route.ts                (server endpoints)
  ↓
Prisma → Supabase Postgres
or
Anthropic API (for /api/minimind/chat)
```

## Directory layout (key parts only)

```
mindreset-app/
├── app/
│   ├── [locale]/
│   │   ├── account/                — Account page (paywall + tier display)
│   │   ├── disclaimer/             — Disclaimer-modal route
│   │   ├── minimind/               — MiniMind chat UI
│   │   ├── privacy/, terms/        — Legal pages (EN-only currently)
│   │   ├── screening/              — Section 0 readiness check
│   │   ├── sign-in/, sign-up/      — Clerk-rendered auth
│   │   └── page.jsx                — Landing
│   └── api/
│       ├── disclaimer/acknowledge/
│       ├── minimind/chat/          — Anthropic streaming endpoint
│       ├── minimind/conversations/
│       ├── screening/              — Section 0 classifier
│       └── webhooks/clerk/         — User upsert via svix verification
├── components/                     — Shared client components (TopBar, Footer, LanguagePicker, etc.)
├── i18n/                           — next-intl routing + request config
├── i18n-tools/                     — Translation tooling (NOT in lib/)
├── lib/                            — Brand tokens, format helpers, minimind/, prisma client, screening/
├── messages/                       — 8 JSON message bundles
├── prisma/                         — schema + migrations
└── db/                             — Hand-authored DR/canonical SQL (rls.sql)
```

## Three layers of data

From `architecture.md`:

1. **What the user sees** — conversations, purchases, progress
2. **What we track for safety** — every red flag, immutably logged
3. **What we hold about them** — the diagnostic profile (hidden from
   user), driving every interaction

MiniMind is presented as a daily companion but functions as a sensor
behind the scenes — building a `WellbeingSnapshot` that gates depth
progression and product recommendations.

## Authentication and gating

The legal/safety gate is `T&C → Privacy → Disclaimer → Screening`:

- `tcAcceptedAt`, `privacyAcceptedAt`, `disclaimerAcknowledgedAt` —
  timestamps on `User`, populated at sign-up + first session
- `screeningResult` — one of `green | yellow | red | null`
- Screening result is **informational, not a gate** — users can proceed
  past Yellow or Red, but only after acknowledging the limitations (this
  is locked in T&Cs Section 2)

`User.screeningResult` is populated in two paths:
`/api/screening` writes it directly for signed-in users at screening
time; for anonymous-then-signed-up flows, the `mr_screening` cookie is
backfilled to the new user on first `/minimind` load.

## i18n

- **8 locales**: en, ru, fr, de, es, it, pl, pt
- **Routing**: URL-prefixed (`/en/...`, `/ru/...`) via next-intl
- **Source of truth**: en.json. ru.json is hand-curated. The other 6 are
  byte-identical copies of en.json, kept in sync by
  `npm run i18n:sync`.
- **Pre-build gate**: `npm run i18n:check` validates parity. The Vercel
  build will fail if a placeholder bundle drifts.
- Full details: `./i18n.md`

## Safety architecture

- **Phase 3c keyword scanner + LLM verifier** runs over every MiniMind
  user turn. On a Sev 5 trigger, the conversation enters
  `inCrisisCooldown = true`; only the cooldown holding message is
  served until the verifier sees explicit safety confirmation in a user
  reply.
- **`SafetyEvent` rows are immutable** — they're written, not
  overwritten, and feed a human-review queue.
- Phase 3c keyword scanner is currently **EN-only** (see
  `docs/carry-forward.md`).

## What's NOT yet built

- Stripe billing (Block B, in progress)
- Email sequences (Welcome, AI support pattern A)
- States & Themes / Journey products (Block C, post-launch)
- Cross-session AI memory beyond the conversation-level summary
- `/account` language toggle
- Auth-page translation (sign-in / sign-up / terms / privacy all EN-only)
