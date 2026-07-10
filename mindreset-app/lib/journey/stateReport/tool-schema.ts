// The strict Anthropic tool definition for state-report emission.
//
// PR η (2026-07-10) — architectural fix following the root-cause audit.
// Prior architecture: the model wrote free-form JSON inside
// `<state-report>...</state-report>` tags at the end of a streaming reply.
// When the model ran out of `max_tokens`, the JSON silently truncated;
// required fields were dropped under attention pressure; the model reached
// for `<thinking>` tags for reasoning because it had no sanctioned channel.
//
// This file defines a strict tool the model MUST invoke. Anthropic's
// grammar-constrained sampling then makes required-field omission
// structurally impossible — the model literally cannot skip them. All the
// prompt-engineering-around-emission goes away.
//
// Companion files:
//   - tool-reader.ts    — reads the tool_use block's input and produces
//                         the same StateReport shape the current parser does
//   - tool-schema.test.ts — proves schema shape matches what the parser accepts
//   - tool-reader.test.ts — proves parity of output between paths
//
// The schema is a JSON Schema literal (not a Zod schema) because that's what
// Anthropic's tool-use API accepts on `input_schema`. Enum arrays are pulled
// verbatim from `./schema.ts` so a rename there flows to a compile error
// here — single source of truth.

import type Anthropic from '@anthropic-ai/sdk';
import {
  CANONICAL_MOVES,
  THERAPEUTIC_MODES,
  MODALITIES_REJECTED,
  CYCLE_STATUSES,
  NEXT_BEST_MODES,
} from './schema';

// Enums the parser accepts today. Kept as `readonly [...]` literals so JSON
// Schema `enum` fields get precise types.
const CHANNELS = [
  'visual',
  'kinesthetic',
  'emotional',
  'cognitive',
  'verbal',
  'mixed',
] as const;
const SAFETY_FLAGS = ['none', 'watch', 'red_flag'] as const;
const RECOMMENDED_ACTIONS = [
  'stay',
  'advance',
  'regress_to_grounding',
  'regress_to_parts',
  'red_flag',
  'discharge',
] as const;
const DEPTHS = ['surface', 'middle', 'deep'] as const;
const BRIDGE_QUALITIES = [
  'compassion',
  'curiosity',
  'acceptance',
  'willingness_to_comfort',
] as const;
const MII6_CHECKS = [
  'stable',
  'destabilised',
  'unsure',
  'destabilised_then_recovered',
] as const;
const PRACTICE_FAMILIES = [
  'regulation',
  'somatic',
  'landscape',
  'narrative',
  'compassion',
  'none',
] as const;
const PRACTICE_KINDS = ['canonical', 'generated', 'none'] as const;
const PRACTICE_STATUSES = [
  'started',
  'mid',
  'completed',
  'aborted_user_request',
  'aborted_overwhelm',
] as const;
const RED_FLAG_TYPES = [
  'suicidal',
  'self-harm',
  'panic_severe',
  'dissociation_severe',
  'psychosis',
  'flashback_in_progress',
  'violence',
] as const;
const DISCHARGE_READINESS = ['not_ready', 'maybe', 'ready'] as const;
const URGENCY_MARKERS = ['present', 'absent'] as const;

// Fields the model MUST emit on every turn. Deliberately more than the
// old parser's REQUIRED-3 — the whole point of moving to strict tool use
// is that the router can rely on these being present. On light turns the
// model uses `universal.none` / `mixed` / a brief clinicalRead.
export const REQUIRED_FIELDS = [
  'intensity',
  'safetyFlag',
  'recommendedAction',
  'channel',
  'clinicalRead',
  'moveJustPerformed',
] as const;

// The JSON Schema for the `emit_state_report` tool's input. Passed to
// Anthropic as `input_schema` on the tool definition. `additionalProperties:
// false` at every object level so the model cannot invent fields — kills
// prompt drift where a new capture appears in prompt copy but not here.
export const stateReportInputSchema = {
  type: 'object',
  properties: {
    // -----------------------------------------------------------------
    // Required on every turn
    // -----------------------------------------------------------------
    intensity: {
      type: 'integer',
      // Anthropic strict tool use does NOT accept minimum/maximum on
      // integer types (API rejects with invalid_request_error). The
      // reader (tool-reader.ts) clamps the value to [0, 10] after read.
      // Describe the range in the description so the model still emits
      // in-range values.
      description:
        "Your clinical read of the user's distress right now, integer 0–10 (values outside this range will be clamped).",
    },
    safetyFlag: {
      type: 'string',
      enum: [...SAFETY_FLAGS],
      description:
        '"none" if fine, "watch" if anything concerns you, "red_flag" only if Shared Core §7 triggers apply.',
    },
    recommendedAction: {
      type: 'string',
      enum: [...RECOMMENDED_ACTIONS],
      description:
        'Advisory only; the router decides the final action. Default "stay".',
    },
    channel: {
      type: 'string',
      enum: [...CHANNELS],
      description:
        "The register the user is in this turn. Pick 'mixed' if genuinely complex; do not leave blank.",
    },
    clinicalRead: {
      type: 'string',
      // No minLength (strict tool use rejects string length constraints).
      // The reader drops empty strings; the description conveys intent.
      description:
        "One or two sentences of your working clinical read. Internal — never surfaced to the user. Must be non-empty on substantive turns.",
    },
    moveJustPerformed: {
      type: 'array',
      // No minItems / maxItems (strict tool use rejects these). The
      // reader caps at 3 and collapses `[universal.none, X, ...]` →
      // `[universal.none]`. The description communicates the 1..3 bound.
      items: {
        type: 'string',
        enum: [...CANONICAL_MOVES],
      },
      description:
        'The canonical clinical move(s) you performed this turn — 1 to 3 IDs, primary first. If truly nothing clinical happened, use ["universal.none"] alone.',
    },

    // -----------------------------------------------------------------
    // Universal operational fields (optional)
    // -----------------------------------------------------------------
    adultSelfPresent: {
      type: 'boolean',
      description:
        'True when the user is in observer position or speaking from steady adult.',
    },
    readinessTouched: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Gate tokens: emotion_named, body_located, orientation_present, anchor_identified, pain_named, alliance_formed, observer_seat_touched, adult_self_present, foreign_file_identified, foreign_file_released, formulation_confirmed.',
    },
    redFlagType: {
      type: 'string',
      enum: [...RED_FLAG_TYPES],
      description:
        'Set ONLY when safetyFlag is "red_flag". Exact strings (_severe / _in_progress suffixes required).',
    },

    // -----------------------------------------------------------------
    // Practice tracking
    // -----------------------------------------------------------------
    practiceRun: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: [...PRACTICE_KINDS] },
        name: { type: 'string' },
        family: { type: 'string', enum: [...PRACTICE_FAMILIES] },
        triggeredBy: { type: 'string' },
        userImages: { type: 'string' },
        depth: { type: 'string', enum: [...DEPTHS] },
        status: { type: 'string', enum: [...PRACTICE_STATUSES] },
        modalitySwitched: {
          type: 'object',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
          },
          required: ['from', 'to'],
          additionalProperties: false,
        },
      },
      required: ['kind', 'status'],
      additionalProperties: false,
      description:
        'Set ONLY when you actually ran (or attempted) a practice this turn.',
    },

    // -----------------------------------------------------------------
    // Landscape additions
    // -----------------------------------------------------------------
    userImagesCaptured: {
      type: 'array',
      items: { type: 'string' },
    },
    partsTouched: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          channel: { type: 'string', enum: [...CHANNELS] },
          safeDistance: { type: 'string' },
        },
        required: ['description'],
        additionalProperties: false,
      },
    },
    foreignFilesTouched: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
        },
        required: ['description'],
        additionalProperties: false,
      },
    },
    patternsTouched: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          description: { type: 'string' },
          // NOTE: pre-PR-η the parser accepted an optional free-form
          // `context: Record<string, unknown>` here for extras like
          // {trigger: "friend_not_testing_app", ageTag: 9}. Strict tool use
          // rejects open-shape object schemas (every object requires
          // additionalProperties: false), and we don't want to enumerate
          // every possible context key at the tool layer. The tool-reader
          // still copies `context` through defensively if it appears — so
          // old DB rows with context still decode correctly — but the
          // model can't emit it via a tool call. If typed context becomes
          // useful we'll add specific fields (context_trigger,
          // context_age_tag, ...) with proper types.
        },
        required: ['category', 'description'],
        additionalProperties: false,
      },
      description:
        'Working notes on unresolved patterns — never diagnosis. category is a snake_case identifier YOU invent (e.g. "mother_voice", "money_shame"). description is the user\'s exact words.',
    },

    // -----------------------------------------------------------------
    // Landscape updates (mutate rather than insert)
    // -----------------------------------------------------------------
    partSecured: {
      type: 'object',
      properties: {
        partDescription: { type: 'string' },
        restingPlace: { type: 'string' },
        adultSelfOffering: { type: 'string' },
      },
      required: ['partDescription'],
      additionalProperties: false,
    },
    foreignFileReleased: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        returnedTo: { type: 'string' },
        honouringPhrase: { type: 'string' },
        whatStaysAsMine: { type: 'string' },
      },
      required: ['description'],
      additionalProperties: false,
    },

    // -----------------------------------------------------------------
    // Stage-specific captures
    // -----------------------------------------------------------------
    anchorIdentified: { type: 'string' },
    identityAnchor: { type: 'string' },
    observerSeatTouched: { type: 'boolean' },
    adultSelfQualities: { type: 'string' },
    adultSelfAnchorLinked: { type: 'boolean' },
    heldEmotionInAdultSelf: { type: 'boolean' },
    compassionBridgeQuality: {
      type: 'string',
      enum: [...BRIDGE_QUALITIES],
    },
    bridgeAchievedAt: { type: 'string' },
    userGrounded: { type: 'boolean' },
    cohesionAwareness: { type: 'string' },
    mii6Check: {
      type: 'string',
      enum: [...MII6_CHECKS],
    },
    originIdentified: { type: 'string' },
    somaticRelease: { type: 'boolean' },
    bodyConfirmation: { type: 'string' },
    internalConsensus: { type: 'boolean' },
    selfLoyaltyStatement: { type: 'string' },
    oneSmallAction: { type: 'string' },
    cleanIdentityStatement: { type: 'string' },
    whatStaysAsMine: { type: 'string' },
    symbolicIdentityMap: { type: 'string' },
    emergingQualities: { type: 'array', items: { type: 'string' } },
    innerDirection: { type: 'string' },
    urgencyMarkers: { type: 'string', enum: [...URGENCY_MARKERS] },
    safetyReorientation: { type: 'boolean' },
    calRunOn: { type: 'string' },
    calLayer: { type: 'integer', enum: [1, 2, 3] },
    userReportedRedirection: {
      // JSON Schema doesn't allow mixed-type enums cleanly; parser accepts
      // bool | "partial". Represent as anyOf so the model can emit either.
      anyOf: [
        { type: 'boolean' },
        { type: 'string', enum: ['partial'] },
      ],
    },
    adultSelfThisWeek: { type: 'string' },
    feltAligned: { type: 'array', items: { type: 'string' } },
    feltOld: { type: 'array', items: { type: 'string' } },
    dischargeReadiness: {
      type: 'string',
      enum: [...DISCHARGE_READINESS],
    },

    // -----------------------------------------------------------------
    // Stability
    // -----------------------------------------------------------------
    stabilityCheck: {
      type: 'object',
      properties: {
        // No minimum/maximum on score (strict tool use rejects). Reader
        // clamps to [1, 10]. Description conveys the range.
        score: {
          type: 'integer',
          description:
            "User's stability, 1 (overwhelmed) to 10 (fully grounded). Values outside will be clamped.",
        },
        contextNote: { type: 'string' },
      },
      required: ['score'],
      additionalProperties: false,
      description:
        'Emit ONLY when you explicitly asked the user the 1-10 stability question this turn.',
    },

    // -----------------------------------------------------------------
    // Therapeutic Sensitivity Layer
    // -----------------------------------------------------------------
    therapeuticMode: {
      type: 'string',
      enum: [...THERAPEUTIC_MODES],
    },
    channelShiftDetected: { type: 'boolean' },
    modalityRejected: {
      type: 'array',
      items: { type: 'string', enum: [...MODALITIES_REJECTED] },
    },
    cycleStatus: {
      type: 'string',
      enum: [...CYCLE_STATUSES],
    },
    cycleCanClose: { type: 'boolean' },
    nextBestMode: {
      type: 'string',
      enum: [...NEXT_BEST_MODES],
    },

    // -----------------------------------------------------------------
    // Continuity
    // -----------------------------------------------------------------
    continuityNote: {
      type: 'string',
      description:
        'Your running case formulation across sessions. Read the existing one; revise additively when new strategic signal has landed; omit if nothing to update.',
    },
  },
  required: [...REQUIRED_FIELDS],
  additionalProperties: false,
} as const;

// The full Anthropic Tool definition. `strict: true` invokes grammar-
// constrained sampling — required fields cannot be omitted, enum values
// cannot be violated, `additionalProperties: false` cannot be sidestepped.
export const emitStateReportToolDef: Anthropic.Tool & { strict?: boolean } = {
  name: 'emit_state_report',
  description:
    "Emit the hidden state report for this turn. Called EVERY turn, once, after (or alongside) your warm human reply. This is how the code sees what you observed and what you did. The user never sees this. Fields marked required MUST be populated on every turn; on light turns (a bare 'hi' / 'ok' / 'yes'), use ['universal.none'] for moveJustPerformed, 'mixed' for channel, and a brief clinicalRead like 'brief opener, no clinical content this turn'.",
  input_schema: stateReportInputSchema as unknown as Anthropic.Tool['input_schema'],
  strict: true,
};
