# SESSION HANDOFF — 2026-07-19

**Read this BEFORE CLAUDE.md.** Most recent operational state.
Supersedes the prior handoff (2026-06-28, which itself superseded
2026-06-04). Both archived in git.

---

## TL;DR — where we are

**M1 (Journey memory attention optimisation) is shipped, evaluated, and
working.** PR merged (#322, commit `ebfb01f`). Runtime caps (5 parts /
3 foreign / 5 sig images / 5 patterns) + reframed historical continuity.
Owner's own Journey session on 2026-07-19 confirmed method fires cleanly
under M1: foreign material released, clean identity statement landed,
deep landscape practice completed, intensity descent 5→5→3→3→2 with
appropriate safety-flag relaxation. Zero clinical prompt changes shipped.
**Close M1 evaluation. Do not touch it further.**

**Full pilot cohort audit is complete** and captured in
`mindreset-app/docs/pilot/tester-audit-2026-07-18.md`. 4 pilot testers +
quin55 (allowlisted early). Findings summary is in that doc.

**Owner's strategic read from the audit:**
- The Journey clinical method works for the right user profile — proven
  by owner's own arc and quin55's somatic practice sequence.
- The method cannot help wrong-profile users (abstract-existential,
  single-shot-answer-expecting, pessimistic-at-intake). Sergei is the
  type example.
- **The failure is upstream of the AI, not inside it.** Users self-route
  into the wrong surface with no expectation-setting or triage.
- 2 of 4 pilot testers went straight to MiniMind and never opened
  Journey. Svetlana is the most engaged user in the cohort (98
  messages) and she's on MiniMind.
- Owner's verdict: stop tuning the AI. Fix the funnel.

**Next work track (owner's direction):** funnel + product surfaces, not
AI methodology. Three candidates identified in the last exchange:
1. Journey onboarding + expectation-setting (biggest lever, self-contained
   UI+copy)
2. User-facing "your journey so far" progress surface (Sergei's explicit
   ask; all arc data is admin-only today)
3. Journey session-close rewrite — warm-companion register → clinician-
   close register. Small prompt change to the close-move section only.

Owner will pick which piece to start with. Await direction on first
message.

---

## Full context tree

### What shipped in this session
- **PR M1** — Journey memory attention optimisation. Merged.
- **Pilot cohort audit doc** — `mindreset-app/docs/pilot/tester-audit-
  2026-07-18.md` (committed 2026-07-19).
- **This handoff doc** — updated 2026-07-19.

### What did NOT ship (and shouldn't in the next session either)
- **No changes to Journey master prompt** — held under M1 constraint;
  owner explicitly rules out touching the clinician for now.
- **No safety-verifier tuning** — flagged as candidate but not touched.
- **No MiniMind changes** — audit thread opened then closed at owner's
  direction ("MiniMind and Journey are two different prompts. I ask
  MiniMind only.").
- **No MiniMind → Journey referral logic** — cross-wired suggestion was
  explicitly rejected by owner.

### Pilot cohort snapshot (as of 2026-07-19)

| Tester | Locale | Surface | Journey turns | MiniMind msgs | Status |
|---|---|---|---|---|---|
| vmelentev2003@gmail.com | (en?) | Journey | 104 | 0 | last active 16 Jul |
| sergecrim@hotmail.com | en | Journey | 39 | 5 | silent 13+ hrs after unsatisfactory Journey session; likely dropout |
| quin55@mail.ru | ru | Journey | 26 | 7 | silent 4 days; got 11 practices, 2 completed |
| svetlana.morozova@inbox.lv | ru | MiniMind | 0 | 98 | most engaged; still active |
| 9020240320@mail.ru | ru | MiniMind | 0 | 19 | last active 15 Jul |

### Sergei's explicit product asks (queue these)
1. **Personal progress metrics visible in-app.** All arc data (patterns,
   parts, foreign material, practices, stage progression) is admin-only.
2. **Better onboarding expectation-setting** before first Journey message.

### Owner's UX flag from her own session
- Journey session-close style reads as warm-companion ("иди отогревайся"),
  not clinician. For an experienced user this feels warm; for a Sergei
  it likely reads as unprofessional. Fixable independently.

---

## Constraints still in force

Per `CLAUDE.md`:
- **Never push to `main`.** Feature branch this session:
  `claude/gallant-pasteur-sRyXA`. Next session uses a fresh branch.
- **Never run `prisma migrate dev / deploy / db push`.** Owner runs
  migrations manually in Supabase.
- **MiniMind v2.3 prompt dual-source** — `lib/minimind/prompt.ts` +
  `docs/minimind/MiniMind_System_Prompt_v2.3.md` must stay byte-identical
  in the same commit.
- **Journey master prompt is frozen** — do not modify without explicit
  owner approval on wording. Was reverted once (PR #308 → #309) after
  an identity-sentence experiment caused rupture-handling regression.
- **8 locales, en+ru native, other 6 placeholders** — run
  `npm run i18n:sync` after adding new copy in en.json.
- **GitHub MCP owner param**: `Juli2admin` with capital J.
- **Stripe surfaces language**: forbidden words listed in CLAUDE.md.

---

## Environment / deployment (unchanged from prior handoff)

- `mindreset.ai` still not connected to Vercel.
- Production URL is whatever Vercel is serving.
- Preview URLs are NOT whitelisted in Clerk.
- Vercel Deployment Protection must stay OFF (Stripe webhook depends
  on that state).
- Stripe webhook URL uses `x-vercel-protection-bypass` token workaround.

---

## Testing / eval status

- **M1 tests**: 608 passing after M1 shipped. Nothing new added.
- **Owner's Journey test session on 2026-07-19**: successful, captured
  in the current session's chat log. Deep Layer symbolic release,
  clean close, intensity 2.
- **Sergei's Journey session on 2026-07-18**: analyzed extensively via
  SQL. Documented in the pilot audit doc.
- **No CI failures known.**

---

## SQL — Sergei check-back query

For quick re-check of whether Sergei returned:

```sql
SELECT
  (SELECT COUNT(*) FROM "JourneyTurn"
    WHERE "userId" = 'user_3GgUr4RqfyoqK73gZk6u61l53XD'
      AND "createdAt" > '2026-07-18 20:02:16.28'::timestamp)  AS new_j_turns_since_dropout,
  (SELECT MAX("createdAt") FROM "JourneyMessage"
    WHERE "userId" = 'user_3GgUr4RqfyoqK73gZk6u61l53XD')       AS j_last,
  ROUND(EXTRACT(EPOCH FROM (NOW() -
    (SELECT MAX("createdAt") FROM "JourneyMessage"
      WHERE "userId" = 'user_3GgUr4RqfyoqK73gZk6u61l53XD')))/3600, 1) AS hours_silent;
```

Sergei's userId: `user_3GgUr4RqfyoqK73gZk6u61l53XD`.
Julia's userId: `user_3EfVFP02L8njKj2T36EvDAB0Z07`.
quin55's userId: `user_3GM8L40KFQA0ElWIQpLG6YjHM7g`.
Svetlana's userId: look up via `SELECT id FROM "User" WHERE email='svetlana.morozova@inbox.lv'`.

---

## Where to find things (map for the next session)

- **Full pilot audit findings** — `mindreset-app/docs/pilot/tester-audit-2026-07-18.md`
- **Journey master prompt** (frozen) — `mindreset-app/lib/journey/prompts/`
  (do NOT touch without owner approval)
- **MiniMind prompt** — `mindreset-app/lib/minimind/prompt.ts` +
  `mindreset-app/docs/minimind/MiniMind_System_Prompt_v2.3.md`
- **Journey state loading** — `mindreset-app/lib/journey/state/load.ts`
  (M1 caps live here; do NOT change without owner approval)
- **Pilot analytics** — `mindreset-app/lib/pilot/analytics.ts`
- **Per-tester admin page** — `mindreset-app/app/admin/pilot/tester/[userId]/page.tsx`
- **Journey Inspector** — `mindreset-app/app/admin/journey-inspect/page.tsx`
- **Screening flow** (for onboarding work) — `mindreset-app/app/[locale]/screening/`
- **Journey landing** (for expectation-setting work) — look under
  `mindreset-app/app/[locale]/journey/` and `/home` tiles
- **Home tiles** (surface routing) — search for `LiveThemeTiles` /
  `StateTile` / Journey card component
- **Account page** (for progress surface) — `mindreset-app/app/[locale]/account/`
- **Locked decisions log** — `mindreset-app/docs/decisions/locked-decisions.md`

---

## Recommended first move for the next session

1. **Read this doc, then read `mindreset-app/docs/pilot/tester-audit-
   2026-07-18.md`** — owner's audit findings and stated product read.
2. **Wait for owner's first task assignment.** Owner is about to give
   the next session a specific piece of work (from the funnel-fix
   candidates listed above, or something else).
3. **Ask before making assumptions about scope.** Owner has repeatedly
   corrected scope creep this session — respect narrow assignments.

---

## Tone signals to carry forward

- Owner values honesty over reassurance. When findings are unfavourable,
  say so.
- Owner corrects scope creep quickly ("you cross-wired them") — listen.
- Owner prefers one SQL at a time when auditing data, step-by-step
  results back.
- Owner runs SQL manually in Supabase SQL editor.
- Owner prefers to review proposed prompt/code changes before shipping.
- Owner asks for handoff when a session gets long — this is one of
  those moments. Session ended honestly; next session picks up clean.
