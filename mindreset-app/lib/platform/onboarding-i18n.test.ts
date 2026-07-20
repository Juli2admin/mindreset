// Onboarding i18n pin — Step 2 (2026-07-20).
//
// Every canonical onboarding code must have a label in BOTH native
// bundles (en source of truth, ru hand-curated), plus the step titles
// and chrome strings. A code added to lib/platform/types.ts without
// copy — or copy dropped in a bundle edit — fails here before it can
// render as a raw key to a user.
//
// Also pins the owner-approved anchor strings so the copy can't drift
// silently, and the RU gender-neutrality decision at its most fragile
// points (the three buttons where a literal translation would have
// forced a gendered past-tense verb).

import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import ru from '../../messages/ru.json';
import {
  ONBOARDING_WHY,
  ONBOARDING_AREA,
  ONBOARDING_STYLE,
  ONBOARDING_GOAL,
} from './types';

type Bundle = Record<string, string>;
const enO = (en as { Onboarding: Bundle }).Onboarding;
const ruO = (ru as { Onboarding: Bundle }).Onboarding;

const CHROME = ['intro', 'stepIndicator', 'skip', 'back', 'footerNote', 'title1', 'title2', 'title3', 'title4'];

function expectKey(bundle: Bundle, name: string, key: string) {
  expect(typeof bundle[key], `${name}: missing Onboarding.${key}`).toBe('string');
  expect((bundle[key] ?? '').length, `${name}: empty Onboarding.${key}`).toBeGreaterThan(0);
}

describe('onboarding i18n — every code has copy in en and ru', () => {
  it('chrome and titles present', () => {
    for (const key of CHROME) {
      expectKey(enO, 'en', key);
      expectKey(ruO, 'ru', key);
    }
  });

  it('all vocabulary codes covered', () => {
    const keys = [
      ...ONBOARDING_WHY.map((c) => `why_${c}`),
      ...ONBOARDING_AREA.map((c) => `area_${c}`),
      ...ONBOARDING_STYLE.map((c) => `style_${c}`),
      ...ONBOARDING_STYLE.map((c) => `style_${c}_sub`),
      ...ONBOARDING_GOAL.map((c) => `goal_${c}`),
    ];
    for (const key of keys) {
      expectKey(enO, 'en', key);
      expectKey(ruO, 'ru', key);
    }
  });
});

describe('onboarding i18n — owner-approved anchors (v2)', () => {
  it('en titles are the approved wording', () => {
    expect(enO.title1).toBe("What's most present for you right now?");
    expect(enO.title3).toBe('What kind of work are you looking for?');
  });

  it('ru titles are the approved wording (formal Вы)', () => {
    expect(ruO.title1).toBe('Что сейчас ощущается сильнее всего?');
    expect(ruO.title3).toBe('Что Вам сейчас ближе?');
  });

  it('the transformation answer is present — the type-deciding button', () => {
    expect(enO.goal_transformation).toContain('reach the roots');
    expect(ruO.goal_transformation).toContain('дойти до корней');
  });

  it('RU stays gender-neutral where a literal translation would gender', () => {
    // far_from_myself: present tense, not «потерял(а)»
    expect(ruO.why_far_from_myself).toBe('Ощущение, что я далеко от себя — будто теряю себя.');
    // transformation: no «готов(а)» fork — willingness phrased without gender
    expect(ruO.goal_transformation).not.toMatch(/готов/);
    // guide_me subtitle: «пока не знаю», not «не уверен(а)»
    expect(ruO.style_guide_me_sub).toBe('Я пока не знаю, с чего начать. Пожалуйста, направляйте меня.');
    // Belt-and-braces: no gendered-fork notation anywhere in the RU block.
    // потерял(?!о): first-person «потерял/потеряла» is banned; the neuter
    // «потеряло» (about «всё», not the person) is legitimate.
    const all = Object.values(ruO).join(' ');
    expect(all).not.toMatch(/\(а\)|потерял(?!о)|застрял|уверен /);
  });
});
