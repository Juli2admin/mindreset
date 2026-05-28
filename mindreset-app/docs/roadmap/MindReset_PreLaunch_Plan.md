# MindReset.ai — Pre-Launch Plan

**Status**: living document. Locked at the soft-launch scope on 2026-05-28.
**Owner**: Julia. Implementation: Claude (per CLAUDE.md conventions).
**Companion docs**: `MindReset_Roadmap_v1.md` (older, partially outdated), `docs/decisions/locked-decisions.md`, `/home/user/mindreset/CLAUDE.md`.

## 0 · What ships at launch

The launch product is intentionally focused. Everything below is in scope.

- **Landing page** (typographic hero + tree icon brand mark)
- **Readiness Check** (Screening) with Green / Yellow / Red routing
- **MiniMind chat surface** (the AI conversation product)
- **MiniMind subscriptions**: Essential £14.99/mo · Extended £24.99/mo, free 50-message taster
- **Message top-up** (£4.99 / +200 messages)
- **Voice input** on MiniMind (Groq Whisper, zero-retention)
- **Pricing page** (with placeholders for the deferred tiers visible as "coming soon")
- **Sign-up / sign-in** (Clerk v5)
- **Personal-space dashboard** (`/home`)
- **Legal pages**: Terms (with Refund Policy), Privacy Policy, FAQ, Disclaimer modal
- **8 locales** EN + RU (hand-curated) + FR/DE/ES/IT/PL/PT (placeholder-filled where translation is incomplete)
- **Brand identity**: tree logo as favicon + iOS icon + TopBar glyph
- **Dark mode** (global, cookie-persisted, OS-preference auto-detect on first visit)
- **Mobile responsiveness** (viewport meta, scrollable tables, tap targets, font sizes that don't trigger iOS zoom)
- **Safety scanner** (severity-1–5 classification, Sev-5 alert email — TBD)
- **GDPR account-deletion + data-export flow** (to be built)
- **SEO foundation** (meta, OG, sitemap, hreflang, structured data — to be built)
- **Testimonials submission + display** (to be built — content seeded post-launch)

## 1 · What does NOT ship at launch (deliberately deferred)

These are out of scope. Don't let scope creep pull them in.

- **States & Themes module content** — Julia is planning the curriculum. Placeholder "coming soon" tile on /pricing.
- **The Journey — 8 blocks content** — Julia is planning. Same treatment on /pricing.
- **Blog / long-form content marketing** — post-launch growth lever.
- **Comparison pages** ("vs therapy", "vs other apps") — post-launch.
- **Mobile app shell / PWA** — post-launch.
- **A/B testing infrastructure** — too early.
- **Referral / affiliate program** — post-launch.
- **Live chat** — admin email workflow covers the same need at lower cost.

## 2 · Block F externals (Julia, NOT coding)

These unblock the technical work. Julia handles them in parallel with the engineering tracks.

- [ ] **DNS for `mindreset.ai` connected to Vercel** — without this the site lives on `mindreset-kappa.vercel.app`. Stripe webhooks + Clerk redirects depend on the canonical domain.
- [ ] **Production Clerk keys** wired into Vercel env. Preview URLs aren't whitelisted (causes silent auth fail on previews — Julia tests on the production URL).
- [ ] **ICO registration** at `ico.org.uk` — annual fee ~£40–60. Required by Privacy Policy before public launch. Per locked decision.
- [ ] **Solicitor review** of Terms + Privacy + Refund Policy. Some clauses are AI-drafted from public templates; need a human signoff.
- [ ] **Mailbox at `support@mindreset.ai`** — Julia needs an inbox somewhere (Google Workspace / Fastmail / etc.).
- [ ] **DNS MX records pointing to inbound parser** (Resend or alternative) — prerequisite for the admin email workflow.
- [ ] **Resend account** with Audiences enabled (for marketing emails). Domain verification with SPF/DKIM/DMARC.
- [ ] **Stripe live mode** keys, products, prices configured (current dev work has been in test mode).

## 3 · Pre-launch engineering checklist (in order)

Each step ships as its own PR. Julia tests on Vercel preview, approves, we merge, move to next step.

### 3.1 SEO foundation

**Why first**: low-effort, high-impact, unblocks search visibility from day one. Doesn't depend on any externals.

- [ ] Meta `title` + `description` per page (currently only Terms / Privacy have them).
- [ ] Open Graph + Twitter Card meta (image, title, description) — Landing first, then per page.
- [ ] OG image asset (1200×630 PNG) using tree logo + tagline.
- [ ] `robots.txt` + `sitemap.xml` at the route root.
- [ ] `hreflang` tags for the 8 locales (critical — without these Google may serve EN to RU users).
- [ ] Canonical URLs.
- [ ] Structured data: `Organization`, `WebSite`, `FAQPage` (on /faq), `Product` (on /pricing).

**Effort**: ~1 day.

### 3.2 GDPR account deletion + data export

**Why**: legal requirement under UK GDPR Article 17 (erasure) + Article 20 (portability). Privacy Policy promises both — currently neither is wired.

- [ ] **Data export endpoint** `/api/account/export` → JSON bundle of user's data (account, screening result, conversations, wellbeing profile, safety events, payment metadata).
- [ ] **Account deletion endpoint** `/api/account/delete` → cascades deletes per retention policy (immediate for conversation/profile, depersonalised for safety events, hard-keep 6 years for payment records per UK tax law).
- [ ] **Account settings UI** under `/home` for both actions (with confirmation modals).
- [ ] **Confirmation emails** on each action (uses existing Resend infrastructure).

**Effort**: ~1 day.

### 3.3 Testimonials submission flow

**Why**: trust signal — without testimonials a wellness app cannot sell. **Critical caveat**: zero testimonials at launch is expected; the build is the submission + display infrastructure so testimonials can accumulate from day-one users.

- [ ] **`/share-your-story` submission form**: name (or anonymous), age range, story text (with character limit), consent checkbox for public use.
- [ ] **DB schema** `Testimonial` table: status (pending / approved / rejected), redaction notes, public-name field.
- [ ] **Admin moderation UI** (re-used surface from the upcoming support workflow) — approve / reject / edit before publish.
- [ ] **Public display block** on Landing + Pricing — rendered only when ≥3 approved testimonials exist (avoids showing zero/one).

**Effort**: ~1 day for the infrastructure. Testimonials themselves accumulate over time.

### 3.4 Translation completion

**Why critical**: 6 locales currently render ~45% English-placeholder text on every non-Terms/Privacy page. Non-EN visitors see a broken-feeling app.

**Current state** (per audit on 2026-05-28):

| Locale | Translated | Status |
|---|---|---|
| RU | ~95% | 34 small stragglers (recent additions) |
| FR / DE / ES / IT / PL / PT | ~45% | Only Terms + Privacy fully translated; all other surfaces still EN placeholders |

**Translation rounds** (same workflow as Stages 2b/2c/2d — Julia translates, Claude plugs in):

| # | Namespace | Keys | Why this order |
|---|---|---:|---|
| 1 | RU stragglers | 34 | Cleanup; quick |
| 2 | `Landing` | 59 | First page non-EN visitors hit |
| 3 | `Screening` | 104 | Gate to using the app; trauma-informed copy matters |
| 4 | `MiniMind` + `DisclaimerModal` | 30 | Core product surface |
| 5 | `Footer` + `TopBar` + `SignUp` + `CrisisResources` | 17 | Small chrome strings, fast wins |
| 6 | `Home` + `Pricing` + `Faq` | 93 | Auth-gated or lower-traffic but for completeness |

**Total**: 303 keys × 6 locales = **1,818 translation values to produce**, plus 34 RU stragglers.

**Cadence**: ~10–15 chat rounds. Independent of all other engineering tracks; can interleave.

### 3.5 Real Stripe end-to-end test (Julia, not coding)

- [ ] Subscribe to Essential with a test card → verify Stripe webhook fires → verify tier reflected in `/home`.
- [ ] Same for Extended, top-up, cancellation, refund within 7-day window.
- [ ] Switch from monthly to annual → prorated invoice.
- [ ] Failed payment retry flow.

## 4 · Soft-launch checklist (weeks 3–6 post-pre-launch)

These ship after the pre-launch sweep is merged and the site is live. Same step-by-step + test cadence.

### 4.1 Admin page + inbound email AI workflow

Workflow (locked 2026-05-28): inbound email → AI reads first → routes important to Julia's queue, auto-replies routine FAQ from a tight whitelist.

- [ ] **`SupportEmail` + `SupportEmailReply` DB tables**.
- [ ] **Inbound webhook** `/api/webhooks/email-inbound` — Resend inbound parser POSTs here.
- [ ] **AI classifier** (Claude SDK + grounded in FAQ namespace + Refund Policy): classify (refund / cancel / FAQ / complaint / crisis / other), detect language, draft reply in same language.
- [ ] **Hard escalation list** — crisis / suicide / harm / lawyer / press / complaint / ICO keywords never auto-reply.
- [ ] **Routine whitelist** — only specific intents (cancel / receipt / FAQ-lookup / pricing question / voice-help / how-to) eligible for auto-send.
- [ ] **Confidence threshold** — below threshold goes to queue regardless of intent.
- [ ] **`/admin` route** — Clerk-ID allowlist (env var). Queue list + detail view + edit + send button + audit log of auto-sent.
- [ ] **Outbound reply API** `/api/admin/support/reply` — sends via Resend from `support@mindreset.ai`, marks email handled.
- [ ] **Sev-5 safety alert email** — when MiniMind safety scanner logs a Sev-5 event, send Julia an immediate alert (the TODO comment that's been sitting in `lib/minimind/safety/log.ts` since Phase 3c).

**Phases of rollout**:

1. Foundation — every email queued, AI drafts but no auto-send. Julia clicks Send manually. Validates classification quality.
2. Auto-send for whitelist — narrow whitelist of routine intents start auto-sending. Audit log visible in /admin.
3. Tighten + expand — adjust threshold + whitelist based on observed quality.

**Effort**: 2–3 sessions.

### 4.2 Marketing email infrastructure

Same admin surface, different namespace.

- [ ] **Resend Audiences** subscriber list management — segment by locale, tier, last-active, signup date.
- [ ] **Newsletter signup form** on Landing (catches not-yet-ready visitors).
- [ ] **GDPR-compliant unsubscribe** — one-click link on every send, audit log, explicit consent at signup.
- [ ] **Onboarding drip** — Day 1 / Day 3 / Day 7 emails after signup.
- [ ] **Cycle-reset reminder** — monthly, "your 200 messages just refreshed".
- [ ] **Inactive user re-engagement** — 30 / 60 / 90 days.
- [ ] **Refund / cancellation confirmation** emails (templated, sent on Stripe webhook event).
- [ ] **Account deletion confirmation** email.
- [ ] **Admin "send campaign" page** — compose, AI drafts (optional), preview, segment, send, audit log.

**Effort**: 2 sessions.

### 4.3 Operational telemetry

- [ ] **Vercel Analytics** enabled (privacy-respecting, no PII, free with Vercel hosting).
- [ ] **Sentry** for error monitoring — production errors otherwise go unseen.
- [ ] **Basic admin dashboard tile**: signups today, active users this week, Sev-5 events, MRR snapshot.

**Effort**: ~half a day.

### 4.4 Trauma-informed user features

- [ ] **Pause subscription** — let users step back without cancel/re-subscribe friction. Trauma-informed UX choice.
- [ ] **Coupon / promo code system** — compassionate pricing for users in hardship.

**Effort**: 1 day.

## 5 · Post-soft-launch (ongoing iteration)

- Blog / long-form content surface
- Comparison page ("vs therapy", "vs apps")
- About founder / Julia's story page
- Marketing campaign sends (using infrastructure built in 4.2)
- Continued testimonial collection + display
- States & Themes content rollout (when ready)
- The Journey 8-block content rollout (when ready)
- PWA / mobile app shell (if needed)
- Referral / affiliate program (if growth warrants)

## 6 · Trauma-informed brand constraints (do NOT build)

For the record — these growth tactics are off-table because they contradict the brand voice:

- ❌ Streak counters / "don't break your streak" warnings
- ❌ Gamification badges / leaderboards
- ❌ "X people are using MindReset right now!" social-proof widgets
- ❌ FOMO discount countdowns
- ❌ Aggressive exit-intent popups
- ❌ Manipulative urgency copy

## 7 · Test gates between steps

After **every** step in this plan:

1. Type-check clean (`npx tsc --noEmit`)
2. Build clean (`npm run build` — surface any compile/SSG errors)
3. i18n parity passes (`npm run i18n:check`)
4. Julia tests on Vercel preview
5. Julia explicit approval
6. Squash-merge to main via GitHub MCP
7. Delete branch
8. Move to next step

This cadence is locked. We do not stack PRs.

## 8 · Reference docs

- `/home/user/mindreset/CLAUDE.md` — project conventions, brand voice, locked decisions
- `mindreset-app/docs/decisions/locked-decisions.md` — pricing, scope, legal
- `mindreset-app/docs/decisions/open-questions.md` — still-open decisions
- `mindreset-app/docs/roadmap/MindReset_Roadmap_v1.md` — older roadmap (partially outdated)
- `mindreset-app/docs/architecture/` — system architecture notes
- `mindreset-app/docs/product/philosophy.md` — brand voice constraints
- `mindreset-app/docs/implementation/block-b-stripe-plan.md` — pricing spec
- `mindreset-app/docs/minimind/MiniMind_System_Prompt_v2.3.md` — current MiniMind prompt
