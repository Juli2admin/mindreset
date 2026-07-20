// Dashboard i18n coverage (2026-07-20, owner-approved copy).
//
// Every reason key the ORIENTATION engine can emit (ONBOARDING_REASON_KEYS)
// plus the RECOGNITION key must have localised copy in BOTH native bundles —
// so a new key cannot ship without dashboard copy and the dashboard can never
// render a raw key. Also pins: "you said" framing (never diagnostic wording),
// the RU «Путь к себе» rename, and the informed-choice page copy.

import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import ru from '../../messages/ru.json';
import { ONBOARDING_REASON_KEYS } from './recommendations';

type Bundle = Record<string, string>;
const enD = (en as { Dashboard: Bundle }).Dashboard;
const ruD = (ru as { Dashboard: Bundle }).Dashboard;
const enJ = (en as { JourneyChoice: Bundle }).JourneyChoice;
const ruJ = (ru as { JourneyChoice: Bundle }).JourneyChoice;

// Every reason key that can render on the dashboard.
const ALL_REASON_KEYS = [...ONBOARDING_REASON_KEYS, 'state_repeat_3in7'];

const DIAGNOSTIC_PHRASES_EN = [
  'we noticed',
  'we detected',
  'your profile',
  'you appear',
  'diagnos',
];
const DIAGNOSTIC_PHRASES_RU = ['мы заметили', 'мы обнаружили', 'ваш профиль'];

// Payment-adjacent surface → brand-language constraints apply.
const FORBIDDEN_BRAND = [
  'therapy',
  'therapeutic',
  'treatment',
  'medical',
  'mental illness',
  'diagnosis',
  'counseling',
  'counselling',
  'clinical',
  'unlimited',
];

describe('dashboard i18n — reason copy for every rule', () => {
  it('every reason key has non-empty copy in en and ru', () => {
    for (const key of ALL_REASON_KEYS) {
      for (const [name, bundle] of [['en', enD], ['ru', ruD]] as const) {
        const copy = bundle[`reason_${key}`];
        expect(typeof copy, `${name}: missing Dashboard.reason_${key}`).toBe('string');
        expect((copy ?? '').length, `${name}: empty Dashboard.reason_${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('orientation reasons use user-authored framing, never diagnostic wording', () => {
    for (const key of ONBOARDING_REASON_KEYS) {
      const enCopy = enD[`reason_${key}`];
      const ruCopy = ruD[`reason_${key}`];
      // EN: "You said …" / "You chose …"
      expect(enCopy, `en reason_${key}`).toMatch(/^You (said|chose)/);
      for (const bad of DIAGNOSTIC_PHRASES_EN) {
        expect(enCopy.toLowerCase(), `en reason_${key} contains "${bad}"`).not.toContain(bad);
      }
      // RU: «Вы сказали …» / «Вы выбрали …»
      expect(ruCopy, `ru reason_${key}`).toMatch(/Вы (сказали|выбрали)/);
      for (const bad of DIAGNOSTIC_PHRASES_RU) {
        expect(ruCopy.toLowerCase(), `ru reason_${key} contains "${bad}"`).not.toContain(bad);
      }
    }
  });

  it('the approved chrome copy is present in both bundles', () => {
    const keys = [
      'whyTitle', 'whyEdit', 'skippedInvite', 'skippedCta',
      'suggestedTitle', 'accept', 'decline',
      'recommendedTitle', 'cta', 'ctaJourney', 'ownedContinue',
      'productMinimind', 'productJourney',
    ];
    for (const key of keys) {
      expect(typeof enD[key], `en: ${key}`).toBe('string');
      expect((enD[key] ?? '').length, `en empty: ${key}`).toBeGreaterThan(0);
      expect(typeof ruD[key], `ru: ${key}`).toBe('string');
      expect((ruD[key] ?? '').length, `ru empty: ${key}`).toBeGreaterThan(0);
    }
    expect(enD.recommendedTitle).toBe('Recommended starting points');
    expect(enD.ownedContinue).toBe('You already have access — continue here');
  });

  it('The Journey is «Путь к себе» in every RU dashboard string', () => {
    expect(ruD.productJourney).toBe('«Путь к себе»');
    expect(ruD.ctaJourney).toContain('«Путь к себе»');
    expect(ruD.reason_journey_multi).toContain('«Путь к себе»');
    // Never the untranslated English name.
    for (const v of Object.values(ruD)) {
      expect(v).not.toContain('The Journey');
    }
  });
});

describe('informed-choice page (JourneyChoice) copy', () => {
  const KEYS = ['kicker', 'title', 'body1', 'body2', 'body3', 'continueCta', 'exploreCta'];

  it('has non-empty copy for every key in en and ru', () => {
    for (const key of KEYS) {
      expect((enJ[key] ?? '').length, `en JourneyChoice.${key}`).toBeGreaterThan(0);
      expect((ruJ[key] ?? '').length, `ru JourneyChoice.${key}`).toBeGreaterThan(0);
    }
  });

  it('RU uses «Путь к себе», never the English name', () => {
    expect(ruJ.title).toContain('«Путь к себе»');
    for (const v of Object.values(ruJ)) {
      expect(v).not.toContain('The Journey');
    }
  });

  it('honours the brand-language constraints for a payment-adjacent surface', () => {
    for (const bundle of [enJ, ruJ]) {
      for (const v of Object.values(bundle)) {
        for (const bad of FORBIDDEN_BRAND) {
          expect(v.toLowerCase(), `contains "${bad}": ${v}`).not.toContain(bad);
        }
      }
    }
  });
});
