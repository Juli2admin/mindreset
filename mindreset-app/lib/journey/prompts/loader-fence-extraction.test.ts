// PR-1 loader fix — regression suite (2026-07-19).
//
// Defect: extractCodeBlock closed the outer master-prompt fence at the FIRST
// inner ``` fence. The Therapeutic Sensitivity Layer (2026-07-09) contains
// legitimate inner fences, so production silently truncated the runtime
// prompt (~6,101 chars): the five silent clinician questions, all hard
// behaviour rules, the worked failure-mode example and the closing
// </output_format> boundary never reached the model.
//
// This suite tests the ACTUAL production functions:
//   - loadMasterJourneyPrompt()      (runtime loader level)
//   - assembleSystemPromptBlocks()   (assembled-prompt pipeline level)
// plus an inline reimplementation of the OLD algorithm run against the real
// file, documenting the pre-fix failure so the first-fence logic can never
// silently return.
//
// NO clinical content is authored or asserted as new here — every asserted
// section is pre-existing text from docs/journey/runtime/journey-master.md.

import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { loadMasterJourneyPrompt } from './load-spec';
import { assembleSystemPromptBlocks } from './assemble';
import type { JourneyState } from '../state/types';

const masterMdPath = path.join(
  process.cwd(),
  'docs',
  'journey',
  'runtime',
  'journey-master.md',
);
const masterMd = readFileSync(masterMdPath, 'utf8');

// The production loader's output (post-fix).
const loaded = loadMasterJourneyPrompt() ?? '';

// The OLD (defective) algorithm, verbatim from the pre-fix extractCodeBlock.
// Kept here as executable documentation of the defect.
function oldFirstFenceExtract(md: string): string | null {
  const openIdx = md.indexOf('```');
  if (openIdx < 0) return null;
  const afterOpenLine = md.indexOf('\n', openIdx);
  if (afterOpenLine < 0) return null;
  const closeIdx = md.indexOf('```', afterOpenLine + 1);
  if (closeIdx < 0) return null;
  return md.slice(afterOpenLine + 1, closeIdx).trim();
}

// Sections of the master prompt that live AFTER the first inner fence —
// i.e. exactly the content the old loader dropped in production. All of
// these are pre-existing authored text (2026-07-09 Sensitivity Layer).
const RESTORED_SECTIONS = [
  // the five silent clinician questions
  'The five questions you MUST answer silently',
  // all hard behaviour rules (heading + each named rule)
  'Hard behaviour rules',
  // the modality-rejection rule
  'Modality rejection is once and stop',
  // the body-activation switching rule
  'Body activation → switch to somatic processing',
  // the open-cycle / unresolved-activation closure rule
  'DO NOT end the session while any of these hold',
  'If you opened deep material, you must guide safe completion',
  // the worked failure-mode example
  'the exact failure mode this layer prevents',
  'The image became monstrous',
  // the final semantic boundary
  '</output_format>',
] as const;

// Repository-documentation wrapper text that must NEVER reach the runtime
// prompt (all live OUTSIDE the outer fence in the .md).
const WRAPPER_MARKERS = [
  '# The Journey — Master System Prompt',
  '**What this is:**',
  '**Status:** v1 master prompt',
  'Everything below the divider is what Claude sees',
] as const;

function makeState(): JourneyState {
  return {
    userId: 'user_loader_test',
    currentStage: 1,
    currentDepth: 'surface',
    startedAt: new Date('2026-06-20'),
    lastActivityAt: new Date('2026-06-26'),
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
  };
}

describe('DEFECT DOCUMENTATION — the old first-fence algorithm truncates the real file', () => {
  it('old algorithm stops at the first inner fence and loses every restored section', () => {
    const old = oldFirstFenceExtract(masterMd) ?? '';
    expect(old.length).toBeGreaterThan(0);
    for (const section of RESTORED_SECTIONS) {
      expect(old).not.toContain(section);
    }
    // And it measurably drops content relative to the fixed loader.
    expect(loaded.length - old.length).toBeGreaterThan(5000);
  });
});

describe('runtime loader level — loadMasterJourneyPrompt() (production function)', () => {
  it('contains every previously-omitted section', () => {
    for (const section of RESTORED_SECTIONS) {
      expect(loaded).toContain(section);
    }
  });

  it('begins and ends at the intended semantic boundaries', () => {
    expect(loaded.startsWith('<clinical_reading>')).toBe(true);
    expect(loaded.endsWith('</output_format>')).toBe(true);
  });

  it('contains no document wrapper or repository metadata', () => {
    for (const marker of WRAPPER_MARKERS) {
      expect(loaded).not.toContain(marker);
    }
  });

  it('keeps internal code fences balanced (inner fences come in pairs)', () => {
    const fenceCount = (loaded.match(/```/g) ?? []).length;
    expect(fenceCount % 2).toBe(0);
    // The source document itself must also keep the invariant the fix relies
    // on: an odd total fence count in the .md (outer open + paired inners +
    // outer close) would mean an unbalanced edit. Guard the invariant.
    const mdFences = (masterMd.match(/```/g) ?? []).length;
    expect(mdFences % 2).toBe(0);
  });

  it('contains each restored clinical section exactly once (no duplication)', () => {
    const onceOnly = [
      '<clinical_reading>',
      'The five questions you MUST answer silently',
      'Hard behaviour rules',
      'Modality rejection is once and stop',
      'the exact failure mode this layer prevents',
      '</output_format>',
    ];
    for (const section of onceOnly) {
      expect(loaded.split(section).length - 1).toBe(1);
    }
  });
});

describe('assembled-prompt level — assembleSystemPromptBlocks() (production pipeline)', () => {
  const fullAssembled = assembleSystemPromptBlocks(makeState())
    .map((b) => b.text)
    .join('');

  it('the assembled runtime prompt contains every previously-omitted section', () => {
    for (const section of RESTORED_SECTIONS) {
      expect(fullAssembled).toContain(section);
    }
  });

  it('the assembled runtime prompt contains no wrapper text and no duplicated clinical sections', () => {
    for (const marker of WRAPPER_MARKERS) {
      expect(fullAssembled).not.toContain(marker);
    }
    expect(fullAssembled.split('<clinical_reading>').length - 1).toBe(1);
    expect(
      fullAssembled.split('The five questions you MUST answer silently').length - 1,
    ).toBe(1);
    expect(fullAssembled.split('</output_format>').length - 1).toBe(1);
  });

  it('the sections sit AFTER the state-injection split (the uncached master tail actually ships them)', () => {
    // assembleSystemPromptBlocks splits the master at {{STATE_INJECTION}};
    // the restored sections live in the final (post-state) block. If the
    // split ever swallowed them, the joined text above could still pass —
    // so pin the tail block explicitly.
    const blocks = assembleSystemPromptBlocks(makeState());
    const tail = blocks[blocks.length - 1].text;
    expect(tail).toContain('DO NOT end the session while any of these hold');
    expect(tail).toContain('</output_format>');
  });
});
