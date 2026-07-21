# The Journey — System Canon (2026-07-21)

**Status: development on The Journey is FROZEN.** This document set exists to
establish a single source of truth for what the Journey runtime *actually is
today*, before anything is changed. It is a description of the system as built,
not a proposal for how it should become.

## What this is

Five read-only canon documents, produced from a forensic pass over the live
runtime by six independent evidence agents, each verifying against the actual
code (not against comments or prior audits):

1. **[01-SYSTEM-MAP.md](01-SYSTEM-MAP.md)** — the complete runtime map of how
   one AI reply is produced today, every component in order.
2. **[02-AUTHORITY-MAP.md](02-AUTHORITY-MAP.md)** — which component has
   authority over which behaviour, and what can override what.
3. **[03-LIVE-VS-DEAD.md](03-LIVE-VS-DEAD.md)** — all live, deprecated,
   conflicting, unreachable and duplicated logic in the runtime.
4. **[04-OWNER-DECISIONS-MAP.md](04-OWNER-DECISIONS-MAP.md)** — each major
   owner decision: fully implemented, partially implemented, superseded,
   conflicting, or never shipped.
5. **[05-CLEANUP-ROADMAP.md](05-CLEANUP-ROADMAP.md)** — a proposed cleanup
   *sequence* only. No implementation, no fixes.

Canon Resolution (the next phase — converting findings into an owner-approvable
decision register; still read-only):

6. **[06-CANON-RESOLUTION-REGISTER.md](06-CANON-RESOLUTION-REGISTER.md)** — one
   row per confirmed conflict/duplication/dead field/competing authority (12
   fields each). Updated with the eight canonical owner decisions (2026-07-21),
   the safety protocol, and a resolution map marking every row.
7. **[07-PR-A-AND-B-PLANS.md](07-PR-A-AND-B-PLANS.md)** — first-round exact PR A
   and PR B plans (superseded in part: PR A → PR A0, PR B → B1/B2/B3/B4 below).
8. **[08-PR-B1-B2-B3-PLANS.md](08-PR-B1-B2-B3-PLANS.md)** — revised split of PR B
   into B1 (anchor), B2 (banned stock wrappers), B3 (hypothesis discipline), with
   B4 (echo rhythm) deferred. Planning only.

Implementation status: **PR A0** (behaviour-preserving cleanup) is implemented on
branch `claude/journey-clean-runtime` and opened as PR #340 (review only, not
merged). Everything else remains planning; the runtime is otherwise frozen.

## Evidence standard (held on every claim in this set)

- Every factual claim is cited to `file:line` against the **live runtime** as
  it stands on `main` (verified: the audit branch has zero runtime-file drift
  from `origin/main`).
- A comment in code, a schema doc-string, or a statement in a prior audit is
  **not** treated as proof. Where a comment and the code disagree, the code is
  authoritative and the disagreement is itself recorded.
- Where evidence is incomplete, the claim is marked **NOT PROVEN** rather than
  asserted.
- **Where two generations of an instruction or logic coexist, both are
  documented and neither is declared correct.** Adjudication is the owner's,
  and is explicitly out of scope for this canon.

## Paths and provenance

- Runtime code: `mindreset-app/app/api/journey/turn/route.ts`,
  `mindreset-app/lib/journey/**`.
- Prompt sources (read at runtime, not under `lib/`):
  `mindreset-app/docs/journey/00-shared-core.md`,
  `…/PRACTICE_GENERATION_ALGORITHM.md`, `…/01-…08-…md` (stage specs), and
  `…/runtime/journey-master.md` (the operational master prompt).
- Prior work this canon consolidates and re-verifies (treated as *claims*, not
  truth): `mindreset-app/docs/journey/audit-2026-07-21-runtime-integrity/01-12`,
  `…/audit-2026-07-21-runtime-mechanism-audit.md`, and the 2026-06/07 audits.

## The Journey in one paragraph (as built today)

One user turn produces **one** streamed completion from `claude-sonnet-4-6`
(all 8 stages, no per-stage model, temperature unset, `max_tokens: 2500`),
preceded by 13 synchronous guard checks and a ~85–86 K-token system prompt in
which **all 8 stage specs are sent every turn** and the current stage is only a
bookkeeping label. The model streams a warm reply first, then a hidden
`<state-report>` JSON. Code — not the model — then decides stage movement
through **two un-reconciled advance lanes** and freezes on safety through
**four lanes** (only one of which acts before the user sees the reply). Many
signals the model emits are consumed by gates; many others are only echoed back
into the next prompt or written to the audit log and never read again. Several
generations of instructions (anchor, assessment-before-reply, flexible-map vs
sequential-engine, anti-echo vs 812 contrary exemplars) coexist in the live
system simultaneously.

## How to read this set

Start here, then read 01 → 02 → 03 for the architecture, 04 for the decision
history behind it, and 05 last for the proposed order of eventual cleanup.
Nothing in this set changes the runtime.
