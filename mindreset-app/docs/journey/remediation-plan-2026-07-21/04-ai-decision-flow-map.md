# AI Decision Flow Map — Journey Runtime (2026-07-21)

Every decision made in one Journey turn, WHO makes it (CODE = enforced in TypeScript,
MODEL = the LLM's discretion, PROMPT = instruction the model may ignore), and WHEN it
happens relative to the visible reply. Verified against the audited runtime
(`audit-2026-07-21-runtime-integrity/01`); read-only documentation — changes nothing.

## Map 1 — One turn, start to finish

```mermaid
flowchart TD
    U[User message arrives] --> D1{"D1 Access & safety gate<br/>CODE: auth, rate limit, red-screen,<br/>monthly cap, purchase window"}
    D1 -->|denied| X1[HTTP error - no AI turn]
    D1 --> D2{"D2 Frozen for review?<br/>CODE"}
    D2 -->|yes| X2["Canned crisis exchange<br/>only Haiku verifier verdict<br/>'safety_confirmation' unfreezes - CODE"]
    D2 -->|no| D3{"D3 Crisis keyword scan<br/>CODE: regex, pre-LLM"}
    D3 -->|hit| X3[Canned crisis reply + FREEZE<br/>model never called]
    D3 -->|clean| P1["Persist user message - CODE"]
    P1 --> P2["Load state - CODE<br/>caps: 5 parts, 3 files, 5 images, 5 patterns<br/>session-boundary reset: rejections & cycle<br/>DROPPED after any 4h gap"]
    P2 --> P3["Build history - CODE<br/>last 30 messages, reasoning stripped,<br/>leak-masked"]
    P3 --> P4["Assemble prompt - CODE<br/>Block1 canon 73.5% cached<br/>Block2 master cached<br/>Block3 live state    Block4 master"]
    P4 --> P5["Append emission reminder - CODE<br/>occupies the recency slot; subject = JSON"]
    P5 --> M1[["MODEL - single streamed completion<br/>claude-sonnet-4-6, temp default, 2500 tok"]]

    subgraph MODEL_TURN ["Inside the one completion - all MODEL discretion"]
      M1 --> D4{"D4 Which playbook / which move?<br/>PROMPT: 8 moves + all 8 stage specs +<br/>'stage label is bookkeeping'<br/>NO enforced analysis step before wording"}
      D4 --> D5{"D5 How to sound?<br/>PROMPT: comms rules 0.9%<br/>vs 812 old-voice exemplars 50:1"}
      D5 --> R[VISIBLE REPLY TOKENS STREAM TO USER]
      R --> D6{"D6 What did I just do?<br/>MODEL writes state-report AFTER reply:<br/>intensity, safety, action, clinicalRead,<br/>moves, practice, contract, note"}
    end

    R -.->|streamed live| UV[[User sees reply]]
    D6 --> P6["Strip & parse report - CODE<br/>parse failure => intensity 5 / watch / stay<br/>silent hold-biased default"]
    P6 --> D7{"D7 Safety after the fact<br/>CODE: AI red_flag honoured unconditionally;<br/>Haiku verifier may FREEZE NEXT turn<br/>this reply already delivered"}
    P6 --> P7["Persist - CODE<br/>anchor set-once; contract field-merge;<br/>continuityNote FULL OVERWRITE;<br/>patterns/parts: no correction path"]
    P7 --> D8{"D8 Stage routing - CODE<br/>see Map 2"}
    D8 --> NT[Next turn's context]
```

**The structural fact the map shows:** every clinical decision that shapes the reply
(D4, D5) happens inside one unplanned generative pass — the analysis artefact (D6)
is produced after the reply tokens have already reached the user, and code only ever
acts downstream (D7, D8, next turn). Nothing upstream of the reply contains a plan.

## Map 2 — Stage routing decision (post-turn, CODE)

```mermaid
flowchart TD
    S[Parsed report] --> RG{"regress_to_grounding /<br/>regress_to_parts?"}
    RG -->|yes| RGX["Stage lowered to 1 / floored 4 - CODE<br/>the ONE single-report-value authority"]
    RG -->|no| OC{"Open cycle on LAST turn?<br/>CODE: literal 'open' only<br/>('closing' does NOT block here,<br/>but DOES count in the prompt's banner -<br/>two different definitions"}
    OC -->|open| HOLD1[No advance this turn]
    OC -->|clear| CL{"Classic gate - CODE<br/>needs recommendedAction='advance'<br/>+ intensity/safety window + stage tokens<br/>+ two-days reproducibility<br/>Stage1 STILL requires anchor -<br/>retired by owner 2026-07-02, never shipped"}
    CL -->|pass| ADV[currentStage +1, depth reset 'surface']
    CL -->|fail| MB{"Move-based lane - CODE<br/>ignores recommendedAction entirely:<br/>3+ stage_N moves, intensity <=5,<br/>safety none, adultSelf >=50%"}
    MB -->|pass| ADV
    MB -->|fail| STAY[Stage unchanged]
    ADV --> N2[Next turn]
    STAY --> N2
    HOLD1 --> N2
```

Fields the model emits that **no code reads**: `cycleCanClose`, `stabilityCheck.score`,
`currentDepth` (dead — always "surface"), `clinicalRead` (except 240-char open-cycle
echo within the same session). Session CLOSE has no code concept at all — close
discipline is prompt-only.

## Map 3 — Where the approved Thinking experiment inserts (flag-gated, not built into production)

```mermaid
flowchart LR
    P5[Prompt + reminder ready] --> T{{"JOURNEY_THINKING flag"}}
    T -->|off - production today| M[Reply tokens first, then report]
    T -->|on - experiment| TH[["THINKING BLOCK first - hidden by API design<br/>the owner's 5 plan questions:<br/>1 what is asked  2 what's established<br/>3 hypothesis held tentatively  4 single best move<br/>5 what must not be repeated/imposed/concluded"]]
    TH --> M2[Reply tokens - now downstream of a plan]
    M2 --> RP[Report unchanged]
```

This is the only architectural difference the experiment tests: D4/D5 gain an enforced
pre-reply step. Everything else (parsing, persistence, routing, safety) is untouched.

## Authority summary

| Decision | Owner today |
|---|---|
| Can the turn happen (access, crisis, freeze) | CODE |
| What the AI knows this turn (state caps, 30-msg history, truncations, session resets) | CODE |
| Which clinical move, which playbook, when to practice | MODEL (prompt advisory; no pre-reply check) |
| How the reply sounds | MODEL (comms rules outweighed 50:1 by legacy exemplars) |
| What gets remembered (report fields) | MODEL writes / CODE filters & merges |
| Crisis response | CODE (3 triggers; verifier post-delivery) |
| Stage progression | CODE (two un-reconciled lanes) |
| Session close | NOBODY (prompt-only discipline) |
| Depth | NOBODY (dead field) |
```
