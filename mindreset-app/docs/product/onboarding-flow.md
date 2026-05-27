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
[/home]                                  — first authenticated landing (PR #54)
   ↓ user clicks "Open MiniMind"
[Disclaimer modal]                      — appears once on /minimind, must be acknowledged (PR #55)
   ↓
[MiniMind chat] /minimind               — first conversation begins
```

## What gets persisted at each step

| Step | Persisted |
|---|---|
| Screening (pre-auth) | `ScreeningResponse` row keyed by `mr_screening` cookie, `userId = null` |
| Sign-up | Clerk creates user → webhook `user.created` → Prisma upserts `User` with `tcAcceptedAt` and `privacyAcceptedAt` set to webhook timestamp |
| First /home visit | If `mr_screening` cookie present, the cookie's `ScreeningResponse.userId` is backfilled to the new Clerk user id (with /minimind as a fallback retry path if the /home transaction failed) |
| Disclaimer modal | `User.disclaimerAcknowledgedAt` populated via `POST /api/disclaimer/acknowledge`; modal is mounted in `/minimind/page.tsx`, not the root layout (PR #55) |
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

### Language toggle availability

Since PR #54 the authenticated landing is `/home` (not `/account`, which
now redirects). The shared `TopBar` component already renders the
`LanguagePicker` next to the user menu on every page that uses TopBar,
including `/home`, `/pricing`, `/minimind`, and the legal pages. The
older "no language toggle on /account" gap noted in
`docs/carry-forward.md` was effectively resolved by TopBar integration;
the carry-forward entry is preserved as historical context only.

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

The Free taster (50 lifetime messages — locked decision #25) sits between
sign-up and first subscription. Concretely:

1. User signs up → `User.currentTier = 'free'`, `lifetimeMessagesUsed = 0`
2. First MiniMind message → `lifetimeMessagesUsed` and `messagesUsedThisCycle`
   both increment per turn
3. At message 50 → `hasCapacity()` returns false, the chat input is replaced
   by the `AtCapBanner` offering subscription options or a top-up purchase
4. On subscribe → `customer.subscription.created` webhook sets
   `User.currentTier` to `'essential'` or `'extended'`, populates
   `User.cycleResetAt`, and zeroes `messagesUsedThisCycle` for the first
   cycle (PR #53 first-cycle credit reset — see locked decision #19 for
   why mid-cycle Essential↔Extended preserves the counter)

See `../implementation/block-b-stripe-plan.md` for the full schema and
flow. The dead `miniMindActive` / `miniMindPeriodEnd` columns are
historical — current tier state lives in `currentTier`, `cycleResetAt`,
and the message-counter fields.
