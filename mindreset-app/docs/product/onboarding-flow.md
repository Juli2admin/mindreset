# Onboarding flow

The user's path from landing to first MiniMind message.

## Step-by-step

```
[Landing] /
   ↓ "Begin" CTA
[Screening] /screening                  — Section 0 Readiness Check
   ↓                                    — classifier returns green | yellow | red
[Screening result page]                 — shown inline; user can proceed or back out
   ↓ (consent ticked)
[Sign-up] /sign-up                       — Clerk-rendered, with T&C + Privacy checkboxes
   ↓ Clerk webhook fires → upsert User row
[/account]                              — first authenticated landing
   ↓ user clicks "Open MiniMind"
[Disclaimer modal]                      — appears once, must be acknowledged
   ↓
[MiniMind chat] /minimind               — first conversation begins
```

## What gets persisted at each step

| Step | Persisted |
|---|---|
| Screening (pre-auth) | `ScreeningResponse` row keyed by `mr_screening` cookie, `userId = null` |
| Sign-up | Clerk creates user → webhook `user.created` → Prisma upserts `User` with `tcAcceptedAt` and `privacyAcceptedAt` set to webhook timestamp |
| First /account visit | If `mr_screening` cookie present, the cookie's `ScreeningResponse.userId` is backfilled to the new Clerk user id |
| Disclaimer modal | `User.disclaimerAcknowledgedAt` populated via `POST /api/disclaimer/acknowledge` |
| First MiniMind message | `User.lifetimeMessagesUsed` increments per turn; capped at 50 messages lifetime for free taster (locked decision #25) |

## How `User.screeningResult` is populated

Two paths cover both flows:

- **Signed-in users**: `POST /api/screening` writes the result directly
  onto the User row at screening time (`User.screeningResult` +
  `User.screeningResultAt`).
- **Anonymous-then-signed-up**: the `mr_screening` cookie carries the
  pre-auth `ScreeningResponse.id`. On first `/minimind` load, the server
  component reads the linked row and backfills
  `User.screeningResult` + `User.screeningResultAt` if they're still
  null.

Cross-device edge case: if a user screens on mobile, clears cookies,
then signs up on desktop, the cookie is lost and the screening result
stays null. MiniMind treats this as `screeningResult: none` — same as
a user who never screened. Acceptable for v1.

## Known gaps

### Auth pages are EN-only

Sign-in and sign-up routes are Clerk-rendered (with our custom URLs),
but the Clerk component itself is currently configured EN-only. Terms
and Privacy pages are also EN-only — they're raw JSX in `terms/page.tsx`
and `privacy/page.tsx`, not i18n'd.

This is on the launch list but not Block B's concern.

### No language toggle on /account

The LanguagePicker lives in the Footer, not in the TopBar on `/account`.
Once a user is on `/account`, switching language requires scrolling to
the Footer. Tracked in `docs/carry-forward.md` →
"Language toggle missing on /account".

## Section 0 classifier rules

Located at `app/api/screening/`. Classifies based on:

- Exclusion flags (auto-Red on any: active psychosis, recent suicide
  attempt, etc.)
- Functionality scores (0–5 on multiple axes)
- Emotional scores (0–5)
- Trauma level (0–3 single-select)
- Cognitive answers (yes/no)
- Consent items

The full rule set lives in `lib/screening/`. Classification version is
stored on the response row (`classifierVer`) so old responses can be
re-evaluated against new rules without re-asking the user.

## Disclaimer modal

The modal is shown once and the acknowledgement is timestamped on the
User row. After acknowledgement, the modal does not reappear unless
the timestamp is cleared (which we don't currently expose).

Exclusion list of routes where the modal must NOT appear: see
`docs/carry-forward.md` → "Disclaimer modal — exclusion list".

## Onboarding after Block B ships

The Free taster (20 lifetime messages) sits between sign-up and first
subscription. Concretely:

1. User signs up → `User.currentTier = 'free'`, `lifetimeMessagesUsed = 0`
2. First MiniMind message → counter starts incrementing
3. At message 20 → chat input becomes disabled with an inline banner
   offering the Essential subscription or Extended subscription
4. On subscribe → webhook updates User to tier, `miniMindActive = true`,
   `miniMindPeriodEnd` set

See `../implementation/block-b-stripe-plan.md` for the full schema and
flow.
