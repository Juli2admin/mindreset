# Audit — Why the Journey Clinician Has Collapsed into One Narrow Method

**Date:** 2026-07-19
**Trigger:** pilot observation — the AI clinician behaves too similarly across very
different users: detect pattern → find image/body response → identify part or
foreign voice → symbolic release → clean identity statement → close.
**Scope:** read-only audit of the runtime prompt architecture. No code, prompt, or
stage-doc changes made.

**Runtime corpus audited** (what the model actually receives each turn, per
`lib/journey/prompts/assemble.ts` `assembleSystemPromptBlocks`):

1. `docs/journey/00-shared-core.md` (Shared Core)
2. `docs/journey/PRACTICE_GENERATION_ALGORITHM.md` (PGA)
3. `docs/journey/01…08-stage-*.md` (all 8 stage specs, all loaded every turn since PR λ)
4. `docs/journey/runtime/journey-master.md` (master prompt, split around the state block)
5. The per-turn state block rendered by `renderStateBlock` (`assemble.ts:150-414`)

`CLINICAL_MANUAL.md` (3,991 lines) is **not** loaded at runtime.

---

## Verdict in one paragraph

The clinician has not "drifted" into the image–pattern–release arc. The arc is the
only method that exists anywhere in its context. Every operationalised tool — the
8 moves, the 5 practice families, the 38-item move vocabulary, the cycle model, the
gate tokens, the worked examples — is a station on the same line. Cognitive,
existential, values, decision, behavioural and narrative-reconstruction work are
either name-checked in one line without a playbook, locked behind Stages 6–8,
or explicitly forbidden. There is no assessment step that asks what the user wants
from the conversation, and the channel system routes even avowedly cognitive users
toward the body. The model is following its instructions correctly; the
instructions describe exactly one route.

---

## 1. Initial clinical assessment

**Does an assessment layer exist?** Partially. Two layers exist; neither asks the
questions in the audit brief.

**Layer A — `<clinical_reading>`** (journey-master.md, lines 45–65). Before every
reply the AI holds in mind:

> "**Vocabulary.** What language are they using? … **Channel.** What channel are
> they actually using right now? … **State.** Window of tolerance … **Intensity.**
> 0–10 … **Working hypothesis.** What seems alive? What pattern, what longing, what
> stuck place? What old programme might be running? … **What just shifted.** …
> **Which move serves now.** From the 8 moves in `<purpose>` — which one fits this
> moment for this user?"

This is a *clinical-state* read, not a *task* read. Note the two narrowing frames
baked in: the hypothesis question is pre-shaped as "what pattern … what old
programme might be running?" (pattern-detection is the default lens), and the
route decision is "which move serves now — **from the 8 moves**" (the answer space
is the arc).

**Layer B — `<assessment_phase>`** (journey-master.md, lines 182–232). Block 1
gathers: presenting issues, personal history, current functioning, patterns and
voices, resources, support network, risk markers, treatment goals, personal anchor.
"Treatment goals — what they want to be different, in their words" is the single
bullet closest to "what is the user asking for" — and nothing downstream ever
consumes it for route selection, because there is no route selection.

**What does NOT exist anywhere in the runtime corpus** (verified by search):

- No instruction to assess what the user is asking for *from this conversation*
  (exploration vs clarity vs a decision vs practical action vs emotional processing).
- No instruction to assess what the user expects the conversation to be.
- No instruction to assess whether the user prefers concrete, reflective,
  analytical, existential, narrative, behavioural, somatic or imagery-based work.
  The nearest artefact is the channel enum (§2 below), which is a
  *perception-modality* taxonomy (visual/kinesthetic/emotional/cognitive/verbal/
  mixed), not a *working-preference* taxonomy — "existential", "practical",
  "behavioural", "analytical" cannot be expressed in it.
- No method-selection step, because the corpus contains one method.

The word "existential" appears **zero times** in the entire runtime corpus (and
zero times in CLINICAL_MANUAL.md). "Readiness for depth" exists only as
safety-shaped depth permissions (surface/middle/deep per stage), not as a user
preference to be asked about.

**Conclusion §1:** an assessment layer exists, but it assesses *state* (safety,
intensity, channel, window of tolerance) and *hypothesis* ("what old programme is
running") — never *task* ("what does this person want from me today, and which
kind of work fits that"). The share-back milestone confirms the AI's formulation
of the user; it never confirms the *contract* for the work.

---

## 2. Processing channel

**How it is determined.** The AI emits `channel` in the state report on every
substantive turn (journey-master.md line 586: one of
visual/kinesthetic/emotional/cognitive/verbal/mixed). `save.ts:39` then does:

```ts
if (report.channel) updates.processingChannel = report.channel;
```

→ `RecodeProgress.processingChannel` is a **single last-write-wins value**. Every
turn's read overwrites the stored one. No history, no confidence, no
trait-vs-state distinction.

- **One turn or several?** One. Whatever the AI emitted last turn is the stored channel.
- **Permanent type or current-session mode?** Structurally it is "most recent
  turn's read", but it is *presented* to the AI as a stable finding — the state
  block renders `- Processing channel detected: X` (`assemble.ts:171`) with an
  attached standing family preference. Shared Core §8 also frames it as a stored
  trait ("Processing channel … refined over time").
- **What evidence changes it?** Any single turn emission. Nothing prevents
  oscillation; nothing consolidates it either.
- **After the user rejects body work or imagery?** `modalityRejected` accumulates
  into `sessionRejectedModalities` (`load.ts`, derived from the current session's
  turns only) and the state block then says: "**Modalities the user has explicitly
  refused this session:** … Do NOT re-offer" (`assemble.ts:240-245`). This works —
  but it is **session-scoped**. On the next session (>4h gap) the refusal list is
  empty and the AI may re-offer body/imagery from scratch. Rejections are never
  persisted as durable knowledge about the user.
- **Does the channel influence the next response?** Yes — via
  `CHANNEL_FAMILY_GUIDANCE` (`assemble.ts:135-148`) injected directly under the
  channel line, and via the master prompt's channel-aware family selection
  (journey-master.md lines 260–269).

**The exact adaptation lines** (`assemble.ts:135-148`, mirrored at
journey-master.md 260–269):

> - visual → "Prefer landscape-family practices …"
> - kinesthetic → "Prefer somatic-family practices …"
> - emotional → "Prefer compassion-family practices … or affect labelling."
> - **cognitive → "Prefer narrative-family practices (Soft Why, voice mapping,
>   clean identity statement) — and invite body location so the work does not
>   stay in the head."**
> - verbal → "Prefer narrative-family practices … user is working through words."
> - mixed → "Weave two families …"

Two structural problems:

1. **Every channel maps into the same five families.** "Cognitive" does not route
   to cognitive work — it routes to the *narrative family*, whose definition is
   "Soft Why, voice mapping, clean identity statement" (journey-master.md line
   242) — i.e. the release arc in verbal form. There is no cognitive, existential,
   practical or behavioural destination for the router to send anyone to.
2. **The cognitive channel is explicitly instructed to pull toward the body** —
   "invite body location so the work does not stay in the head." A rational user
   who processes in concepts is, by standing instruction, nudged somatically on
   every turn. Trap 5 ("Body-obsession … not as a default reflex", line 358)
   pushes the other way, but the operational line is proximate to the state and
   concrete; the trap is general and distant. Reinforcing this: Stage 1 §7's
   adaptation for "Over-analytical / cognitive" users is "Gently shift focus from
   thought to body: *'What do you feel physically right now?'*"
   (01-stage-stabilisation.md:90).
3. **The AI cannot even recommend staying cognitive.** Its own next-intervention
   vocabulary `NEXT_BEST_MODES` (`stateReport/schema.ts:126-137`) is:
   `continue_imagery | switch_to_somatic | switch_to_imagery | use_narrative |
   use_compassion | allow_discharge | integrate | stabilise | close`. There is no
   `stay_cognitive` / `use_cognitive` option — although `therapeuticMode` does
   include `cognitive`, the forward-looking recommendation enum does not.

---

## 3. Full methodology visibility

**Documents visible on a normal turn:** Shared Core, PGA, all 8 stage specs,
master prompt, state block. (Since PR λ, 2026-07-11, all 8 stage playbooks are in
context every turn — active-stage tunnel vision is no longer the mechanism.)

**Where each kind of work lives in that corpus:**

| Work type | Where it exists at runtime | Status |
|---|---|---|
| Imagery | PGA §4.3 + §8; landscape family; every stage's visual adaptations | Fully operationalised, everywhere |
| Somatic | PGA §4.2; somatic family; micro-movement targeting (master 271–279); every stage | Fully operationalised, everywhere |
| Parts work | Stage 4 (465 lines); moves 3–4; master examples | Fully operationalised |
| Identity exploration | Stages 5–7 (clean identity statement, identity anchor, symbolic identity map) | Operationalised — as arc stations only |
| Narrative work | "Narrative rewriting" family (PGA §4.4) = transforming an image/sentence/role; not narrative reconstruction of a life story | Partial — imagery-shaped |
| Cognitive work | One list item "Gentle cognitive reframing" (PGA §3); Schema-therapy one-liners (Shared Core §3, Stage 5 §3); Stage 6 "Cognitive Reframing of Identity Beliefs" — "not through analysis, but through felt re-statement" (06:48) | Name-checked, **no playbook** |
| Values work | ACT one line (Shared Core §3:77); Stage 7 Values Mapping — "direction, not goals", gated behind Stages 1–6 | Locked to Stage 7 semantics; no standalone practice |
| Behavioural work | Stage 6 micro-behavioural rehearsal ("one small thing", explicitly not tracked); Stage 8 CAL | Locked to Stages 6/8; forbidden earlier |
| Existential work | **Nowhere.** Zero occurrences of "existential" in the runtime corpus and in CLINICAL_MANUAL.md | Absent |
| Decision work | **Forbidden.** Shared Core §4: "No advice, no plans, no instructions for life decisions." Trap 2. Stage 6 §8.3 and all of Stage 7 forbid decision work; Stage 8 still: "No major life decisions, still." | Absent by design |
| Practical reflection | Nowhere as a recognised outcome; "Else → keep talking" (master hierarchy item 10) is the closest | Absent |

**Key structural fact:** loading all 8 stage specs (PR λ) widened visibility *within
the arc* — 8 chapters of one method — and did not add a second method. The
disproportion is no longer "active stage vs other stages"; it is "this method vs
any other". And the source canon has the same gap: CLINICAL_MANUAL.md contains no
values-clarification, life-timeline, writing-exercise, behavioural-experiment,
role-analysis or existential content either (verified by search). **The missing
repertoire was never authored, at any layer.**

---

## 4. Practice-generation narrowing

**Why "practice" collapses to breathing/grounding/warmth/imagery:** the PGA's
family list *is* that list. PGA §4 (and Shared Core §5.1, and the master's
`<practice_generation>`) define exactly five families: regulation, somatic,
landscape, narrative(-rewriting), compassion.

**Of the twelve intervention types in the audit brief:**

- **Not defined as practices anywhere:** structured clinical questioning, values
  clarification, life timeline, decision mapping, behavioural experiment, role
  analysis, existential exploration, narrative reconstruction, practical action
  planning. (Role analysis appears only as "imposed roles" = foreign material to
  release, Stage 5. Writing appears only as "letter to self" in the compassion
  family and "reflective journalling" in Stage 8 aftercare.)
- **Name-checked without a playbook:** cognitive reframing (PGA §3 list item;
  contrast with imagery, which gets PGA §8's 8-step protocol plus worked examples).
- **Defined but locked or reshaped:** identity mapping exists only as Stage 7's
  *Symbolic* Identity Map — an imagery practice; behavioural work exists only as
  Stage 6/8 micro-actions.

**The generation hierarchy routes every signal into the five families**
(journey-master.md 249–258): safety → regulation/somatic → **body activation →
somatic** → Block 1 assessment → **"Old voice / foreign sentence activates … →
foreign-material identification move"** → **"Signature image emerges … →
landscape family practice"** → affect labelling → grounding → compassion →
"Else → keep talking."

Items 5 and 6 are the pilot's observed behaviour, verbatim: any parental/critical
sentence a user utters routes to foreign-material work; any visual metaphor a user
drops routes to an imagery practice. There is no branch anywhere that reads "user
is analysing / deciding / questioning meaning → structured reflective work."

**Why the missing interventions don't appear in pilot sessions:** they cannot.
They have no family, no move ID (§5 below), no trigger in the hierarchy, no
worked example — and the emission mandate ("If anatomy ran, log it") only
recognises anatomies from the five families. The gap is a **specification gap,
not a compliance gap.**

---

## 5. Eight-stage bias

**Rhetoric says map; machinery says sequence.** The prompt *tells* the AI the
stages are flexible — master header: "They are NOT a sequence of fixed gates the
AI walks the user through"; `CANON_PROMPT_HEADER` (assemble.ts:434-450): "Stage
numbers are a bookkeeping label … they are NOT capability gates. … You lead." But
every operational structure encodes the sequence:

1. **The toolkit is the sequence.** The "8 moves available every turn"
   (journey-master.md 67–180) are anchor → pain → adult self → parts → foreign
   material → integration → new-identity sensing → embodiment. "Which move serves
   now" is free choice *among the arc's stations only*. Freedom of order, not of
   method.
2. **The move vocabulary is the sequence.** `CANONICAL_MOVES`
   (stateReport/schema.ts:35-83): 38 IDs — 16 universal (practices in the five
   families + rituals) + 22 stage-scoped, all arc anatomies. "Unknown IDs are
   silently dropped by the parser" (master line 697). The AI must describe every
   turn it takes in arc vocabulary; work it cannot name it will tend not to do.
3. **Gate tokens are fished for.** The Block 1 checklist (master 747–764) is
   "NON-NEGOTIABLE … run EVERY turn": emotion_named / body_located /
   orientation_present "SHOULD be firing on nearly every turn." This
   materialises as the AI angling for an emotion word and a body location with
   every user, whatever they came for — pattern-search too early is *instructed*
   ("what old programme might be running?", clinical_reading).
4. **Early hypothesis → pull toward a part.** Master Example 3 (466–474): user
   states a self-sabotage pattern in cognitive language; the modelled response is
   "what does the part of you that messes it up actually seem to be doing?" with
   the annotation "opens parts territory through their analytical door." The
   worked example *teaches* converting analysis into parts work.
5. **Foreign-voice search** is hierarchy item 5 (§4 above) plus move 5's trigger:
   "When the user names a belief, voice, or pattern that came from outside …"
   (line 139) — which matches nearly any statement about upbringing.
6. **Release as the default goal / one-arc sessions.** The Sensitivity Layer's
   cycle definition (master line 803): "A cycle is any distinct piece of
   therapeutic work: parts work opening → contact → containment → close.
   Foreign-material identification → return → integration. Somatic activation →
   discharge → settling." All three canonical cycle shapes are arc shapes; a
   clarity conversation or values inquiry has no cycle grammar. Cycle close
   requires "the image (if any) has shifted positively or neutralised … the user
   confirms relief" — release-shaped completion criteria. Stage 5's gate
   additionally requires `somaticRelease: true` + `cleanIdentityStatement` —
   codified image-release-statement.
7. **Progression is rewarded.** The move-based advance lane
   (router/move-based-advance.ts, router.ts:107-125) advances the stage label
   when sustained higher-stage arc moves appear — the only "progress" the system
   can see is arc progress. `stageJustAdvanced` then injects "run the canonical
   opener now" (assemble.ts:218-223).

**Answer: B, operationally.** The stages are *presented* as a flexible clinical
map (post-PR λ language is genuine and repeated), but they function as the default
treatment sequence because the map's territory contains nothing except the
sequence's stations. Flexibility of *when* is real; flexibility of *what* does not
exist.

---

## 6. User-type replay

What the current prompt architecture would predictably do with each user:

### User A — visual, emotionally articulate, produces symbolic images
Channel → `visual` → landscape preference. Her metaphors trigger hierarchy item 6
(signature image → landscape practice) every time; images are captured to
`userImagesCaptured`/`signatureImages` and re-surfaced. Parts arrive naturally as
figures; release rituals (grey backpack, returned to mother's house) fit her
perfectly. **The system was implicitly designed for her.** Route selected: the
arc, and it is genuinely appropriate. Risk is only over-use: every image becomes
a practice, sessions accrete toward release even on days she wanted to talk.

### User B — somatic, feels activation, does not visualise
Channel → `kinesthetic` → somatic family; micro-movement targeting fits well.
Friction points: Stage 5's Symbolic Return is visually framed ("place it outside
you … what does it look like out there?") — the somatic adaptation exists
(05:123, expansion/contraction tracking) but the practice's spine is
externalise-an-object. The Alternative Rule ("I can't visualise" → switch) works
within a session; because `modalityRejected` is session-scoped, the imagery offer
returns in later sessions. **Serviceable fit, with repeated imagery re-offers and
a release ritual that presumes symbolic externalisation.**

### User C — rational accountant, ~50, asks about meaning and purpose
Channel → `cognitive`, which routes to: "narrative-family practices (Soft Why,
voice mapping, clean identity statement) — and invite body location so the work
does not stay in the head." Stage 1 §7 tells the AI his analytical register is a
distance from feeling to be redirected: "Gently shift focus from thought to body."
The Block 1 checklist needs `emotion_named` and `body_located` from him, so the AI
will fish for feelings and body sensations turn after turn. His actual question —
meaning, purpose, how to live — has **no destination**: zero existential content,
values work locked inside Stage 7's mapping semantics, "philosophical discussion"
absent from every family. Master Example 3 teaches converting his self-analysis
into parts language. Predicted arc: his statements about his upbringing/career
trigger foreign-voice mapping; his metaphors ("crossroads") trigger landscape;
the session drives toward a release he did not ask for. **Missing: an intake
question about what he wants; an existential/values route; permission to treat
sustained cognitive work as the work rather than as the corridor to the body.**

### User D — practical user wanting clarity on a business decision
The worst fit, and partly **by design**: Shared Core §4 — "No advice, no plans, no
instructions for life decisions" — plus Trap 2 and Stages 6–8's standing "no major
decisions" rule mean the AI *cannot* do decision work. But nothing instructs it to
notice and name the mismatch either, so instead of "this isn't a decision-support
space — here's what I can offer", it will do the only thing it can: look under the
decision for feelings (`emotion_named`), patterns ("what old programme might be
running?"), and inherited voices ("whose voice says you must…?"), and offer
grounding. The user asked for a decision map and receives an inner-child inquiry.
**Missing: a contract check at intake, and a product decision (Julia's call)
about whether decision *facilitation* — structured clarification of the user's own
options and values, never advice — is in scope. The current prohibition wording
bans the entire territory.**

---

## 7. Conversation evidence — BLOCKED, needs transcripts

The referenced material (the Julia session and the existential-purpose tester
session, and `docs/pilot/tester-audit-2026-07-18.md`) is **not in the repository**
— the `docs/pilot/` directory does not exist, and Journey conversations live
encrypted in the DB, which this audit cannot read.

To complete §7, supply either: (a) pasted transcripts, or (b) exports from
`/admin/journey-inspect`. The per-session analysis grid (original request → route
selected → commitment point → reassessment → alternatives → narrowing moments →
repertoire used) is ready to run the moment transcripts are available. The
architectural findings above predict what the transcripts should show: route
committed at the first image/pattern/parental-sentence trigger (hierarchy items
5–6), no reassessment against the original request (no instruction exists to do
so), and closure timed to release/grounding rather than to the request.

---

## 8. Closing protocol

**What closure instructions exist today:**

1. Shared Core §10 (line 273): close = "a closing PRACTICE (regulation / somatic /
   grounding …), a soft closing line, and an offer (save / repeat / move on /
   rest)."
2. Stabilising-before-closing (master 281–289): the 1–10 stability question — but
   **only if the user destabilised this session** (intensity ≥ 6 at any point,
   dizziness, shutdown …). A calm session closes with no check at all.
3. Sensitivity Layer rule 6 (master 819–825): do not end while the image is
   frightening, body emotion active, `stabilityCheck.score < 6`, or "the user has
   said the work is unfinished"; cycle close requires "user confirms relief or
   completion."
4. Stage-specific rituals: Securing the Part (Stage 4), Safety Reorientation
   (Stage 7), aftercare notes.

**Against the audit brief's checklist:**

| Required element | Present? | Evidence |
|---|---|---|
| Initial intensity / baseline | **No.** `intensity` is the AI's own per-turn read; the user is never asked for a baseline at session open. `lastIntensity` is stored but no open-ritual captures "where are you now, 0–10" | save.ts:41; no session-open instruction exists |
| Final intensity | Conditional only — the 1–10 ask fires solely after in-session destabilisation | master 281–289 |
| Comparison with the beginning | **No instruction anywhere.** PGA §12 lists "distress scale decreases" as a completion criterion but nothing operationalises begin-vs-end comparison | PGA §12 |
| User confirmation of relief/completion | Yes — but only inside the cycle model, and phrased release-shaped ("image has shifted positively or neutralised") | master 803, 826 |
| Unresolved material named | Partial — `cycleStatus: open` blocks closing; but unresolved material outside a cycle (an unanswered question, an unaddressed request) has no representation | master 803 |
| What changed / what remains | **No.** `continuityNote` covers this internally; nothing instructs saying it to the user | master `<memory>` |
| Whether the original request was addressed | **No — and it cannot be:** the original request is never captured as state. No field, no state-block line, no close-against-request instruction exists | schema.ts (no such field) |

**Are the existing instructions being followed?** Not verifiable without
transcripts/DB. Prior evidence (SESSION_HANDOFF 2026-06-28) already showed the
practice-emission mandate only partially honoured, so partial compliance on close
rituals is likely — but the larger finding stands regardless: **closure is defined
against the method's state (body softened, image neutralised, charge reduced),
not against the user's request.** A session that produced a successful release is
closeable by every rule in the corpus even if the user's opening question was
never touched.

---

## 9. Root-cause conclusion (ranked)

1. **The intervention repertoire itself is single-method** (= "master prompt
   overweights imagery/parts/release" + "practice algorithm too narrow", which are
   one cause with two surfaces — and it extends into the stage canon and
   CLINICAL_MANUAL). Every operationalised tool is the arc; the alternatives were
   never authored anywhere. *Evidence:* §§3–5 greps (zero "existential" in ~10K
   lines of canon; cognitive reframing = 1 list item; decision work forbidden);
   five families; 38-move vocabulary; cycle grammar. **Primary cause. The model
   cannot select a method that does not exist.**
2. **Missing task-contract assessment layer.** `<clinical_reading>` reads state
   and hypothesis, never the user's ask; no route-selection step; share-back
   confirms the formulation, not the contract; "treatment goals" is gathered once
   and never consumed. *Evidence:* §1. **This is why the narrowing is invisible
   to the AI — it never checks its route against the request.**
3. **The channel system conflates perception modality with method, and actively
   redirects cognitive users to the body.** "Cognitive → narrative + invite body
   location so the work does not stay in the head" (assemble.ts:143, master 264);
   Stage 1 §7 "shift focus from thought to body"; `NEXT_BEST_MODES` has no
   stay-cognitive option; refusals reset every session. *Evidence:* §2.
4. **Gate-token and emission pressure** (a slice of "state-report/technical-task
   overload"). The non-negotiable Block 1 checklist makes emotion-fishing and
   body-locating a per-turn requirement; the move-based advance lane rewards arc
   moves; gate criteria (somaticRelease, cleanIdentityStatement) codify
   release-as-completion. *Evidence:* master 747–764; stage gates §10s. The rest
   of the overload claim (sheer instruction volume) is plausible as an amplifier
   but not the driver — the behaviour matches the content of the instructions,
   not degradation of them.
5. **Insufficient onboarding context.** The user-facing opener pre-frames the
   product as pattern/parts work ("re-shaping the patterns you've been carrying:
   old beliefs, stuck reactions, parts of you that have been waiting to be
   heard") and ends with "tell me how you're feeling today" — priming affect
   disclosure, not request statement. No intake of "what do you want from this?"
   *Evidence:* `messages/en.json Journey.opener`. Contributing, not primary.
6. **Active-stage prompt bias.** Largely fixed by PR λ (all 8 specs loaded, stage
   label demoted to bookkeeping); what remains is the `stageJustAdvanced` opener
   injection and Block-1's hard practice restrictions. Historical cause, now minor.
7. **Model capability limitation.** Least supported. The observed behaviour is
   high-fidelity execution of what the corpus specifies — including its gaps. No
   intervention is warranted here until the spec-level causes are fixed and
   behaviour re-tested.

---

## 10. Minimal next step (proposal only — nothing changed yet)

The smallest intervention that addresses causes 1–4 without new architecture is
**one focused PR touching `journey-master.md`, `PRACTICE_GENERATION_ALGORITHM.md`,
and one constant in `assemble.ts`** — four edits:

1. **Add a task-contract line to `<clinical_reading>`** (and to the five silent
   sensitivity questions): *"What is the user asking for in this conversation —
   exploration, clarity, thinking through a choice, emotional processing,
   practical reflection? Does the route I'm on still match it? If unsure — ask
   them."* Record the answer inside `clinicalRead` (no schema change needed).
2. **Widen the narrative family's definition and Block 1's permitted practices**
   to make structured reflective questioning, values clarification, and gentle
   cognitive reframing first-class, generatable practices at any stage — emitted
   as `family: "narrative"` (no enum change). Add one hierarchy branch: *"User is
   analysing, questioning meaning, or seeking clarity → structured reflective /
   values work (narrative family). Staying cognitive is valid work, not a defence
   to route around."*
3. **Fix the cognitive-channel guidance** in `CHANNEL_FAMILY_GUIDANCE`
   (assemble.ts:143) and its mirror (master 264): remove the standing "invite
   body location so the work does not stay in the head"; make body-invitation
   conditional on visible somatic activation, at most once, dropped on refusal —
   and persist refusals in wording ("this user has previously declined body
   work") via the continuity note.
4. **Close against the request**: add to the session-close instructions — briefly
   check the close against what the user came with ("we started with X — where is
   that now for you?"), ask for a now-number when one was taken earlier, and name
   what remains open. Release is one valid ending, not the definition of one.

This is deliberately prompt-level and reversible; it makes the clinician assess
before intervening, stay cognitive when appropriate, switch on evidence, and
close against the request — using the existing schema and router untouched.

**Explicitly deferred, pending Julia's decisions (bigger than a prompt edit):**

- **Authoring genuinely new repertoire** — existential/meaning work, life
  timeline, writing exercises, behavioural experiments, decision *facilitation*
  as canon documents. This cannot be prompt-engineered into existence; it is
  clinical authorship (hers), and it is the real fix for cause 1.
- **Scope ruling on decision work** (User D): keep the advice prohibition, but
  decide whether structured clarification of the user's own options/values is in
  or out. Current wording bans the territory outright.
- Durable (cross-session) modality-refusal memory; a `sessionIntent` schema
  field; re-testing the four personas against the patched prompt.

**Verification plan once approved:** re-run the User C and User D personas
against the patched prompt before touching anything else, and complete §7 with
the pilot transcripts.
