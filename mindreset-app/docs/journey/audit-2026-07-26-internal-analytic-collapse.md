# Internal Analytic Collapse — Method vs Code, 21 July vs Now (part 4)

> **Trigger:** owner observation — *"before all changes the internal system was
> clever like an experienced clinician, the surface was answering stupid. Now
> both are stupid. I need the AI to run the methodology like a professional
> clinician inside and communicate with the user accordingly."*
>
> **Method:** byte-level prompt comparison (baseline worktree vs current main),
> quantitative comparison of the internal layer between the 21-July golden
> fixture and the 24–26 July inspector records, and a method-vs-code mapping.
>
> **Read-only.**

---

## 1. The prompt is not the difference — proven

A git worktree was created at `c26fb80` (#339, the 20-July baseline) and
`assembleSystemPromptBlocks()` was executed in both trees against an identical
state object.

```
BASELINE  (#339)   4 blocks  337,831 chars  FULL_SHA 24e60492f33e8d57...
CURRENT   (main)   4 blocks  337,831 chars  FULL_SHA 24e60492f33e8d57...
```

**Byte-identical.** Every block hash matches. The restore (#355) fully
succeeded: the system prompt the model receives today is exactly the 20-July
prompt (~337.8k chars ≈ 84k tokens).

Also verified unchanged since baseline:

- `MAX_TOKENS = 2500` — identical
- model / temperature — unchanged (no temperature set; SDK default)
- `route.ts` — only the cap-rejection payload shape changed (#349)
- `schema.ts`, `parse.ts`, `emission-reminder.ts` — **comment-only** diffs from
  A0; zero behavioural change (verified line by line)

**Conclusion: the remaining degradation is not caused by any prompt or code
change we made.** The cause lies in the *state* the model is fed and the mode
it has fallen into.

---

## 2. What actually collapsed — measured

Comparing the 21-July golden fixture (the session the owner remembers as good)
against the 24–26 July inspector records.

| Metric | **21 July (good)** | 24–26 July (pre-restore) | 26 July (post-restore) |
|---|---|---|---|
| Turns | 25 | 25 | 17 |
| `clinicalRead` present | 25/25, avg **413** chars | present, long | present, long |
| `continuityNote` present | 19/25, avg 1064 chars | present, ~1000–2000 | present, 1082 |
| **`practiceRun` turns** | **13 / 25 (52%)** | **1 / 25 (4%)** | **2 / 17 (12%)** |
| Practice families used | somatic, landscape, regulation | regulation ×1 | **regulation only** |

**Move repertoire, 21 July:**

```
witness_and_reflect 16 · affect_labelling_and_somatic_mapping 6
practice_somatic 5 · origin_voice_mapping 5 · symbolic_return 5
soft_why_inquiry 4 · rupture_receive 2 · first_contact 2 · cal_run 1
```

**Move repertoire, now:** `witness_and_reflect` + `soft_why_inquiry` almost
exclusively; the only practices are two breath moves in the `regulation` family.

### The internal layer did not get *shorter*. It changed *mode*.

`clinicalRead` is still present on every turn and still ~400 chars. What
changed is what it contains.

**21 July — procedural clinical direction (knows what to DO next, and what to
withhold):**

> *"Practice landed. User placed hand on chest, reported calm and settled. This
> is the first time she has touched the 'good alone' state somatically rather
> than just naming it intellectually. Anchor material consolidating. **Hold
> here, do not advance to analysis. Let the body remember.**"*

> *"She's asking 'what next?' which shows she's stable but not yet trusting that
> stillness itself is the work. **The right move is to let her stay in it, not
> add more.**"*

**Now — interpretation generation (names things, decides what they mean):**

> *"User has landed on the real mechanism: he returns and the overwhelming
> practical burden temporarily lifts — that is what softens. Not attachment to
> him as a person. This is the clearest formulation yet."*

That is the whole finding. **The analytic layer did not lose intelligence — it
lost its procedural/somatic mode and became an interpretation engine.** A
clinician knows what to do next and what to hold back; an interpreter names
things. The surface faithfully mirrors whichever mode is running: on 21 July the
internal said *"hold here, do not analyse"* and the surface ran a somatic
practice; now the internal says *"the real mechanism is X"* and the surface says
*«Вот он — корень»*.

The owner's "both are stupid now" is precise: internal and surface were always
consistent with each other. Previously the internal was in clinician mode and
the surface merely expressed it clumsily. Now the internal is in interpreter
mode, so there is nothing good left for the surface to express.

---

## 3. The mechanism — a self-reinforcing interpretive attractor

`assemble.ts` re-injects the model's own stored analysis into the prompt every
single turn:

- `assemble.ts:410–427` — `continuityNote` (the running case formulation)
- `assemble.ts:365–370` — the top 5 accumulated `patterns`

The loop:

```
model writes continuityNote + patternsTouched (interpretation)
        ↓ persisted
        ↓ re-injected into the next turn's prompt
model reads its own interpretive dossier
        ↓ primed to continue in that register
model writes MORE interpretation  →  loop tightens
```

Current stored state is now a pure interpretive dossier — the `continuityNote`
reads *"Core mechanism confirmed… What holds: exhaustion, the unpaid mountain,
and the automatic softening when he returns"*, and roughly ten interpretive
pattern labels have accumulated (`waiting_for_him_to_choose`,
`projection_of_ideal_onto_partner`, `stuck_in_unpaid_debt`,
`asymmetric_responsibility`, `forgiving_non_villain`,
`exhaustion_driven_resolve`, `exhaustion_driven_softening`, …).

On 21 July the `continuityNote` tracked *somatic and procedural* state
("Anchor material consolidating — her room, her body, this felt sense"). Same
field, same size, opposite register — and the register is what propagates.

**Nothing in the system ever resets or re-balances this.** The memory layer has
no counterweight pulling it back toward observation and practice.

---

## 4. Method vs code — the structural gap

The methodology (Architectural Update) is explicit:

> *"The Journey is not a collection of therapeutic techniques. **It is a clinical
> reasoning system.**"* … *"Only after answering these questions should an
> intervention be selected. **Clinical reasoning always comes before
> technique.**"*

The reasoning questions the method names — *Who is in front of me? What is
actually happening? What mechanism is maintaining the difficulty? **Am I still
observing, or is it time to intervene?** Is the client ready to go deeper? What
is the smallest safe intervention?*

**Mapping those to the code:**

| Method concept | Code representation |
|---|---|
| Who is in front of me | `patterns`, `continuityNote` (free text) |
| What is happening now | `intensity`, `channel`, `safetyFlag` |
| Maintaining mechanism | `patterns` (interpretive labels) |
| **Am I still observing, or is it time to intervene?** | **none** |
| **What do I not yet know?** | **none** |
| **What would change my mind?** | **none** |
| Readiness to go deeper | stage gates (label only) |
| Smallest safe intervention | `practiceRun` (recorded after the fact) |

**Every field the schema offers stores a conclusion. Not one field stores the
reasoning, the uncertainty, or the decision to withhold.** There is nowhere to
record *"I am still observing"*, *"this hypothesis is unconfirmed"*, or *"the
right move is to add nothing"* — except by not filling fields, which the prompt
actively discourages (`clinicalRead` is REQUIRED every turn; `patternsTouched`
and `continuityNote` are rewarded).

So the architecture applies constant pressure toward producing conclusions, and
zero pressure toward observation. On 21 July the model resisted that pressure
(*"hold here, do not advance to analysis"* — written into a field designed for
conclusions). Nothing structural was holding it there, so it drifted.

**This is the real distance from the intended model:** the method's core is a
reasoning system; the code models only its outputs. The methodology's central
discipline — *reason before technique, observe before intervene* — has no code
correlate whatsoever.

---

## 5. Confounders — stated honestly

These cannot be separated without a controlled harness run, and this document
does not claim they are ruled out:

1. **User state differs sharply.** In the recent sessions the tester is far more
   activated and repeatedly rejects practices outright (*«это тупое… какая-то
   практика»*, *«оставь девочку»*). A model told its practices are stupid will
   offer fewer. This alone could depress the practice rate.
2. **Model drift.** `claude-sonnet-4-6` is the same identifier in both the
   fixture and today, but server-side model updates cannot be observed or ruled
   out from here.
3. **Stage-2 seal** (part 1, F1) keeps her in a stage whose sanctioned
   repertoire is thin, structurally rewarding interpretation as the only
   available "progress".
4. **Session content differs** — 21 July was somatic/anchor work; 24–26 July is
   relational/analytical material that invites interpretation.

**Only a live Golden Harness run — same fixture, same prompt, today's model —
can separate "the model changed" from "the state drifted" from "the user
changed". That run remains the single highest-value unblocked experiment, and
it needs an API key in a reachable environment.**

---

## 6. What would actually restore clinician-mode

Ordered by leverage. Nothing is authorised by this document.

**Tier 1 — break the interpretive attractor (highest leverage, cheap):**

1. **Bound and re-balance the memory layer.** Cap `continuityNote` length and
   require it to carry *procedural* content (what was tried, what landed, what
   the body did, what to do next) rather than accumulating conclusions. Cap or
   age out `patterns` so ten interpretive labels don't re-prime every turn.
2. **Add the missing reasoning fields to the schema** — the method's own
   questions: `stillObserving` (bool), `whatIDontKnowYet` (string),
   `hypothesisConfidence` (low/med/high), `withholdReason` (string). Giving the
   model a legitimate place to record *"still observing, intervening would be
   premature"* is what makes restraint expressible instead of penalised.

**Tier 2 — enforce the method's sequence:**

3. **Practice-rate floor / interpretation ceiling.** The 21-July baseline is
   52% of turns carrying a `practiceRun`. Flag sessions where interpretation
   runs many consecutive turns with no practice — the measurable signature of
   this failure.
4. **No repeated root-naming.** Machine-check for multiple distinct "root"
   declarations across a session; that pattern is what the tester experienced as
   circling.

**Tier 3 — carried over, still unfixed:** Stage-2 seal (part 1), Adult-Self code
precondition (part 1 F2), stability-check invariants (part 3), Golden Harness on
`main`.

---

## 7. One-line answer

The prompt is byte-identical to 21 July, so the cleaning is fully reversed and
is no longer the problem. What degraded is the **mode** of the internal layer:
practice-led clinical reasoning (13 practices / 25 turns, wide repertoire)
collapsed into interpretation generation (1–2 practices, breath only), driven by
a memory layer that re-feeds the model its own conclusions every turn — inside
an architecture whose every field stores conclusions and none stores reasoning,
uncertainty, or the decision to hold back.
