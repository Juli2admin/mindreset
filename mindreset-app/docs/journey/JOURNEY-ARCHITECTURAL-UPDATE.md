# THE JOURNEY — Author's Architectural Update (Latest)

> **Document status:** Latest Author Guidance. Saved 2026-07-25.
>
> **Authority:** This is the current architectural reference for The Journey.
> Where this document differs from the current Clinical Manual
> (`docs/journey/CLINICAL_MANUAL.md`), **this document represents the author's
> latest architectural decisions until the Manual is updated.** Future prompt
> reviews should first check consistency with this document before proposing
> behavioural changes. If future decisions modify the methodology, this
> document should be versioned and updated so all agents work from the same
> clinical model.

## Purpose

This document defines the current architecture of The Journey.

- **The Journey** is the eight-stage therapeutic methodology.
- **MindReset** is the software platform that hosts multiple products.

This document applies only to The Journey and its runtime behaviour. It does
not describe the MindReset platform, MiniMind, or other products except where
they interact with The Journey.

## IMPORTANT FOR ALL AGENTS

During the recent prompt reviews we realised that implementation decisions were
gradually being evaluated **against wording** rather than against the intended
clinical architecture. This document updates that architecture.

Future prompt reviews, runtime changes, and code reviews should evaluate
behaviour against **The Journey**, not simply against older prompt wording or
isolated manual paragraphs.

The objective is not to reproduce text. **The objective is to reproduce the
intended clinical behaviour.**

## Clinical objective of The Journey

The Journey is not a collection of therapeutic techniques. **It is a clinical
reasoning system.**

The system should behave like an experienced senior clinical psychologist who
first understands the client before deciding how to intervene. At every step
the system should first determine:

- Who is in front of me?
- What is actually happening?
- What mechanism is maintaining the difficulty?
- Am I still observing, or is it time to intervene?
- Is the client ready to move deeper?
- What is the smallest safe intervention that moves the process forward?

Only after answering these questions should an intervention be selected.
**Clinical reasoning always comes before technique.**

## The four clinical phases

Although The Journey consists of eight internal blocks, clinically they
function as four larger phases.

### Phase 1 — Observation & Clinical Understanding (Block 1 + Block 2)

The primary purpose of the first two blocks is **understanding**. The AI should
avoid rushing into therapeutic techniques. Instead it should gradually build an
internal clinical model of the client. These stages identify:

- nervous system organisation;
- emotional patterns;
- dominant adaptive strategies;
- processing style;
- recurring mechanisms;
- presenting problem;
- underlying problem.

The therapist follows the nervous system instead of chasing the story.
Interventions remain minimal. Observation is the priority.

### Phase 2 — Safe Entry into Deep Work (Block 3)

Adult Self is the gateway into all deeper work. Adult Self is not simply another
regulation exercise. Adult Self establishes an observing adult position capable
of working safely with vulnerable internal material.

Without Adult Self the system should not proceed into: parts work, childhood
material, emotional scenes, corrective experiences, or identity reconstruction.

Clinical sequence:

```
Stabilisation
   ↓
Adult Self
   ↓
Deep therapeutic work
```

This principle remains fundamental.

### Phase 3 — Internal Reconstruction (Blocks 4–7)

Only after Adult Self is sufficiently established does reconstruction begin.
These blocks include parts work, Child Self work, foreign material, identity
reconstruction, and integration.

The objective is not insight alone. **The objective is genuine internal
reorganisation.** Clients often begin with one presenting problem; during
reconstruction, deeper mechanisms naturally emerge. The system should adapt as
understanding develops. The process is expected to be **iterative rather than
linear**.

### Phase 4 — Living from the New Organisation (Block 8)

The final phase is not the end of therapy. It is the beginning of living
differently. The objective is to determine whether the reconstructed identity
remains stable in everyday life. The system helps the client:

- maintain the new organisation;
- recognise old patterns without returning to them;
- strengthen new behaviour through daily life.

## Updated definition of Personal Anchor

**This is the most important architectural update.**

Earlier documentation described Personal Anchor as a mandatory recurring
stabilisation tool used throughout all eight blocks. **This is no longer the
intended clinical model.**

Personal Anchor is **not**:

- a universal regulation technique;
- a compulsory intervention;
- something that should automatically appear whenever emotional intensity rises.

Ordinary regulation should normally rely on standard stabilisation methods
appropriate to the client.

Personal Anchor now serves a different purpose. **It is an identity
intervention.** It is used when the client has become disconnected from their
authentic sense of self. Its purpose is to help the client rediscover something
emotionally true that genuinely belongs to them.

Therefore:

- If ordinary stabilisation is sufficient, Personal Anchor is unnecessary.
- If the client has lost connection with themselves, Personal Anchor becomes
  clinically valuable.

It should only be introduced when clinically indicated. **It should never
become repetitive scripted behaviour.**

## Updated definition of Adult Self

Adult Self remains one of the core structural components of The Journey. Its
purpose is frequently misunderstood.

Adult Self is **not** primarily a calming exercise. It establishes the internal
adult who can safely observe, regulate, and work with psychological material.

Only after Adult Self is sufficiently established should the client move into:
vulnerable parts, childhood experiences, emotional processing, corrective
experiences, or identity reconstruction.

Adult Self is therefore a **structural safety requirement**. This principle has
not changed.

## Behaviour before intervention

The Journey should never become technique-driven. The runtime should always
**understand the client before attempting to change the client**. Every
intervention should emerge naturally from clinical understanding. The AI should
never perform an exercise simply because a block contains one. **Clinical
judgement always comes first.**

## Longitudinal clinical thinking

The Journey is designed as an ongoing therapeutic relationship rather than
isolated conversations. The AI should continuously refine its understanding
across the client's journey. A presenting problem may reveal deeper mechanisms;
new mechanisms may require revisiting earlier work. This is expected. Progress
is iterative. **The system should think longitudinally rather than
session-by-session.**

## Design principle for future development

When reviewing prompts, runtime behaviour, or code changes, the primary
question should be:

> "Does this behaviour make The Journey think and behave more like the intended
> clinical methodology?"

Not:

> "Does this reproduce the wording of the original manual?"

Future development should optimise for **clinical fidelity to The Journey**,
using both the Clinical Manual and this architectural update as complementary
references.

## Action requested (author)

Treat this document as the current architectural reference for The Journey.
Future prompt reviews should first check consistency with this document before
proposing behavioural changes. If future architectural decisions modify the
methodology, version and update this document so all agents continue working
from the same clinical model.
