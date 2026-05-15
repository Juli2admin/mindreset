# MindReset.ai — Roadmap v1

**Last updated: 15 May 2026**
**Author: Julia Loya + architect (Claude.ai)**
**Source session: Day 3 roadmap mapping**

This is the authoritative roadmap from where MindReset stands today (15 May 2026, post flow-reorder merge `35abaea`) through to public launch and beyond. It supersedes earlier roadmap references in handover documents.

The roadmap is organised by **blocks**, not dates. Each block is a coherent group of work that builds toward a specific capability. Blocks are sequenced; work within a block can be ordered flexibly.

---

## Strategic frame

### Launch strategy: soft-launch with MiniMind only

The public launch ships with **MiniMind live and saleable**. States & Themes and The Journey are visible on the account page as "Coming soon" cards. This gives:

- Smaller surface area to test
- Faster validation of unit economics
- The other tiers become genuine upsells marketed to existing users rather than cold launches
- Roughly 4–6 sessions of player-build work moves out of the launch-critical path

### Pricing (locked from Day 2 + Day 3 review)

| Tier | Price |
|---|---|
| MiniMind (capped) | £9.99/month |
| MiniMind (unlimited) | £19.99/month |
| MiniMind top-up | £4.99 for ~200 extra turns |
| Free taster | 50 messages, no time limit (replaces 7-day trial) |
| States & Themes (single module) | £59 one-off |
| States & Themes (all-access) | £29/month |
| The Journey (one-off) | £599 |
| The Journey (instalment plan) | 12 × £55/week |

### Locked principles

- **Trauma-informed always**: no dark patterns, no gamification, no streaks, no celebration moments, no urgency-based marketing.
- **Recognition before recommendation**: users are pointed to deeper tiers only after pattern detection has seen genuine need three times in seven days.
- **The user discovers next tier — never pushed**: tier progression mirrors emotional readiness, not calendar time.
- **No popup upsells. Ever.**
- **Hardship sponsorships exist** but stay off the public pricing page; manual application + review.
- **Non-clinical positioning maintained**: methodology lineages named in legal docs, but MiniMind never describes itself in clinical terms.

---

## Where we are today (post `35abaea`)

### Shipped to production
- Landing page (EN/RU, day/night theming)
- Section 0 screening with classifier + Supabase persistence
- Clerk auth (sign-in, sign-up with T&C/Privacy gate)
- /account with three tier cards (currently "Coming soon")
- /terms + /privacy + Footer + first-visit disclaimer modal
- Flow re-order: Sign in link on Landing, screening → signup routing, /sign-up gated by completed screening, /account banner removed
- **MiniMind backend chat API** (`/api/minimind/chat`) — works, voice tested, Anthropic Sonnet 4.6, stateless

### Architecture in place
- Next.js 14 + TypeScript + Tailwind + Prisma + Postgres (Supabase) + Clerk + Vercel
- Brand tokens centralised in `lib/brand/colors.ts`
- 10-table schema (User, ScreeningResponse, Conversation, Message, SafetyEvent, DiagnosticProfile, Purchase, ModuleProgress, RecodeProgress, Practice)
- Only User and ScreeningResponse have writer code today

### Not yet built
- `/minimind` chat page (UI)
- Conversation/Message DB writes
- Safety scanner / red-flag pre-screen
- DiagnosticProfile updates / cross-session memory
- Stripe billing
- Email sending (Resend)
- Module player / Journey player
- i18n global lift / theme global lift
- Admin control panel
- User-facing progress page
- Feedback loop
- AI support email handling

---

## Block A — Make MiniMind actually usable

This is the next block of work, starting immediately after this roadmap is committed to the repo.

### Phase 3b — Visible MiniMind chat page
**Goal**: a real user can sign in, click MiniMind on /account, and have a streaming conversation with persistent message history within the session.

Scope:
- `/minimind` page with chat UI (message bubbles, input field, send button)
- Streaming text rendering (token-by-token from Anthropic streaming API)
- `Conversation` table writes (one row per chat session)
- `Message` table writes (every user + assistant turn)
- Load last N messages on page mount (continuity within a session)
- Mobile-responsive layout
- Markdown rendering (MiniMind already produces markdown — bold, lists, dividers)
- Brand-consistent (`lib/brand/colors.ts` tokens, Fraunces + Geist fonts)
- Day theme only for v1 (theme lift comes later)

Out of scope for Phase 3b:
- Safety scanner (Phase 3c)
- Cross-session memory loading (Phase 3d)
- Subscription tier gating (Block B)
- Streaming UI animations beyond basic token-by-token
- Pause / resume / regenerate buttons

Estimated scope: 1–2 focused sessions.

---

### Phase 3c — Safety scanner
**Goal**: every user message is checked for red-flag content before reaching the chat. Crisis cases route to UK resources, log a SafetyEvent, and never reach MiniMind.

Scope:
- Fast keyword-based pre-screening (regex/list match) before any Anthropic call
- LLM verifier call (cheap Haiku-level call) for ambiguous cases
- Three-tier classification: clear-crisis / ambiguous / clear-safe
- `SafetyEvent` table writes on every flag
- Crisis response: stop normal MiniMind flow, return canned crisis-resource message (Samaritans 116 123, NHS 111, GP, 999/A&E)
- Logging includes triggerExcerpt + aiResponse + severity + type for later review
- Admin escalation flag (visible later in admin panel)

Out of scope for Phase 3c:
- Admin review UI for SafetyEvents (built in Block E)
- User-facing crisis follow-up flows
- Practitioner directory integration

Estimated scope: 1–2 focused sessions.

**Public launch blocker.** One missed crisis = catastrophic reputational + legal exposure.

---

### Phase 3d — Cross-session memory
**Goal**: MiniMind remembers the user across sessions. She recognises returning users, notices patterns over time, and triggers module suggestions when patterns repeat.

Scope:
- `DiagnosticProfile` periodic updates — separate Claude call every N exchanges (e.g., every 10 turns) analysing the recent conversation and writing structured observations to `DiagnosticProfile`
- Memory loading on chat start: pull `DiagnosticProfile` + `repeat_state_counter` + last screening result + recent conversation summary, inject into MiniMind's runtime context block
- `repeat_state_counter` tracking — classifier on each turn detects expressed state (anxiety, burnout, identity, etc.), increments counter
- Threshold detection: when same state appears 3+ times in 7 days, MiniMind raises module suggestion (already in v2.1 prompt)
- Context block injection per the v2.1 prompt spec

Out of scope for Phase 3d:
- Module suggestion click-through (S&T tier doesn't exist yet — suggestions point to "Coming soon" page)
- Long-term memory beyond DiagnosticProfile (no separate memory store)

Estimated scope: 2–3 focused sessions.

**Public launch blocker** per methodology: MiniMind must remember the user.

---

## Block B — Make MiniMind sellable

Starts after Block A is complete.

### MiniMind two-tier mechanics
**Goal**: enforce the £9.99 message cap, support the £4.99 top-up, and offer £19.99 unlimited.

Scope:
- Free taster: track message count per user, cap at 50 with gentle upgrade prompt
- £9.99 tier: track monthly message count, soft-notification at fair-use threshold (TBD — needs locking)
- £4.99 top-up flow: Stripe one-off purchase adds N extra turns to current month
- £19.99 tier: no cap, no notifications
- All cap notifications are gentle — never block mid-conversation, always offer the upgrade option

**Deferred decisions** (lock at Stripe-wiring time):
- Fair-use threshold for £9.99 tier (number of turns/month before soft notification)
- Exact top-up turn count for £4.99
- Whether £19.99 has any cap at all (probably truly unlimited, accept the small loss on heaviest 2-5%)

Estimated scope: 1 session (builds on Stripe wiring).

---

### Stripe billing — MiniMind only
**Goal**: users can subscribe, upgrade, downgrade, cancel; MiniMind chat API enforces tier.

Scope:
- Stripe checkout for MiniMind £9.99 and £19.99 (recurring subscription)
- Stripe checkout for £4.99 top-up (one-off)
- Stripe webhook handlers: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`
- Webhook writes to `User.miniMindActive` and `User.miniMindUntil`
- `/api/minimind/chat` enforces tier — returns 402/403 if user has no active subscription and has exhausted free taster
- Cancel / manage subscription page (`/account/subscription` or similar)
- Receipt emails (basic transactional via Resend)
- Consumer-waiver checkbox at checkout for non-refundable items (per legal docs)

Out of scope:
- S&T or Journey checkout flows (Block C)
- Refund admin tool (manual via Stripe dashboard for v1)
- Tax handling beyond Stripe's defaults

Estimated scope: 2–3 focused sessions.

**Public launch blocker for MiniMind.**

---

## Block C — The other tiers (POST-PUBLIC-LAUNCH)

Per the soft-launch decision, these move out of the launch-critical path. The /account page shows S&T and Journey as "Coming soon" at launch; we build them once MiniMind is generating revenue.

### States & Themes module player
- Module catalogue page (the four states + five themes)
- Stripe checkout for £59 one-off per module + £29/month all-access
- Module UI: depth-gated content delivery, SSC progression (Stabilisation + Satisfaction Criteria gating between Surface / Middle / Deep)
- Module-specific safety overrides if needed
- Module completion writes to `ModuleProgress`

### The Journey programme player
- 8-block UI with block progression
- Stripe checkout for £599 one-off + 12 × £55/week instalment
- SSC gating between blocks
- Pause / resume support
- Block progression writes to `RecodeProgress` (legacy code name — to be renamed in `claude/branding-cleanup` before this builds)

Estimated scope per tier: 4–6 sessions each.

---

## Block D — Operations infrastructure

These run partly in parallel with Block A and B. Some are public-launch blockers.

### i18n + ThemeProvider lift (paired branch)
**Goal**: global language and theme contexts; user preferences persist; new pages multilingual by default.

Scope:
- Translation files at `locales/en.json` and `locales/ru.json` (Julia native-quality both)
- Global `LanguageProvider` + `ThemeProvider` wrapping `app/layout.tsx`
- `useLanguage()` + `useTheme()` hooks every component uses
- Refactor: Landing, Screening, AccountClient, sign-in, sign-up, terms, privacy, modal, footer
- Translate sign-in, sign-up, terms, privacy (currently EN-only)
- Persistence: write to `User.locale` / `User.themePref` for signed-in users, cookie for anonymous; read on mount

Branch name: `claude/i18n-and-theme-lift`

Language scope:
- v1: EN + RU
- v2 (post-launch): UK (Ukrainian)
- Future: PL, DE, ES, FR only when native-speaker trauma-informed review available

Estimated scope: 2 focused sessions.

**Public launch blocker** — cannot sell to Russian-speaking audience with broken toggle.

---

### AI-handled support email — Pattern A
**Goal**: AI reads inbox, drafts replies, queues for one-click approve/edit/send. Reduces email load to ~15 min/day at launch scale.

Scope:
- Resend inbound webhook for `support@mindreset.ai`
- AI categoriser: assigns email to one of N categories (transactional / emotional / billing / methodology / crisis / other)
- AI draft generator: produces draft reply in the user's locale and the appropriate voice (warm for emotional, functional for transactional)
- Admin queue UI (lives in admin panel — see Block E)
- One-click approve sends the draft as-is via Resend
- Edit-then-send flow for tweaks
- Escalation flag (red banner) for: crisis disclosures, methodology complaints, any expression of distress
- Never auto-sends; you remain the human eye on every email

Upgrade path: once 1,000+ approved drafts exist, specific categories (receipts, password resets) can promote to full auto-reply.

Estimated scope: 2–3 sessions (depends on admin panel readiness).

**Public launch critical.**

---

### Email push marketing — sequences
**Goal**: behaviour-driven email sequences that bring users back, suggest modules, celebrate milestones, and win back churned users.

Sequences:
1. **Welcome** — every new user, sent at signup
2. **Re-engagement** — user hasn't used MiniMind in N days
3. **Milestone** — completed first week, first module, first Journey block
4. **Module suggestion** — MiniMind pattern detection has flagged a repeating state
5. **Win-back** — cancelled subscription or churned

Scope:
- Resend integration for outbound transactional + marketing emails
- DB triggers fire based on events (signup, last activity, pattern count, subscription status)
- Templates per sequence per language (EN + RU at launch)
- Voice: mixed — emotional emails warm + transactional emails functional
- Unsubscribe handling (legal requirement)

**Deferred decision** (Day 3 mapping session):
- Who writes the copy — AI drafts vs templates vs all manual. Recommend: templates Julia writes for each sequence, AI handles personalisation only.

Estimated scope: 2 sessions.

Launch posture: Welcome sequence is launch-critical; other sequences can be added in the weeks after public launch.

---

### Feedback loop
**Goal**: collect periodic + open-ended feedback; AI summarises weekly/monthly digests delivered to admin email + panel.

Scope:
- "Leave feedback" button always available in app (small, in account header or footer)
- Periodic check-in prompts (cadence TBD — weekly vs monthly)
- Quick rating (1–5 or thumbs) + optional deeper text field
- DB table for feedback (new — to be designed)
- AI summariser: weekly or monthly Claude call summarising recent feedback into actionable digest
- Delivery: email digest to Julia + clickable admin page

**Deferred decision**: cadence (weekly vs monthly).

Estimated scope: 1–2 sessions.

Launch posture: launch with manual feedback review (just read raw entries); AI summariser shortly after.

---

### User-facing progress page
**Goal**: users see their journey — mood trends, sessions/modules completed, patterns noticed, breakthroughs.

Scope:
- `/account/progress` (or similar) page
- Mood trend chart (line chart of mood scores over time)
- Sessions completed counter
- Modules completed counter
- Patterns MiniMind has noticed (drawn from `DiagnosticProfile.recentStateOccurrences`)
- Qualitative breakthroughs (drawn from `DiagnosticProfile.engineNotes` or new field)
- **Strict trauma-informed posture**: NO streaks, NO gamification, NO celebration moments
- Display: visual charts primarily

Estimated scope: 2 sessions.

Launch posture: important for retention but not launch-blocker. Soft-launch can run for 2–4 weeks without it.

---

## Block E — Admin & business infrastructure

### Admin control panel
**Goal**: Julia (and future hires) can see the business at a glance.

Scope:
- New `/admin/*` route family, protected by role check
- Schema addition: `User.role` field (values: `admin`, `staff`, `user`)
- Metrics views:
  1. Revenue / MRR / churn (Stripe data)
  2. Active users — DAU / WAU / MAU
  3. Subscription breakdown (MiniMind / S&T / Journey)
  4. MiniMind usage — turns per user, cost per user, Anthropic spend
  5. Feedback summaries (AI-digested, from Block D)
  6. Safety events / red-flag log (from Phase 3c)
  7. User-level drill-down (search/find a specific user, see their state)
  8. Hardship applications review queue
  9. Conversion funnel (Landing → screening → signup → paid)
- Admin support-email queue (the approve/edit interface from Block D)
- Team-ready architecture from day one — role-based access, multiple admin users

Estimated scope: 3–4 sessions for v1.

Launch posture: launch with read-only Supabase Table Editor for v1; build proper panel in the weeks after public launch.

---

### Hardship application form
**Goal**: public-facing application for sponsorship; admin review queue.

Scope:
- Public form on the site (linked from a discreet place, NOT the pricing page)
- Form fields: contact, situation summary, income context, preferred tier
- Submission writes to a new `HardshipApplication` table
- Admin review queue in the panel — approve / decline / request more info
- Approved applicants get a Stripe coupon / free seat allocation
- Email notifications on application submission and decision

Estimated scope: 1–2 sessions.

Launch posture: important per Julia's sponsorship principle. Can launch with manual email-based applications and build the form shortly after.

---

## Block F — Legal, business, and launch prep

These are not coding work; they are real-world steps Julia must complete.

### Must complete before public launch
- UK Limited company registration
- ICO data protection registration (~£40-60/year)
- Solicitor review of legal docs (~£400-800; 13-point checklist exists in `docs/MindReset_Legal_Documents_EN.md`)
- Domain DNS connection: mindreset.ai → Vercel (A `@` → 76.76.21.21, CNAME `www` → cname.vercel-dns.com)
- Anthropic credit top-up + enable auto-recharge
- Designer polish pass on Landing + screening + account + sign-up (~£800-1500)
- Tier-progression marketing copy locked (Julia thinking separately)
- Final pricing decisions: Journey access duration (lifetime vs 12-month), MiniMind cap thresholds
- Support email address active: `support@mindreset.ai` via Resend or Google Workspace
- Russian-language legal docs (native Russian-speaker legal review)

---

## What blocks public launch (the minimum viable)

The public launch can open as soon as **all of the following are complete**:

✅ Block A — Phase 3b + 3c + 3d (chat usable, safe, with memory)
✅ Block B — MiniMind sellable via Stripe
✅ i18n + ThemeProvider lift (Russian audience accessible)
✅ AI support email — Pattern A
✅ Welcome email sequence
✅ Block F — legal, business, and launch prep

S&T and Journey players (Block C) can be "Coming soon" cards on /account at launch.

Other Block D items (feedback loop, user progress page, fuller email sequences) and Block E items (admin panel, hardship form) can launch with manual workarounds and be properly built in the weeks after public launch.

---

## What's deferred (decisions to make later)

These decisions are intentionally deferred — captured here so they don't get lost, but not blocking current work.

- Free-trial economics: cheaper model (Haiku) for free taster vs Sonnet for paid
- MiniMind cap thresholds (£9.99 fair-use turn count, £4.99 top-up turn count)
- Journey access duration: lifetime vs 12-month
- Feedback check-in cadence: weekly vs monthly
- Email copy authorship: AI vs templates vs manual
- Tier-progression marketing approach (Julia thinking separately)
- Hardship application form design + admin review flow
- Branding cleanup: rename `Recode` legacy code references to `The Journey` in DB schema and code

---

## Next session

Phase 3b — visible MiniMind chat page. The architect (Claude.ai) drafts Claude Code instructions; Julia operates Claude Code; we test on Preview; merge to main.

---

*— End of MindReset Roadmap v1*
