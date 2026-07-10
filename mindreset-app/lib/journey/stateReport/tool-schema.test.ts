// Schema-equivalence tests for the strict `emit_state_report` tool.
//
// PR η Step 1 (2026-07-10). Proves the tool schema definition accepts/rejects
// the same values the current text-based parser accepts. If any of these
// fail, the migration would silently break existing clinical validation
// semantics — so this file is the guardrail for the whole architectural
// move.
//
// These tests are declarative property assertions on the schema object
// itself (not on runtime behavior against Anthropic). They prove:
//   - Field parity with StateReport
//   - Enum parity with the source-of-truth constants in ./schema.ts
//   - Required-set matches the router's real needs
//   - Nested object shapes match the parser's per-object contracts
//   - additionalProperties: false everywhere (no prompt drift)

import { describe, expect, it } from 'vitest';
import {
  REQUIRED_FIELDS,
  stateReportInputSchema,
  emitStateReportToolDef,
} from './tool-schema';
import {
  CANONICAL_MOVES,
  THERAPEUTIC_MODES,
  MODALITIES_REJECTED,
  CYCLE_STATUSES,
  NEXT_BEST_MODES,
} from './schema';

// Type-narrowing helper: give the schema an inspectable shape for tests
// without fighting the deep-const inference.
const schema = stateReportInputSchema as unknown as {
  type: 'object';
  properties: Record<string, any>;
  required: readonly string[];
  additionalProperties: boolean;
};

describe('emit_state_report tool — top-level shape', () => {
  it('is an object schema', () => {
    expect(schema.type).toBe('object');
  });

  it('rejects unknown fields (additionalProperties: false)', () => {
    expect(schema.additionalProperties).toBe(false);
  });

  it('declares the six required-every-turn fields', () => {
    expect([...schema.required].sort()).toEqual(
      [
        'channel',
        'clinicalRead',
        'intensity',
        'moveJustPerformed',
        'recommendedAction',
        'safetyFlag',
      ].sort(),
    );
  });

  it('exports REQUIRED_FIELDS as the same list', () => {
    expect([...REQUIRED_FIELDS].sort()).toEqual([...schema.required].sort());
  });
});

describe('emit_state_report tool — the three safety-critical required fields', () => {
  it('intensity is an integer (0..10 enforced by the reader, not the schema)', () => {
    // Anthropic strict tool use rejects minimum/maximum on integer types
    // (confirmed by live smoke test 2026-07-10 with request_id
    // req_011CctPR5V1jDGf4WztsKjJV). The range is enforced by the
    // tool-reader via Math.max/Math.min clamping, and communicated to
    // the model via the schema description.
    const s = schema.properties.intensity;
    expect(s.type).toBe('integer');
    expect(s.minimum).toBeUndefined();
    expect(s.maximum).toBeUndefined();
    expect(typeof s.description).toBe('string');
    expect(s.description).toContain('0');
    expect(s.description).toContain('10');
  });

  it('safetyFlag enum matches parser exactly', () => {
    expect(schema.properties.safetyFlag.enum).toEqual([
      'none',
      'watch',
      'red_flag',
    ]);
  });

  it('recommendedAction enum matches parser exactly', () => {
    expect(schema.properties.recommendedAction.enum).toEqual([
      'stay',
      'advance',
      'regress_to_grounding',
      'regress_to_parts',
      'red_flag',
      'discharge',
    ]);
  });
});

describe('emit_state_report tool — PR γ required-on-substantive-turn fields', () => {
  it('channel enum matches parser exactly (all 6 values)', () => {
    expect(schema.properties.channel.enum).toEqual([
      'visual',
      'kinesthetic',
      'emotional',
      'cognitive',
      'verbal',
      'mixed',
    ]);
  });

  it('clinicalRead is a string (non-empty enforced by reader, not schema)', () => {
    // Anthropic strict tool use rejects string length constraints
    // (minLength/maxLength). The reader treats empty strings as absent
    // via the copyIf-string pattern.
    const s = schema.properties.clinicalRead;
    expect(s.type).toBe('string');
    expect(s.minLength).toBeUndefined();
    expect(s.maxLength).toBeUndefined();
  });

  it('moveJustPerformed is an array of canonical move IDs — enum equal to source-of-truth (1..3 cap enforced by reader, not schema)', () => {
    // Anthropic strict tool use rejects minItems/maxItems on arrays. The
    // reader caps at 3 via .slice(0, 3) and collapses `[universal.none,
    // X, ...]` to `[universal.none]`.
    const s = schema.properties.moveJustPerformed;
    expect(s.type).toBe('array');
    expect(s.minItems).toBeUndefined();
    expect(s.maxItems).toBeUndefined();
    expect(s.items.type).toBe('string');
    // Enum equality against the CANONICAL_MOVES source of truth — if any
    // stage moves are added/removed there, this test fails until the
    // schema is updated.
    expect([...s.items.enum].sort()).toEqual([...CANONICAL_MOVES].sort());
  });

  it('moveJustPerformed enum includes universal.none for light turns', () => {
    expect(schema.properties.moveJustPerformed.items.enum).toContain(
      'universal.none',
    );
  });
});

describe('emit_state_report tool — Therapeutic Sensitivity Layer enums', () => {
  it('therapeuticMode enum equals the source-of-truth', () => {
    expect([...schema.properties.therapeuticMode.enum].sort()).toEqual(
      [...THERAPEUTIC_MODES].sort(),
    );
  });

  it('modalityRejected items enum equals the source-of-truth', () => {
    expect([...schema.properties.modalityRejected.items.enum].sort()).toEqual(
      [...MODALITIES_REJECTED].sort(),
    );
  });

  it('cycleStatus enum equals the source-of-truth', () => {
    expect([...schema.properties.cycleStatus.enum].sort()).toEqual(
      [...CYCLE_STATUSES].sort(),
    );
  });

  it('nextBestMode enum equals the source-of-truth', () => {
    expect([...schema.properties.nextBestMode.enum].sort()).toEqual(
      [...NEXT_BEST_MODES].sort(),
    );
  });

  it('channelShiftDetected + cycleCanClose are booleans', () => {
    expect(schema.properties.channelShiftDetected.type).toBe('boolean');
    expect(schema.properties.cycleCanClose.type).toBe('boolean');
  });
});

describe('emit_state_report tool — practiceRun nested shape', () => {
  const pr = () => schema.properties.practiceRun;

  it('is an object with additionalProperties: false', () => {
    expect(pr().type).toBe('object');
    expect(pr().additionalProperties).toBe(false);
  });

  it('requires kind + status (matches parser: both must be present or parser drops)', () => {
    expect([...pr().required].sort()).toEqual(['kind', 'status']);
  });

  it('kind enum matches parser: canonical | generated | none', () => {
    expect(pr().properties.kind.enum).toEqual([
      'canonical',
      'generated',
      'none',
    ]);
  });

  it('family enum includes all five practice families + none', () => {
    expect(pr().properties.family.enum).toEqual([
      'regulation',
      'somatic',
      'landscape',
      'narrative',
      'compassion',
      'none',
    ]);
  });

  it('status enum matches parser exactly', () => {
    expect(pr().properties.status.enum).toEqual([
      'started',
      'mid',
      'completed',
      'aborted_user_request',
      'aborted_overwhelm',
    ]);
  });

  it('depth enum matches parser: surface | middle | deep', () => {
    expect(pr().properties.depth.enum).toEqual(['surface', 'middle', 'deep']);
  });

  it('modalitySwitched requires both from AND to (matches parser expectation)', () => {
    const m = pr().properties.modalitySwitched;
    expect(m.type).toBe('object');
    expect([...m.required].sort()).toEqual(['from', 'to']);
    expect(m.additionalProperties).toBe(false);
  });
});

describe('emit_state_report tool — patternsTouched nested shape', () => {
  const pt = () => schema.properties.patternsTouched;

  it('is an array of objects with category + description required', () => {
    expect(pt().type).toBe('array');
    expect(pt().items.type).toBe('object');
    expect([...pt().items.required].sort()).toEqual(['category', 'description']);
    expect(pt().items.additionalProperties).toBe(false);
  });

  it('does NOT expose the free-form context field (strict tool use rejects open-shape objects)', () => {
    // Anthropic strict tool use rejects any object schema without
    // `additionalProperties: false`, which conflicts with the pre-PR-η
    // parser's Record<string, unknown> context field. Reader still copies
    // context through defensively for old DB rows.
    expect(pt().items.properties.context).toBeUndefined();
  });
});

describe('emit_state_report tool — partsTouched / foreignFilesTouched nested', () => {
  it('partsTouched items require description; channel + safeDistance optional', () => {
    const p = schema.properties.partsTouched;
    expect(p.type).toBe('array');
    expect([...p.items.required]).toEqual(['description']);
    expect(p.items.additionalProperties).toBe(false);
    // channel enum matches CHANNELS
    expect(p.items.properties.channel.enum).toEqual([
      'visual',
      'kinesthetic',
      'emotional',
      'cognitive',
      'verbal',
      'mixed',
    ]);
  });

  it('foreignFilesTouched items require description', () => {
    const f = schema.properties.foreignFilesTouched;
    expect(f.type).toBe('array');
    expect([...f.items.required]).toEqual(['description']);
    expect(f.items.additionalProperties).toBe(false);
  });
});

describe('emit_state_report tool — stability + landscape update shapes', () => {
  it('stabilityCheck requires integer score (1..10 enforced by reader, not schema)', () => {
    // Anthropic strict tool use rejects integer minimum/maximum. Reader
    // clamps the score to [1, 10].
    const s = schema.properties.stabilityCheck;
    expect(s.type).toBe('object');
    expect([...s.required]).toEqual(['score']);
    expect(s.properties.score.type).toBe('integer');
    expect(s.properties.score.minimum).toBeUndefined();
    expect(s.properties.score.maximum).toBeUndefined();
    expect(s.additionalProperties).toBe(false);
  });

  it('partSecured requires partDescription (matches parser drop condition)', () => {
    const ps = schema.properties.partSecured;
    expect([...ps.required]).toEqual(['partDescription']);
    expect(ps.additionalProperties).toBe(false);
  });

  it('foreignFileReleased requires description (matches parser drop condition)', () => {
    const ff = schema.properties.foreignFileReleased;
    expect([...ff.required]).toEqual(['description']);
    expect(ff.additionalProperties).toBe(false);
  });
});

describe('emit_state_report tool — stage-specific enum shapes', () => {
  it('compassionBridgeQuality enum matches parser', () => {
    expect(schema.properties.compassionBridgeQuality.enum).toEqual([
      'compassion',
      'curiosity',
      'acceptance',
      'willingness_to_comfort',
    ]);
  });

  it('mii6Check enum matches parser', () => {
    expect(schema.properties.mii6Check.enum).toEqual([
      'stable',
      'destabilised',
      'unsure',
      'destabilised_then_recovered',
    ]);
  });

  it('urgencyMarkers enum matches parser', () => {
    expect(schema.properties.urgencyMarkers.enum).toEqual([
      'present',
      'absent',
    ]);
  });

  it('dischargeReadiness enum matches parser', () => {
    expect(schema.properties.dischargeReadiness.enum).toEqual([
      'not_ready',
      'maybe',
      'ready',
    ]);
  });

  it('calLayer accepts integer 1, 2, or 3', () => {
    expect(schema.properties.calLayer.type).toBe('integer');
    expect(schema.properties.calLayer.enum).toEqual([1, 2, 3]);
  });

  it('userReportedRedirection accepts boolean OR "partial" (anyOf)', () => {
    const s = schema.properties.userReportedRedirection;
    expect(Array.isArray(s.anyOf)).toBe(true);
    // boolean variant present
    expect(s.anyOf.some((v: any) => v.type === 'boolean')).toBe(true);
    // "partial" string variant present
    expect(
      s.anyOf.some(
        (v: any) =>
          v.type === 'string' &&
          Array.isArray(v.enum) &&
          v.enum.includes('partial'),
      ),
    ).toBe(true);
  });

  it('redFlagType uses the exact underscore-suffixed strings the safety code matches on', () => {
    // Regression guard for the audit finding: "panic" / "dissociation" /
    // "flashback" bare strings would silently lose the freeze reason.
    expect(schema.properties.redFlagType.enum).toEqual([
      'suicidal',
      'self-harm',
      'panic_severe',
      'dissociation_severe',
      'psychosis',
      'flashback_in_progress',
      'violence',
    ]);
  });
});

describe('emit_state_report tool — field completeness vs StateReport type', () => {
  // These tests would fail if a StateReport field were added later and this
  // schema wasn't updated. The list is derived from the parser's copy list.
  const EXPECTED_FIELDS = [
    // required-6
    'intensity',
    'safetyFlag',
    'recommendedAction',
    'channel',
    'clinicalRead',
    'moveJustPerformed',
    // universal
    'adultSelfPresent',
    'readinessTouched',
    'redFlagType',
    // practice + landscape
    'practiceRun',
    'userImagesCaptured',
    'partsTouched',
    'foreignFilesTouched',
    'patternsTouched',
    'partSecured',
    'foreignFileReleased',
    // stage 1
    'anchorIdentified',
    // stage 3
    'identityAnchor',
    'observerSeatTouched',
    'adultSelfQualities',
    'adultSelfAnchorLinked',
    'heldEmotionInAdultSelf',
    // stage 4
    'compassionBridgeQuality',
    'bridgeAchievedAt',
    'userGrounded',
    'cohesionAwareness',
    'mii6Check',
    // stage 5
    'originIdentified',
    'somaticRelease',
    'bodyConfirmation',
    'cleanIdentityStatement',
    'whatStaysAsMine',
    // stage 6
    'internalConsensus',
    'selfLoyaltyStatement',
    'oneSmallAction',
    // stage 7
    'symbolicIdentityMap',
    'emergingQualities',
    'innerDirection',
    'urgencyMarkers',
    'safetyReorientation',
    // stage 8
    'calRunOn',
    'calLayer',
    'userReportedRedirection',
    'adultSelfThisWeek',
    'feltAligned',
    'feltOld',
    'dischargeReadiness',
    // stability
    'stabilityCheck',
    // sensitivity layer
    'therapeuticMode',
    'channelShiftDetected',
    'modalityRejected',
    'cycleStatus',
    'cycleCanClose',
    'nextBestMode',
    // continuity
    'continuityNote',
  ];

  it('every StateReport field the parser reads is in the schema properties', () => {
    const schemaFields = Object.keys(schema.properties).sort();
    const expected = [...EXPECTED_FIELDS].sort();
    // Compute a symmetric-difference so failure messages are useful.
    const missingFromSchema = expected.filter(
      (f) => !schemaFields.includes(f),
    );
    const extraInSchema = schemaFields.filter(
      (f) => !expected.includes(f),
    );
    expect({ missingFromSchema, extraInSchema }).toEqual({
      missingFromSchema: [],
      extraInSchema: [],
    });
  });
});

describe('emit_state_report tool — Anthropic tool wrapper', () => {
  it('has the expected tool name', () => {
    expect(emitStateReportToolDef.name).toBe('emit_state_report');
  });

  it('has a non-empty description (the model reads it)', () => {
    expect(emitStateReportToolDef.description).toBeTruthy();
    expect(emitStateReportToolDef.description!.length).toBeGreaterThan(60);
  });

  it('does NOT set strict: true (Option B.1 — schema exceeds 24-optional-param strict limit)', () => {
    // Anthropic strict tool use caps optional parameters across the
    // schema at 24 total (confirmed at request_id req_011CctSbKN4mFSB8yw814g2H:
    // "Schemas contains too many optional parameters (63)…"). Our schema
    // has ~63 optional params. Option B.1 keeps the schema rich as
    // documentation to the model; the tool call is still guaranteed via
    // forced tool_choice at the caller side, and the tool-reader
    // defensively validates + normalises the input.
    expect((emitStateReportToolDef as any).strict).toBeUndefined();
  });

  it('input_schema references the exported schema object', () => {
    expect(emitStateReportToolDef.input_schema).toBe(
      stateReportInputSchema as any,
    );
  });
});
