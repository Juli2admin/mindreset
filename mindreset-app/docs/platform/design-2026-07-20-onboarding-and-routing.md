# Platform Design — Onboarding, Routing & Personal Dashboard

**Date:** 2026-07-20
**Status:** Approved by owner (decisions locked; see §8). Design only — no
implementation has begun. Companion to
`docs/platform/audit-2026-07-19-product-routing-and-onboarding.md`, which
holds the current-state evidence this design responds to.

---

## 1. Governing conclusion

The original three-layer architecture (MiniMind companion → focused
States/Themes → deep Journey) does not need to be changed — it needs to be
**finished**, with one structural correction:

> **Separate the function from the product.** Assessment, hidden
> diagnostics, and routing intelligence become a *platform capability*
> that every product feeds and reads. MiniMind stays a product — the
> everyday companion — **not** the platform reception desk.

This preserves the roadmap's locked principles ("recognition before
recommendation", "the user discovers the next tier — never pushed", "no
popup upsells, ever") while honouring the owner's current principles: no
coercive routing, hidden diagnostics preferred, intelligent
recommendations over restrictions, different products for different
populations, The Journey not intended for every user, user-chosen depth.

## 2. Target flow

```
Screening (unchanged — crisis exclusion, the only hard gate)
   ↓
Sign-up
   ↓
Platform Onboarding  (3 questions, user's words, ALWAYS skippable)
   ↓ writes to
PLATFORM PROFILE (one object, all products; see §4)
   ↑ fed silently by every product   ↓ read by every product
   ↓
Product recommendations (rule-based over the profile)
   ↓
User chooses freely: MiniMind | States | Themes | The Journey
   (Journey adds one informed-choice page — information, not a gate)
   ↓
Personal Dashboard (progress · insights · recommendations · transitions)
```

## 3. Platform onboarding (independent step, owned by no product)

Roughly three questions, free-text-first, in the user's own words,
skippable, 2–3 minutes:

1. **What brings you here?** (the platform presenting request)
2. **What kind of help are you hoping for?** (understand myself / get
   through something specific / daily support / deep long-term change +
   free text)
3. **How deep do you want to go right now?** (light touch / focused work
   on one thing / all the way in)

No diagnosis, no scores shown, no wrong answers. This is The Journey's
task contract (P3, shipped 2026-07-19) generalised to the platform.
Product micro-onboarding is retained: Journey Block 1 stays the clinical
assessment; States/Themes keep module intros. The platform step gives
them a head start; it replaces nothing.

## 4. Platform profile

A promotion of `WellbeingSnapshot` (né `DiagnosticProfile`), not a new
invention. It already holds: channel preference, predominant state +
intensity, active themes, regulation capacity, risk markers, 3-in-7
repeat-state counter, engine notes. It gains:

- **Ask fields** (user-visible, user-editable): presenting request,
  expected help, desired depth — the platform task contract.
- **Recommendations log**: recommendation, source (platform rule vs
  product AI), reason, shown-at, user response (accepted / declined /
  ignored), cool-off state.
- **activeProducts** and, later, handoff summaries.
- **Consumers outside MiniMind** — the actual missing piece (audit DV4):
  Journey Block 1 head start, MiniMind context line, module-page
  greetings.

Hidden-diagnostic fields remain permanently invisible to the user (§6).

## 5. Routing & recommendations

- **Access stays open.** Nothing except `red` screening blocks any
  purchase. No mandatory tests, no additional screening questionnaires,
  no recommendation blockers, no forced routing through MiniMind
  (owner-locked, §8).
- **Two coexisting recommendation layers** (owner-approved):
  - **Platform recommendations** — rule-based over the profile
    (onboarding depth → default product; 3-in-7 state repetition → the
    matching State/Theme; persistent theme weights → the Theme;
    "all the way in" + stable screening → Journey informed-choice
    conversation; undecided → MiniMind as the *default suggestion for
    the undecided*, chosen not imposed).
  - **Product recommendations** — generated inside each product from
    ongoing interaction (MiniMind's existing 3-in-7 suggestion protocol
    gains its catalog; Journey gains step-down awareness). Both layers
    write to the same recommendations log.
- **Every recommendation carries a plain-language reason quoting the
  user's own words.** At most one active platform recommendation at a
  time; "not now" is remembered; declines trigger a cool-off; three
  declines retire the suggestion. "Never pushed" becomes enforceable.

## 6. Personal dashboard

**Governing rule: the user sees what they said and what they did; the
clinician's inferences stay in the consulting room.** Share only (a) the
user's own words, (b) engagement facts, (c) what the user explicitly
confirmed in-session (confirmed share-backs, their clean identity
statement, their anchor). Never surface unconfirmed inference.

Show:
- **Your ask, in your words** — the platform contract, editable; editing
  it is both an autonomy statement and a diagnostic signal.
- **Where you are** — per product, narrative not numeric ("in the early
  mapping conversations", module access windows and checkpoints,
  messages remaining). Continuity as gentle presence, never streaks —
  a missed week must never look like failure.
- **What you've found** — "in your words" collection: confirmed
  patterns, statements, things parked to return to. Framing is always
  "you said / you found", never "we noticed about you".
- **One recommendation at a time** with its reason and a visible,
  remembered "not now".

Hide, permanently: intensity scores, safety flags, risk markers,
attachment weights, regulation capacity, working hypotheses, continuity
notes, MII, stage gates. Scored dashboards teach users to perform for
the score; the method depends on them not performing.

Recommendations evolve by: recompute on profile updates, decay of stale
suggestions, decline-respect, cadence caps, and product-completion
triggers (State checkpoint → adjacent Theme; Theme depth recurring →
informed Journey conversation).

## 7. UX risks to design around

Questionnaire fatigue post-screening (three questions max, skip always
visible); cold-start dashboards (design the "nothing yet" state as
invitation); recommendation distrust (always quote the user's words as
the reason); informed-choice friction on the £599 purchase (measure it;
an informed buyer refunds and churns less than a misrouted one);
plain-language/ESL users (dashboard copy must survive translation and
use their words); insight-vs-surveillance perception ("you said / you
found" framing is the protection).

## 8. Owner decisions — LOCKED 2026-07-20

**Decision 1 — Step-down entitlement.** The Journey includes MiniMind
access by default. MiniMind remains a standalone product. The
relationship is one-way: MiniMind ≠ The Journey; The Journey → includes
MiniMind. Rationale: Journey users may want daily support, reflection,
or a lighter companion between deeper sessions; MiniMind serves as the
maintenance and integration layer before, during, and after The
Journey; improves cohesion without subscription friction.

**Decision 2 — Informed choice before purchasing The Journey (£599).**
An informed-choice step, NOT a restrictive gate. Explicitly excluded:
mandatory tests, additional screening questionnaires, recommendation
blockers, forced routing through MiniMind. The page "Is The Journey
right for you?" explains: what The Journey is; what it is not; who it
is designed for; what other options exist. Tone principles: "The
Journey is designed for people willing to engage in deeper
self-exploration and transformational work over time. It is not
designed as daily emotional support, coaching, or philosophical
conversation. If a lighter or more focused experience feels more
appropriate right now, MiniMind or focused modules may suit you
better." Then two buttons: **Continue to The Journey** / **Explore
other options**. The user always keeps the final choice.

**Architecture direction (approved).** Platform onboarding separate
from all products; hidden diagnostics via the platform profile;
platform and product recommendations coexist (platform = onboarding +
overall profile; product = ongoing interaction); MiniMind is a product,
not the reception desk. Everything implementable within the original
product principles without changing the existing architecture.

## 9. Build order (when implementation is approved — nothing started)

Each step independently shippable; ①–④ are invisible to users:

| # | Step | Notes |
|---|---|---|
| ① | Promote profile + add ask fields + recommendations log | schema + write path |
| ② | 3-question platform onboarding writing to it | one new surface |
| ③ | Read-bridges into all four products | kills double-blind channel inference (audit DV4) |
| ④ | MiniMind catalog injection + recommendation recording | audit P2/P6 |
| ⑤ | Dashboard v1: ask + where-you-are + one recommendation | copy needs owner review |
| ⑥ | Journey informed-choice page (per Decision 2) | copy needs owner review |
| ⑦ | Handoffs + step-down (per Decision 1 entitlement) | includes Journey→MiniMind access wiring |

Also standing from the audit, independent of this design: pilot process
fix P1 (no Journey grants at signup for new testers) — zero code,
process only.
