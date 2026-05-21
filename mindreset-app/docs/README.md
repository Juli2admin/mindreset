# MindReset.ai — documentation index

This tree is the persistent project knowledge. Start here when picking up
work; refer to `CLAUDE.md` at the repo root for the rules every session
must follow.

## Structure

```
mindreset-app/docs/
├── README.md                       (this file)
├── architecture/
│   ├── overview.md                 — system map + how the pieces connect
│   ├── i18n.md                     — locale model + tooling + style rules
│   └── security-rls.md             — Postgres RLS canon (deferred to db/rls.sql)
├── product/
│   ├── philosophy.md               — brand voice, safety stance, language constraints
│   ├── onboarding-flow.md          — Landing → Screening → Sign-up → MiniMind
│   ├── tiers-and-pricing.md        — Free taster, Essential, Extended, top-up
│   └── ai-behavior.md              — MiniMind prompt + safety scanner + depth gates
├── implementation/
│   ├── progress.md                 — what's shipped, by phase
│   ├── block-b-stripe-plan.md      — the full Stripe-billing plan (active)
│   └── next-steps.md               — PR 1 through Block C
├── decisions/
│   ├── locked-decisions.md         — chronological log of decisions, dated
│   └── open-questions.md           — questions awaiting answers, tagged by blocker
├── minimind/
│   └── MiniMind_System_Prompt_v2.3.md   (existing — canonical prompt)
└── roadmap/
    └── MindReset_Roadmap_v1.md          (existing — dated 15 May 2026, out of date in places)
```

Other relevant docs that live outside this tree:

- `mindreset-app/architecture.md` — plain-language data-model tour
- `docs/carry-forward.md` (repo root) — running log of lessons + dropped features
- `docs/MindReset_Legal_Documents_EN.md` — legal master copy
- `docs/security-deferrals.md` — version-bump deferral log
- `mindreset-app/db/rls.sql` — canonical RLS SQL
- `mindreset-app/i18n-tools/translate-prompt.md` — translator system prompt

## How to use this

- **Picking up a task**: read `implementation/progress.md` for state, then
  the relevant block plan in `implementation/`.
- **Making a product decision**: check `decisions/locked-decisions.md` to
  see if it's already settled; if not, log the new question in
  `decisions/open-questions.md` until it's resolved.
- **Writing user-facing copy**: read `product/philosophy.md` first.
- **Writing RU**: read `mindreset-app/i18n-tools/translate-prompt.md` —
  rules are locked there.
- **Touching the schema**: read the migration policy in
  `/CLAUDE.md` (root). Never run Prisma migrations.
