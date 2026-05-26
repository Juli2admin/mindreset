# Next steps

Tactical sequence as of **22 May 2026**. Last updated after Block B
fully shipped and verified (PRs 0–4, #27, #29, #30 merged; top-up
flow tested end-to-end).

> **Read `docs/SESSION_HANDOFF.md` FIRST** if you are starting a fresh
> session. The handoff doc supersedes anything else here for the next
> session.

---

## Block B — ✅ COMPLETE (22 May 2026)

All six PRs shipped and verified:

| PR | Scope | Status |
|---|---|---|
| PR 0 | Schema + Stripe products | ✅ merged |
| PR 1 | Tier copy + checkout buttons | ✅ merged |
| PR 2 | Checkout session creator | ✅ merged |
| PR 3 | Stripe webhook + Purchase idempotency | ✅ merged |
| PR 4 | Customer Portal | ✅ merged |
| PR #27 | Message counter gate + at-cap banner | ✅ merged + tested |
| PR #29 | `waitUntil` fix — serverless lifecycle | ✅ merged + tested |
| PR #30 | At-cap banner shows mid-session (402 → banner) | ✅ merged + tested |
| PR 6 | Top-up purchase flow | ✅ no-op — PR 3 already ships it |

End-to-end verified: counter increments, at-cap gate fires, mid-session
402 shows proper banner, top-up credits and drains before cycle pool,
top-up resets on billing anniversary.

---

## Pre-launch — code (next sessions, in priority order)

### 1. Welcome email — `[blocker:launch]`

Resend is installed but no email is sent on sign-up. Email 1 only at
launch.

- Trigger: Clerk `user.created` webhook → Resend
- Content: welcome + screening result context (EN + RU)
- Julia to supply copy before session starts
- See open question #11

### 2. `User.screeningResult` populate fix — `[blocker:launch]`

Cookie-based screening row links to the new User on first `/account`
visit, but `User.screeningResult` (denormalised field) is not written.
Implementation sketch in `docs/carry-forward.md`. See open question #10.

### 3. Voice input (mic button) — ✅ SHIPPED (2026-05-26)

Shipped across three PRs:
- **PR A** (#56): backend `/api/minimind/transcribe` route via Groq Whisper
- **PR B** (#57): frontend mic button + recording UX in MiniMindClient
- **PR C**: Terms (Section 6) + Privacy (Section 4) audio paragraphs;
  locked decision #45 transcribed from open question #22

Operational: owner-managed `GROQ_API_KEY` in Vercel; Groq Data Controls
policy as configured per the owner's chosen plan. See locked decision
#45 in `docs/decisions/locked-decisions.md` for the full architecture
note. Mobile testing still pending — see launch checklist below.

### 4. T&C duplication fix — `[blocker:launch]`

Pre-existing bug: T&C capture fires twice in the signup flow.
See `docs/carry-forward.md`. Open question #16.

### 5. Auth-page i18n — `[blocker:launch]`

sign-in / sign-up / terms / privacy pages are currently EN-only.
All other pages have full next-intl coverage.

### 6. `/account` LanguagePicker — `[blocker:launch]`

Currently Footer-only. Add to `/account` top bar so users can switch
locale from the account page without scrolling to the footer.

### 7. Extended soft-cap notice — `[non-blocking]`

`isAtSoftCap()` helper exists in `lib/billing/limits.ts` but is not
surfaced in UI. Show a gentle "approaching limit" notice for Extended
users between 800–1,200 messages used. Small banner above chat input.
See open question #20.

### 8. Tier-downgrade edge case — `[non-blocking]`

When a subscriber cancels and `currentTier` reverts to `'free'`, the
user inherits their cumulative `lifetimeMessagesUsed`. If 50+, they
land at-cap immediately. **Decision: Option A** — leave on free with
cumulative count. Defensible, no abuse path. See open question #19.
Implement: no code change needed (existing logic is already Option A);
add copy hint at cancel surface.

### 9. Native translation pass — `[blocker:launch]`

Run `translate-missing.mjs` for fr/de/es/it/pl/pt after all EN copy
is finalised (especially voice T&C paragraph and any new email copy).
Confirm with native speakers if budget allows.

### 10. Mobile responsiveness audit — `[blocker:launch]`

Landing / Screening / Account / MiniMind — verify on mobile viewport
before soft launch. Particular attention to mic button layout and
at-cap banner on small screens.

---

## Pre-launch — content (Julia)

| # | Item | Status |
|---|---|---|
| A | AI support email Pattern A — spec needed | open Q #12 |
| B | RU safety-scanner crisis phrases — owner-authored sensitive list | open Q #13 |
| C | Welcome email copy (EN + RU) — Email 1 | needed before item 1 |
| D | T&C paragraph for voice/audio processing | ✅ shipped in PR C of voice rollout (2026-05-26) |

---

## Pre-launch — external (Block F — Julia's work)

| # | Item | Notes |
|---|---|---|
| F1 | `mindreset.ai` DNS → Vercel | open Q #18; blocks clean Stripe webhook URL |
| F2 | Clerk production keys | currently dev keys; needed before real users |
| F3 | Update Stripe webhook URL to clean form | after F1 |
| F4 | Update Clerk allowed origins to `mindreset.ai` | after F1 |
| F5 | Designer pass on Landing / Account | roadmap Block F |
| F6 | Solicitor review of T&Cs and Privacy | roadmap Block F |
| F7 | UK Limited company registration | roadmap Block F |
| F8 | ICO data-controller registration | roadmap Block F |

---

## Soft launch checklist

- [ ] End-to-end smoke test all 8 locales
- [ ] Mobile responsiveness verified
- [ ] Stripe production-mode test: one real subscribe + one real top-up + one cancel
- [ ] Voice input tested on mobile (iOS Safari + Android Chrome)
- [ ] Welcome email delivered and displays correctly
- [ ] Safety scanner tested with EN + RU crisis phrases
- [ ] Vercel preview Clerk whitelisting resolved (auth-protected pages testable on preview)
- [ ] First batch of friend-of-Julia invites with promo code

---

## Block C (post-launch)

States & Themes and The Journey content delivery — billing already
wired in Block B; content delivery is Block C:

- S&T block-by-block delivery + AI gating
- Journey 8-block progression + time gates per block
- 9 State/Theme module prompts (significant clinical-voice work — Julia)
- 8 Journey block prompts (significant clinical-voice work — Julia)
- module-player UI
- Journey-player UI (block-by-block, time gates)
- S&T subscriber-discount surface at checkout
- Journey installment payment-tracking UI

---

## Post-launch — quality and scale

- Admin control panel
- User-facing progress page (per roadmap)
- Feedback loop / NPS surface
- Welcome email cadence Email 2 + Email 3 (if retention data warrants)
- Promo code broader rollout (beyond friend-of-Julia)
- Roadmap v2 refresh (v1 is out of date — pricing, Block B shipped)
- Extended soft-cap notice (if not shipped pre-launch)
- Tier-downgrade edge case cancel-surface copy
- Block C voice input enhancements (streaming transcription if needed)

---

## Block F — Julia's external steps

- UK Limited company registration
- ICO data-controller registration
- Solicitor review of T&Cs and Privacy
- Domain DNS final setup → Vercel SSL → clean Stripe webhook URL
- Designer pass on Landing / Account
- Stripe Tax UK confirm OFF status — ✅ done

---

## Operational debts (track, not blocking launch)

- 11 npm vulnerabilities (2 moderate, 9 high) — pre-existing in
  dependency tree; see `docs/security-deferrals.md`
- Roadmap v1 (`docs/roadmap/MindReset_Roadmap_v1.md`) out of date
  — pricing and Block B marked "not yet built". Refresh to v2
  post-launch. See open question #14.
- Orphaned remote branch `claude/adoring-babbage-itdRw` — harmless,
  can be deleted from GitHub UI at any time

---

## Suggested session order from here

1. **Welcome email** (code + Julia supplies EN/RU copy)
2. **`User.screeningResult` fix** (small, fully codable)
3. **Voice input — Groq Whisper mic button** (1 session, pre-launch)
4. **T&C duplication fix** (pre-existing bug)
5. **Auth-page i18n + `/account` LanguagePicker** (0.5 session)
6. **Extended soft-cap notice** (small)
7. **Native translation pass** (after all EN copy locked)
8. **Mobile responsiveness audit** (manual + any fixes)
9. **Soft launch** (pending Block F external items completing in parallel)
