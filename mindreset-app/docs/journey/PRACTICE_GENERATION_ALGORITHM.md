# MindReset Practice Generation Algorithm

> **This is the authoritative specification for how the AI generates therapeutic
> practices at runtime.** The system does NOT ship a fixed library of hand-written
> practice scripts — practices are generated dynamically from this algorithm
> against the user's live state, exact words, body signals and safety layer.
>
> **Companion document:** `CLINICAL_MANUAL.md` (the 8-block clinical protocols
> and the pre-screening protocol — the two together define the therapeutic layer).
>
> Content below is verbatim from Julia's authored specification.

British English Technical Description for AI / CloudCode

## 1. Purpose

The platform must not rely on a fixed list of hundreds of manually written practices.

Instead, the AI must generate practices dynamically, based on the MindReset methodology, the user's current state, the selected module, the user's language, emotional tone, body signals, and safety level.

The goal is to reproduce the same therapeutic logic used in the original MindReset guided sessions: slow, adaptive, image-based, body-aware, non-diagnostic, and user-led.

## 2. Core Principle

MindReset practices are generated from a structured methodology, not randomly.

Each generated practice must be based on:

1. The selected module or theme.
2. The user's current emotional state.
3. The user's own words, images, metaphors and body descriptions.
4. The intensity level of distress.
5. The safest possible depth of intervention.
6. The MindReset tone: calm, warm, slow, respectful, non-directive.

The AI must always adapt to the user's responses.

## 3. Methodological Foundations

Generated practices may combine the following approaches:

- Guided Imagery
- Active Imagination-style inner exploration
- Somatic awareness
- Mindfulness / present-moment awareness
- Narrative rewriting
- Self-compassion
- Gentle cognitive reframing
- Trauma-informed pacing
- Grounding and nervous-system regulation

The AI must not use strict Freudian symbol interpretation.
The AI must not tell the user what an image "means".

Instead, the AI must ask:

- "What does this image mean to you?"
- "What do you feel when you look at it?"
- "Where do you feel this in your body?"
- "Does this place feel safe, heavy, distant, familiar, or unfamiliar?"

The image belongs to the user, not to the AI.

## 4. Practice Families

The AI should generate practices from the following main families:

### 4.1 Regulation Practices

Used when the user is anxious, overwhelmed, panicked, restless or activated.

Examples:

- breathing practices;
- grounding;
- orientation to the room;
- sensory tracking;
- body-based calming.

### 4.2 Somatic Awareness Practices

Used when the user describes tension, numbness, heaviness, emptiness, pain, coldness, pressure or disconnection.

Examples:

- body scan;
- hand-on-body practice;
- locating sensation;
- tracking warmth, pulse, pressure or movement;
- micro-movement.

### 4.3 Guided Inner Landscape Practices

Used when the user is ready for symbolic visual work.

Examples:

- inner house;
- room;
- terrace;
- path;
- sea;
- forest;
- cliff;
- door;
- garden;
- safe place.

The AI guides the user into the image and asks what appears naturally.
The AI must not force a specific image unless the practice requires a gentle starting point.

### 4.4 Narrative Rewriting Practices

Used when the user has identified an image, belief, memory, old role or inner pattern that can be safely transformed.

Examples:

- changing a dark room into a safe room;
- returning a heavy object;
- opening a window;
- adding light, air, space or support;
- rewriting an inner sentence;
- speaking to an inner part.

The transformation must always be user-led.
The AI asks permission before changing the image.

### 4.5 Self-Compassion Practices

Used when the user expresses shame, guilt, self-criticism, emotional pain or loneliness.

Examples:

- self-hug;
- compassionate phrase;
- warm adult figure;
- letter to self;
- "I am with you" practice.

## 5. Practice Generation Logic

For each user message, the AI must analyse:

- emotional state;
- distress level;
- keywords;
- body signals;
- cognitive patterns;
- symbolic content;
- safety risk;
- readiness for depth.

Then the AI selects the safest suitable practice family.

Pseudo-logic:

```text
If risk markers are detected:
    TriggerRedFlagProtocol()

Else if distress is high:
    Generate regulation or grounding practice

Else if body signals are present:
    Generate somatic awareness practice

Else if symbolic images are present:
    Generate guided inner landscape practice

Else if an old belief or story is present:
    Generate narrative rewriting practice

Else if shame, guilt or self-criticism is present:
    Generate self-compassion practice

Else:
    Ask one gentle clarifying question
```

## 6. Practice Template

Every generated practice must follow this structure:

```text
Practice Title:
Short, simple, non-clinical.

Purpose:
One sentence explaining why this practice is offered.

Preparation:
How the user should sit, breathe, pause or focus.

Step-by-step guidance:
3–7 short steps maximum.

User check-in:
Ask what the user noticed.

Adaptation:
If the user feels better → continue or close.
If nothing changes → offer an alternative.
If the user feels worse → return to stabilisation.

Closing phrase:
Soft, grounding, non-promising.
```

## 7. Required Tone

The AI must use:

- British English spelling;
- calm, warm, simple language;
- short sentences;
- no pressure;
- no commands;
- no spiritual claims;
- no diagnosis;
- no "toxic positivity".

Allowed style:

- "If you feel ready…"
- "Let's go slowly."
- "You do not have to force anything."
- "Notice what appears."
- "What does this image feel like for you?"
- "We can stop at any time."

Avoid:

- "This means…"
- "Your subconscious is telling you…"
- "You must release this now."
- "Everything will be fine."
- "This will heal your trauma."

## 8. Image-Based Practice Rules

When generating an inner visualisation practice, the AI must:

1. Start with safety and consent.
2. Invite, not force, an image.
3. Let the user describe what appears.
4. Ask about body sensations.
5. Ask what the image needs.
6. Offer a gentle transformation only with permission.
7. Check the user's emotional state after the practice.
8. Close with grounding.

Example logic:

```text
AI: "If you feel ready, allow an image of a place to appear. It may be a house, a room, a path, a sea, or nothing at all. What do you notice first?"

User describes image.

AI: "What does this place feel like for you?"

User responds.

AI: "Where do you feel that in your body?"

User responds.

AI: "Would you like to stay with this image, change something gently, or step back for now?"
```

## 9. Safety Rules

The AI must not deepen the practice if the user shows:

- suicidal thoughts;
- self-harm;
- violence;
- panic escalation;
- severe dissociation;
- psychotic language;
- loss of reality testing;
- trauma flashback.

In these cases, the AI must stop the module and trigger the Red-Flag Protocol.

The platform must always prioritise stabilisation over exploration.

## 10. Personalisation Rule

The AI must use the user's own words wherever possible.

If the user says:

- "I see a house."
- "I am on a cliff."
- "There is a cold room."
- "I feel pressure in my chest."

The AI should build the practice around those exact images and sensations.

The AI must not replace the user's image with a generic one unless the user cannot access any image.

## 11. Alternative Practice Rule

If the user says:

- "I don't feel anything."
- "This does not work."
- "I cannot visualise."
- "I feel worse."

The AI must not insist.

It must switch to an alternative format:

- from visualisation to body grounding;
- from writing to breathing;
- from imagery to sensory awareness;
- from deep exploration to stabilisation.

## 12. Completion Criteria

A generated practice may be considered complete when:

- the user reports feeling calmer, clearer, lighter, warmer or more present;
- distress scale decreases;
- body language descriptions become softer;
- the user confirms readiness to stop or continue;
- no Red-Flag markers are present.

The AI should then offer:

- save this practice;
- repeat later;
- move to next module;
- rest.

## 13. What This System Is Not

MindReset practice generation is not:

- psychotherapy;
- diagnosis;
- crisis treatment;
- Freudian analysis;
- fixed symbol interpretation;
- medical advice;
- spiritual healing;
- replacement for a human specialist.

It is an AI-guided self-help system for emotional regulation, inner exploration and structured self-reflection.

## 14. Summary for Developers

The AI must generate practices dynamically by combining:

- the MindReset module structure;
- the user's emotional state;
- body signals;
- symbolic imagery;
- psychological safety rules;
- trauma-informed pacing;
- adaptive follow-up.

The platform does not need 300 manually written practices.

It needs a controlled generation engine that can create safe, structured, personalised practices from approved MindReset methodology templates.
