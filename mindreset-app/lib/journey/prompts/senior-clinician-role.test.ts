// Regression guard for the Senior Clinical Psychologist role block
// (2026-07-28, owner-directed integration).
//
// The role block establishes one coherent senior-clinician identity,
// professional stance, integrated competency model, and clinical
// decision-making framework. It lives in Shared Core §1 (the canon layer,
// loaded first and cached for every Journey turn; per the canon header it
// takes precedence on clinical content). The master prompt's Governing
// principle references it so the operational rules are applied from within
// the role.
//
// These tests assert RUNTIME INCLUSION — the block must be present in the
// output of the actual loaders and in the assembled system-prompt blocks,
// not merely in a repository file. Behavioural scenarios A–H live in
// docs/journey/qa/senior-clinician-behavioural-tests.md (live-model QA;
// requires ANTHROPIC_API_KEY, not runnable in CI).

import { describe, expect, it } from 'vitest';
import { assembleSystemPromptBlocks } from './assemble';
import { sharedCore, loadMasterJourneyPrompt } from './load-spec';
import type { JourneyState } from '../state/types';

function makeState(stage: number): JourneyState {
  return {
    userId: 'user_role_block_test',
    currentStage: stage,
    currentDepth: 'surface',
    startedAt: new Date('2026-07-01'),
    lastActivityAt: new Date('2026-07-28'),
    dischargedAt: null,
    anchorText: null,
    anchorSetAt: null,
    identityAnchor: null,
    identityAnchorSetAt: null,
    processingChannel: null,
    adultSelfQualities: null,
    lastIntensity: null,
    lastIntensityAt: null,
    lastDeepLayerContactAt: null,
    mii: {},
    stage8WeeksElapsed: 0,
    frozenForReview: false,
    frozenAt: null,
    frozenReason: null,
    continuityNote: null,
    parts: [],
    foreignFiles: [],
    signatureImages: [],
    patterns: [],
    sessionCount: 0,
    daysEngaged: 0,
    thisSessionMessageCount: 0,
    stageJustAdvanced: false,
    hoursSinceLastTurn: null,
    isSessionResume: false,
    hasOpenCycle: false,
    openCycleDescription: null,
    sessionRejectedModalities: [],
    recentChannelShift: false,
    taskContract: null,
    onboardingAnswers: null,
  };
}

const core = sharedCore();
const canonBlock = assembleSystemPromptBlocks(makeState(1))[0].text;

describe('senior clinician role — present in the runtime canon', () => {
  it('the role block is in sharedCore() loader output', () => {
    expect(core).toContain(
      'Senior clinical psychologist — professional role and clinical stance',
    );
    expect(core).toContain(
      'professional judgement, depth of understanding, reflective capacity, and adaptive reasoning expected of an experienced senior clinical psychologist',
    );
  });

  it('the role block reaches the assembled system prompt (canon block, before the master)', () => {
    expect(canonBlock).toContain(
      'Senior clinical psychologist — professional role and clinical stance',
    );
    // It must appear before the operational layer boundary.
    const roleIdx = canonBlock.indexOf('Senior clinical psychologist — professional role');
    const stageSpecsIdx = canonBlock.indexOf('## ALL 8 STAGE SPECS');
    expect(roleIdx).toBeGreaterThan(-1);
    expect(stageSpecsIdx).toBeGreaterThan(roleIdx);
  });
});

describe('senior clinician role — identity safety and precedence', () => {
  it('explicitly disclaims human/licensed/registered professional status', () => {
    expect(core).toContain(
      'not a claim to be a human, licensed, or registered professional',
    );
    expect(core).toContain('never therapy, diagnosis, or medical care');
  });

  it('defers user-facing identity to the nameless guide of §1 (no competing identity)', () => {
    expect(core).toContain('to the user you remain the nameless guide described above');
    // The original §1 identity must still be present and unchanged.
    expect(core).toContain(
      'The AI is a clinical support guide trained in the MindReset method.',
    );
  });

  it('subordinates the stance to §4 prohibitions, §7 red flag, and operational gates', () => {
    expect(core).toContain(
      'The Universal Prohibitions (§4) and the Red Flag Protocol (§7) always take precedence over this stance',
    );
    expect(core).toContain('it never licenses you to skip them');
  });

  it('does not name trauma exploration as an assumed available channel', () => {
    // The method is non-regressive; the proposed block's channel list was
    // revised to drop "trauma exploration" (documented revision R2).
    expect(core).not.toContain('trauma exploration');
  });
});

describe('senior clinician role — core content integrated intact', () => {
  it('carries the integrated process line', () => {
    expect(core).toContain(
      'assessment → formulation → collaborative understanding → intervention → review',
    );
  });

  it('carries the evidence/inference/uncertainty distinction', () => {
    expect(core).toContain('what the user has directly communicated');
    expect(core).toContain('what you are reasonably inferring');
    expect(core).toContain('what alternative explanations may still be possible');
  });

  it('carries the differential-reasoning distinctions (temporary vs enduring, maintaining vs historical)', () => {
    expect(core).toContain('Distinguish temporary reactions from enduring patterns');
    expect(core).toContain('current maintaining processes from historical origins');
  });

  it('permits support/practical responses and “no deeper intervention”', () => {
    expect(core).toContain(
      'Supportive conversation, clarification, stabilisation, practical guidance, or simple acknowledgement may be the correct response',
    );
    expect(core).toContain('or no deeper intervention');
  });

  it('carries the anti-interrogation and anti-endless-exploration pair', () => {
    expect(core).toContain('Do not ask questions merely to collect information.');
    expect(core).toContain('Do not remain in endless exploration once sufficient understanding exists.');
  });

  it('carries least-intensive-intervention and the governing responsibility tetrad', () => {
    expect(core).toContain(
      'Use the least intensive intervention capable of meeting the current need.',
    );
    expect(core).toContain('Understanding guides intervention.');
    expect(core).toContain("The user's response guides revision.");
  });
});

describe('senior clinician role — master prompt is linked, not duplicated', () => {
  const master = loadMasterJourneyPrompt() ?? '';

  it('the master Governing principle references the Shared Core §1 role', () => {
    expect(master).toContain(
      'from within the senior clinical role and stance defined in Shared Core §1',
    );
  });

  it('the full role block is NOT duplicated into the master prompt', () => {
    expect(master).not.toContain(
      'Senior clinical psychologist — professional role and clinical stance',
    );
    expect(master).not.toContain('Core professional competencies');
  });

  it('shared-core section numbering is untouched (cross-references stay valid)', () => {
    for (const heading of [
      '## 2. The Voice',
      '## 4. Universal Prohibitions',
      '## 6. The Personal Anchor Protocol',
      '## 7. The Red Flag Protocol',
      '## 9. The Hidden State Report',
    ]) {
      expect(core).toContain(heading);
    }
  });
});
