# Locked decisions — running log

Decisions that have been made and ratified. New entries go at the
bottom with a date. Once a decision is here, treat it as authoritative
unless the owner explicitly reopens it.

## Naming and process

- **2026-05-12** Branch naming: `claude/<topic>` for feature work.
  Squash-merge with descriptive PR title.
- **2026-05-12** Schema migrations are run **manually by Julia** in
  the Supabase SQL editor. Agent never runs `prisma migrate dev` or
  similar.
- **2026-05-13** GitHub MCP `owner` parameter is `Juli2admin` with a
  capital J. Lowercase returns 403.
- **2026-05-14** MiniMind prompt is **dual source of truth**:
  `lib/minimind/prompt.ts` + `docs/minimind/MiniMind_System_Prompt_v2.3.md`.
  Both must be updated in the same commit.
- **2026-05-14** Julia does not click merge buttons. The agent merges
  PRs via GitHub MCP.
- **2026-05-15** `mindreset-app/scripts/` is gitignored. Agent never
  `git add`s the scripts directory.

## i18n / RU style

- **2026-05-17** 8 locales total: en + ru native; fr/de/es/it/pl/pt are
  placeholders byte-identical to en.json.
- **2026-05-17** Native-locale set is locked in
  `components/LanguagePicker.tsx` (`NATIVE_CONTENT_LOCALES`).
- **2026-05-19** RU style:
  - Formal **Вы** by default
  - Informal **ты** only at trauma-soft moments (e.g.
    `Screening.yellowCta`)
  - **Feminine grammatical forms** are canonical
  - Use **ё** consistently
- **2026-05-19** Locale-specific quote marks: « » for RU/FR/ES/IT/PT;
  „ " for DE/PL.
- **2026-05-19** `Screening.tagline` RU is locked as
  "Травма-информированный спутник для самостоятельной работы..."
  (use as the canonical phrasing of the term).
- **2026-05-20** Phase 2b tooling pattern:
  `npm run i18n:sync` propagates en.json to placeholders;
  `npm run i18n:check` is the parity gate (wired into Vercel
  `prebuild`).
- **2026-05-20** All 8 message bundles' top-level keys are sorted
  alphabetically: Account, CrisisResources, DisclaimerModal, Footer,
  Landing, MiniMind, Screening, TopBar.

## Security

- **2026-05-20** RLS enabled + REVOKE ALL on all 10 public tables.
  Codified in `mindreset-app/db/rls.sql`. Future tables must add the
  same two lines to the canonical file. (PR #20.)
- **2026-05-20** Prisma's `postgres.*` role has `BYPASSRLS`, so the
  policy gain doesn't change app behaviour — it only blocks
  `anon`/`authenticated` from PostgREST access.

## Block B — Stripe billing

Locked 2026-05-21 in a single planning session.

1. **Tax / market**: UK-only at launch. Stripe Checkout restricts
   billing to GB. Stripe Tax stays OFF. Julia is not VAT-registered.
2. **Existing users**: No grandfathering. PR 1 migration resets all
   users to `currentTier = 'free'`, counters zeroed.
3. **PR 0 timing**: Standalone copy-only PR before any Stripe wiring.
   *(Shipped — commit `fd17934b`.)*
4. **Brand language scope**: Stripe payment surfaces only. In-app
   surfaces (screening, MiniMind prompt, Landing) keep "trauma-
   informed" and related language.
5. **Free taster start**: Counter starts at first MiniMind message
   sent (not at signup).
6. **Single-use enforcement**: Clerk primary email match,
   case-insensitive. (No Gmail-alias normalisation in v1.)
7. **At-cap UX**: Disabled chat input + inline banner showing reset
   date + top-up button. No modal. Chat history remains visible and
   scrollable.
8. **Stripe account status**: Exists, test + live keys obtainable.
9. **Free tier label on UI**: "Free taster".
10. **Tier differentiator**: Message allowance only — no feature flags
    between Essential and Extended for v1.
11. **T&Cs refund clause**: Included in PR 0. 7-day refund window from
    initial subscription purchase. LAST_UPDATED bumped to 20 May 2026.
12. **PR 0 scope**: Messages bundles + Landing + T&Cs + AccountClient
    restructure. Stale S&T/Journey prices hidden behind "Coming soon"
    badge.
13. **Stripe product names**: Plain functional names matching the app
    — `MiniMind Essential`, `MiniMind Essential Annual`,
    `MiniMind Extended`, `MiniMind Extended Annual`,
    `MiniMind Message Top-up`.
14. **EN tier copy**: Essential description = "A daily companion for
    self-guided reflection. 200 messages each billing cycle." (drops
    explicit "trauma-informed" framing on this surface).
    Extended description = "Higher monthly access for the times you
    need to lean in deeper. 800 to 1,200 messages each billing
    cycle."
15. **RU parity with EN**: When EN tier copy is revised, RU is updated
    to mirror.
16. **Cancellation behaviour**: Standard SaaS — access continues to
    end of current billing cycle on cancel. No partial-cycle refunds
    after 7-day window.
17. **Refund flow**: Manual via `support@mindreset.ai`. No self-serve
    refund UI at launch.
18. **Counter reset timing**: Driven by `invoice.payment_succeeded` webhook
    (Stripe anniversary). No separate cron. Auto-blocks user if renewal fails.
19. **Mid-cycle upgrade (Essential → Extended)**: Counter persists; cap raises
    from 200 to 1,200. User is buying headroom, not a fresh allowance.
20. **Mid-cycle downgrade (Extended → Essential)**: Effective at next cycle
    boundary via Stripe Customer Portal scheduled-change. No negative-cap edge
    case; user retains Extended access until period end.
21. **Webhook endpoint scope**: Production only —
    `https://mindreset.ai/api/webhooks/stripe`. Local dev via
    `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
22. **Receipt VAT line**: Hidden entirely. `automatic_tax: { enabled: false }`,
    no tax_id collection. Julia is not VAT-registered; subtotal = total.

## Pricing structure (locked together with Block B)

| Product | Price | Limit |
|---|---|---|
| Free taster | £0 (no card) | 20 messages lifetime |
| MiniMind Essential | £14.99/month or £129/year | 200 msgs/cycle |
| MiniMind Extended | £24.99/month or £209/year | 800–1,200 msgs/cycle |
| Message top-up | £4.99 | +200 msgs/cycle, expires at reset |

Annual savings copy: "Annual billing saves around 28%" (Essential)
and "around 30%" (Extended).

## Out-of-scope / explicit non-goals (locked)

- "Unlimited" tier — never. Use "Extended" / "Expanded" / "High
  Access".
- Multi-currency at launch — GBP only.
- Russian-market pricing — deferred to month 6.
- Annual → monthly downgrade flow — use Customer Portal cancel +
  re-subscribe.
- Pause subscription feature.
- Referral programme with per-user codes — deferred (when implemented,
  reward will be account credit, not cash, to avoid HMRC/ASA
  complexity).
- Self-serve refund UI — manual via email.
