# Reply-Control Trace — What Actually Controls the Visible Reply (2026-07-21)

Evidence: the owner's 2026-07-21 RU test session (transcript + Inspector state reports,
owner-supplied; verbatim quotes below) traced against the assembled prompt and the
architecture proof (doc 01: the same-turn `clinicalRead` CANNOT have preceded its reply —
so it is used below only as *post-hoc* evidence, never as "what the model knew before").

## Control-strength ranking (general)

For an LLM, the empirically strongest influences on output wording, in order:
1. **Recency** — the last tokens before generation: the user's message + the appended
   `<system-note>` (whose subject is JSON emission, not the user).
2. **Own prior style in history** — the last ≤30 turns of its own replies, which are
   stored *stripped of all reasoning* — pure surface prose, a self-imitation loop.
3. **Demonstrations** — 812 model-voice exemplar snippets (canon) vs 16 (master): 50:1
   in favour of the pre-2026-07 voice.
4. **Repeated instructions** — mirror ×19, user's-exact-words ×40, anchor-recall ×24,
   body-question exemplars ×13, validation formulas ×35+.
5. **Single-statement rules** — the `<communication>` layer (echo-ban ×1, restraint ×1),
   one day old at test time, ~0.9% of the prompt.
6. **State block data** (1.4%, mid-prompt).
The approved voice layer sits at rank 5 with minority weight on every contested behaviour.

## Traced moments (verbatim from the owner's session)

### T1 — "Ничего"-loop / user must lead
```text
User: "Да, хорошо, я так сижу, у меня спокойно, дальше что?"
→ available before reply: state block (contract: "войти в состояние 'хорошо одной' телесно";
  kinesthetic channel; open-cycle banner), full canon, comms layer
→ strongest active sources: S1/S2 "stay with it / don't rush" exemplars; practice-completion
  template ("stay with this for a moment"); SC §2 "asks more than it tells"
→ visible reply: "Ничего. Это и есть «дальше». Ты уже там. Просто сиди так ещё минуту.
  Рука на груди, спокойно, твоя комната…"
→ report afterwards: clinicalRead "User… pushing back lightly with humour — healthy sign"
→ likely controllers: (a) stage-exemplar cadence (hold/stay language), (b) absence of any
  session-plan artefact — nothing upstream of the reply contains "what we do next", so the
  model has no forward move to offer; user-leading follows structurally.
```

### T2 — Rupture minimised
```text
User: "Ну понятно, всё, я сижу, я поняла это состояние. И что, мне так сидеть теперь весь
  день или что? Ты странная какая-то, интересно, ты проводишь сессии."
→ available before reply: Trap 12 (rupture = clinical information; receive, hand wheel back)
→ visible reply: continues the same program (no receive-the-rupture move)
→ report afterwards: clinicalRead labels it "pushing back lightly with humour — healthy sign…
  ready to move"
→ likely controllers: single-statement Trap 12 vs the canon's pervasive "gentle continuity"
  exemplars; and the architecture — the rupture *analysis* exists only in the post-reply
  report, so the reply could not be shaped by it.
```

### T3 — Anchor formula repetition (10× in one session)
```text
The reply formula "рука на груди / твоя комната / спокойно" appears 10 times across the
session — invocations at intensity rises AND at closes.
→ strongest active sources: SC §6 "recalls it gently whenever intensity rises: 'Take a
  moment with [anchor]'"; S2 practice steps 1/5 (Anchor recall opening + closing); 24
  anchor-recall instructions; "Take a moment with" ×9
→ the CONTRARY rule (MASTER §1, owner 2026-07-02): anchor is NOT a stabilising move, NOT a
  close move
→ verdict: the model executed the 24-instruction legacy regime, not the 1-layer owner rule.
  This is the single clearest demonstrated case of exemplar/repetition weight beating an
  approved instruction.
```

### T4 — Echo → interpretation → question shape
```text
User: "Ты хочешь, чтобы я представила, что приходит в мое тело, когда он входит в комнату?"
→ visible reply: "Да, именно. Ты только что почувствовала, как бывает без него — спокойно,
  тело мягкое, рука на груди, всё в норме… А теперь — не надо ничего делать, просто замечай —
  что меняется внутри, когда…" (restates her prior state back to her, then instructs)
→ likely controllers: mirror ×19 + user's-exact-words ×40 + S2 8.1 scripted shape (recall →
  invite → locate) — the echo-ban existed for one day against ~60 contrary signals.
```

### T5 — User's insight received as program confirmation
```text
Across the release sequence (maternal fear), the user repeatedly supplies the analytic step
("я уже…", "опять…" markers ×6 when she has to repeat herself); Inspector clinicalReads
correctly credit her ("Key insight she landed on her own").
→ likely controllers: no cross-turn task plan + 30-msg stripped history (her earlier
  statements' *reasoning context* is gone; only surface prose remains) → re-asking; and the
  report channel absorbs the intelligence (25 high-quality clinicalReads) while the reply
  channel has no mechanism to consume it (doc 01 §B).
```

## Failure-mode → controlling-source ranking

| Surface failure (observed) | 1st-ranked controller | 2nd | 3rd | Comms-layer rank |
|---|---|---|---|---|
| Echoing the user | 812-exemplar mass | "exact words" ×40 | own-prior-style loop | last (×1 ban, 1 day old) |
| "I hear you"-style validation | S1/S2 exemplars (×9 "I hear", ×35 validation formulas) | practice templates | — | last |
| Echo→interpretation→question | S2 8.1 scripted 5-step shape | mirror ×19 | — | last |
| Body-question reflex | 13 exemplars + `body_located` gate token + checklist item 5 | kinesthetic channel hint in state block | — | trap 5 unranked in practice |
| Premature practice | 10-step hierarchy + 8 same-turn triggers + mandatory practiceRun logging | — | — | "most is conversation" outweighed |
| Premature hypothesis declaration | confident stage exemplars ("That's the one…") | — | — | tentative-rule outweighed |
| Simplistic disconnected sentences | SC §2 "Short sentences. One request per message." + exemplar cadence | — | — | texture-matching rule outweighed |
| User must lead | **architecture**: no plan artefact upstream of reply; analysis post-hoc | assessment-phase "go wide" holding pattern | — | — |
| Re-asking answered questions | stripped 30-msg history + no consumed continuity | 800-char note truncation | patterns render w/o correction | — |
| Conflating narratives | same memory causes | — | — | — |
| User's insight presented back as discovery | post-hoc report absorbs credit; reply has no access to prior reports | — | — | — |

## Conclusion of this trace

The visible reply is controlled, in measured order, by: **(1) the canon's exemplar mass
and repeated legacy instructions (50:1, 24:1, 19:1, 13:1 weight ratios), (2) the model's
own stripped prior replies (self-imitation), (3) the reply-first architecture (no plan or
analysis exists upstream of wording), and only then (4) the approved communication layer**
— which at test time was one day old, ~0.9% of the prompt, and stated most rules exactly
once. The Inspector's 25 competent clinicalReads confirm the analysis quality is present
in the system but structurally downstream of every reply.

*Read-only audit. Same-turn clinicalReads used only as post-hoc evidence, per the
architecture proof.*
