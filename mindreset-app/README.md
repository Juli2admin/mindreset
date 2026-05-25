# MindReset.ai

A trauma-informed self-help platform. Not therapy, not a crisis service —
a structured digital reflection tool for emotional clarity, inner stability,
and a sense of self-direction.

The live product comprises three offerings of increasing depth:

- **MiniMind** — a daily AI companion that doubles as a hidden diagnostic layer
- **States & Themes** — short focused modules on specific moments and patterns
- **The Journey** — an eight-stage transformation programme, gated by safety

This repository contains the codebase. The architecture is documented in
[`architecture.md`](./architecture.md) — read that first for the design rationale.

## Stack

- **Next.js 14** (App Router) — pages, server components, API routes
- **TypeScript** + **Tailwind CSS** — typed UI in a single file format
- **PostgreSQL** via **Prisma** — relational store; schema in `prisma/schema.prisma`
- **Clerk** — authentication
- **Stripe** — payments (subscription + one-off purchases)
- **Anthropic Claude API** — the AI conversation engine
- **Resend** — transactional email
- **next-intl** — localisation framework (EN/RU active, more scaffolded)

Deployed on **Vercel** (recommended) — `git push` deploys.

## Getting started locally

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Fill in the credentials in .env.local — see "Environment variables" below

# 3. Generate Prisma client and migrate the database
npm run prisma:generate
npm run prisma:migrate

# 4. Run dev server
npm run dev
# Open http://localhost:3000
```

You should see the landing page. Click **Begin** to land in `/screening`.

## Environment variables

All in `.env.example`. The minimum to run anything is `DATABASE_URL` (Postgres).
For full functionality you also need Clerk, Anthropic, Stripe, and Resend keys.

| Variable | Purpose | When needed |
|----------|---------|-------------|
| `DATABASE_URL` | Postgres connection | Always |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | User auth | When you wire auth |
| `ANTHROPIC_API_KEY` | Claude API for MiniMind chat | When you wire MiniMind |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Payments | When you wire purchases |
| `RESEND_API_KEY` | Transactional email | When you wire emails |
| `NEXT_PUBLIC_APP_URL` | Used in OAuth redirects, webhook URLs | Always |

## Project structure

```
mindreset-app/
├── README.md                    # This file
├── architecture.md              # Plain-language data model overview
├── package.json
├── next.config.mjs
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── .env.example
├── .gitignore
│
├── app/                         # Next.js App Router
│   ├── layout.tsx               # Root layout (fonts, metadata)
│   ├── globals.css              # Tailwind directives
│   ├── page.tsx                 # `/` — landing
│   └── screening/
│       └── page.tsx             # `/screening` — Section 0 questionnaire
│
├── components/                  # React components
│   ├── Landing.jsx              # Landing page (full)
│   └── Screening.jsx            # Screening flow (Section 0)
│
└── prisma/
    └── schema.prisma            # Database schema
```

## What works today

- **`/`** — full landing page with day/night theming, EN/RU, copy ready
- **`/screening`** — full Section 0 questionnaire with GREEN/YELLOW/RED classification
- Day/night toggle, language switcher, all the brand UI

**Important:** the screening currently classifies on the client and shows the result
in-page. It does not yet persist to the database. Wiring it to write `ScreeningResponse`
records (per `schema.prisma`) is the first real data-flow task.

## Roadmap

The phases below assume a single-developer pace and a focus on safety-correctness over speed.

### Phase 1 — Foundation (this codebase)
- ✅ Landing page (`/`)
- ✅ Screening flow (`/screening`)
- ✅ Brand system (colours, fonts, dark mode, multilingual)
- ✅ Database schema
- ⬜ Wire `/screening` submission to `ScreeningResponse` table
- ⬜ Provision Postgres on Vercel/Supabase
- ⬜ Deploy to Vercel under mindresetai.com

### Phase 2 — Accounts & payments
- ⬜ Clerk auth integration (`/sign-in`, `/sign-up`)
- ⬜ Account / settings page (`/account`)
- ⬜ Stripe products and checkout flow
- ⬜ Webhook handler for Stripe events
- ⬜ Email transactional flow (Resend)

### Phase 3 — MiniMind (the sensor)
- ⬜ Streaming Claude API chat UI (`/minimind`)
- ⬜ System prompt: "Stable-Compassion" voice + safety boundaries
- ⬜ Real-time safety scanner (keyword + LLM verifier)
- ⬜ `SafetyEvent` logging
- ⬜ Assessment engine: read conversations → update `WellbeingSnapshot`
- ⬜ Repeat-state counter → "deeper module" suggestion

### Phase 4 — Modules (States & Themes)
- ⬜ Module data layer (4 States + 5 Themes)
- ⬜ Module player (`/modules/[id]`) with depth gating
- ⬜ Stripe one-off purchase per module
- ⬜ Practice tracking

### Phase 5 — The Journey (Recode)
- ⬜ Sequential 8-block player (`/journey/[block]`)
- ⬜ SSC gating between blocks
- ⬜ Progress tracking
- ⬜ Admin panel for reviewing `SafetyEvent` queue

## Known caveats

- **Fonts** are loaded via a `<link>` tag in `app/layout.tsx`. Migrating to
  `next/font` for proper preloading and self-hosting is a worthwhile improvement.
- **Components are still `.jsx`** rather than `.tsx`. Typed versions are
  straightforward to add when patterns settle.
- **No internationalisation framework yet.** Languages are hardcoded in COPY
  objects per component. Migrate to `next-intl` when adding more locales.
- **Safety event scanning** in production must use both keyword pre-screening
  AND an LLM verifier — keyword alone is too noisy, LLM alone is too slow.

## A note on safety

This product touches mental health. The screening flow, the safety event
logging, and the gating between modules are not features to be optimised away.
They are the legal and ethical foundation that lets MindReset exist as a
self-help platform rather than an unregulated medical service.

If you are extending this codebase: anything that touches the user's mental state,
flags potential crisis, or claims clinical authority must be reviewed against
[`architecture.md`](./architecture.md) and the methodology documents. When in
doubt, gate it. When in serious doubt, point the user to a real human service.
