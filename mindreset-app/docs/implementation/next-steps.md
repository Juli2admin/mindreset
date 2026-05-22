# Next steps

Tactical sequence as of **22 May 2026**. Last updated after Block B
PRs 0–4 merged and PR 5 opened.

> **Read `docs/SESSION_HANDOFF.md` FIRST** if you are starting a fresh
> session. The handoff doc supersedes anything else here for the next
> session.

---

## Immediate priority — fix Vercel production deploys

PR #26 was merged to `main` (commit `35d8338`) but Vercel did NOT
fire a production deployment. Owner sees no Vercel activity in 20+
hours. Until this is resolved we cannot:

- Verify PR #26's at-cap banner / Customer Portal button live
- Merge PR #27 (message counter) — no way to test it
- Continue Block B in any form

### Debug sequence (with the owner — do not write code)

1. Owner opens Vercel → mindreset project → **Deployments** tab.
   Clear all filters. Paste top 3 rows.
2. Vercel → Settings → **Git**: confirm GitHub repo connected
   (green checkmark) and "Production Branch" = `main`.
3. Check "Ignored Build Step" — is it returning shell-exit 0?
4. Investigate side-effects of the recent Deployment Protection
   disable (could have disconnected something).
5. If GitHub integration is broken: re-link via Vercel dashboard.
   If Production Branch is wrong: fix it. If build is failing:
   read the error and fix.

**Do NOT merge PR #27 until Vercel deploys are green again.**

---

## Block B — open work

### PR #27 — Message counter integration

- **Branch**: `claude/block-b-pr5-message-counter`
- **URL**: https://github.com/Juli2admin/mindreset/pull/27
- **Status**: Open, owner-approved, awaiting merge
- **Blocker**: Vercel deploys broken (see above)

### PR 6 — Top-up purchase flow

Likely a no-op — PR 3's webhook already credits
`topUpMessagesRemaining += 200` on `checkout.session.completed` with
`Purchase` idempotency. **Re-scope before starting**:

- Read `app/api/stripe/webhook/route.ts` and `app/api/stripe/checkout/create/route.ts`
- Confirm top-up flow is end-to-end working: owner can buy top-up,
  webhook credits it, the credit is consumed before cycle pool, and
  it expires at billing-period reset
- If anything is missing, scope PR 6 against the gap. If nothing
  is missing, close out Block B as fully shipped.

---

## After Block B closes

In priority order:

### 1. Vercel + DNS productionisation

- Connect `mindreset.ai` to Vercel (Julia + Vercel docs)
- Verify SSL cert auto-provisioned
- Update Stripe webhook URL from current bypass-token form to clean
  `https://mindreset.ai/api/stripe/webhook`
- Update Clerk allowed origins to include `mindreset.ai`

### 2. Clerk production keys

Currently using dev keys. Production instance needs setup. Tracked
in `docs/carry-forward.md`.

### 3. Welcome email (Resend, launch-critical)

Email 1 only at launch. Add Email 2/3 later if retention data
suggests. See open question #11.

### 4. AI support email Pattern A (launch-critical)

Spec not yet defined. Owner to provide. See open question #12.

### 5. `User.screeningResult` populate fix

Cookie linkage doesn't write the field. Implementation sketch in
`docs/carry-forward.md`. Open question #10.

### 6. RU safety-scanner phrases

Phase 3c keyword scanner is EN-only. Add RU crisis phrases before
public launch. Owner-authored as a sensitive list. Open question #13.

### 7. Auth-page i18n

sign-in / sign-up / terms / privacy currently EN-only.

### 8. `/account` LanguagePicker

Currently Footer-only. Add to /account top bar.

### 9. Pre-launch native translation pass

Run `translate-missing.mjs` for fr/de/es/it/pl/pt. Confirm with
native speakers if budget allows.

### 10. T&C duplication investigation

Pre-existing bug. T&C capture happens twice in signup flow.

### 11. Tier-downgrade edge case (flagged in PR #27 audit)

When a subscriber cancels and `currentTier` becomes 'free', the user
inherits their cumulative `lifetimeMessagesUsed`. If they have 50+,
they land at-cap immediately on free fallback. Product call needed:
leave them on free with cumulative count, or grant fresh 50?

### 12. Extended soft-cap notice

`isAtSoftCap()` helper exists but isn't surfaced in UI. Add a gentle
"approaching limit" notice for Extended users between 800–1,200 msgs.

---

## Block C (post-launch)

States & Themes and The Journey content delivery — see Block B PR 0
pricing for cost structure; reuses Block B billing infrastructure:

- S&T block-by-block delivery + AI gating
- Journey 8-block progression + time gates per block
- 9 module prompts + 8 Journey prompts to design (significant
  clinical-voice work)
- module-player and Journey-player UI not built

---

## Block F — Julia's external steps

- UK Limited company registration
- ICO data-controller registration
- Solicitor review of T&Cs and Privacy
- Domain DNS final setup (in progress — see priority 1 above)
- Designer pass on Landing / Account
- Stripe Tax UK confirm OFF status — done

---

## Suggested fast-ship order from here

1. **Fix Vercel pipeline** (urgent — blocks everything)
2. Merge + test PR #27
3. Re-scope PR 6 (likely already shipped via PR 3)
4. Connect `mindreset.ai` DNS
5. Clerk production keys
6. Welcome email + AI support email
7. `User.screeningResult` fix
8. RU safety-scanner phrases
9. Tier-downgrade edge case + Extended soft-cap notice
10. Pre-launch native translation pass
11. Auth-page i18n
12. Soft launch
