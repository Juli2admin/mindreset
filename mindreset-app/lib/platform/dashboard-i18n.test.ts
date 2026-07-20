// Dashboard i18n coverage — Step 5 (2026-07-20, owner-approved copy).
//
// Every ruleKey a platform rule can emit must have a localised reason in
// BOTH native bundles, and every rule the mapping functions produce must
// come from ALL_RULE_KEYS — so a new rule cannot ship without dashboard
// copy, and the dashboard can never render a raw key to a user.

import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import ru from '../../messages/ru.json';
import { ALL_RULE_KEYS, onboardingRecommendation, STATE_THRESHOLD_PRODUCT } from './recommendations';
import { ONBOARDING_WHY, ONBOARDING_AREA } from './types';

type Bundle = Record<string, string>;
const enD = (en as { Dashboard: Bundle }).Dashboard;
const ruD = (ru as { Dashboard: Bundle }).Dashboard;

describe('dashboard i18n — reason copy for every rule', () => {
  it('every ALL_RULE_KEYS entry has non-empty reason copy in en and ru', () => {
    for (const key of ALL_RULE_KEYS) {
      for (const [name, bundle] of [['en', enD], ['ru', ruD]] as const) {
        const copy = bundle[`reason_${key}`];
        expect(typeof copy, `${name}: missing Dashboard.reason_${key}`).toBe('string');
        expect((copy ?? '').length, `${name}: empty Dashboard.reason_${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('every ruleKey the onboarding rule can produce is in ALL_RULE_KEYS', () => {
    const known = new Set<string>(ALL_RULE_KEYS);
    for (const why of ONBOARDING_WHY) {
      for (const area of ONBOARDING_AREA) {
        const rec = onboardingRecommendation({ why, area });
        if (rec) {
          expect(known.has(rec.ruleKey), `unlisted ruleKey: ${rec.ruleKey}`).toBe(true);
        }
      }
    }
    // The threshold rule emits a single key; the mapping table only
    // changes products, never the key.
    expect(known.has('state_repeat_3in7')).toBe(true);
    expect(Object.keys(STATE_THRESHOLD_PRODUCT).length).toBeGreaterThan(0);
  });

  it('the approved chrome copy is present in both bundles', () => {
    for (const key of ['whyTitle', 'whyEdit', 'skippedInvite', 'skippedCta', 'suggestedTitle', 'accept', 'decline']) {
      expect(typeof enD[key], `en: ${key}`).toBe('string');
      expect(typeof ruD[key], `ru: ${key}`).toBe('string');
    }
    expect(enD.suggestedTitle).toBe('Suggested for you');
    expect(ruD.suggestedTitle).toBe('Может подойти Вам');
    expect(ruD.decline).toBe('Не сейчас');
  });

  it('reasons use the "you said" framing, never "we noticed"', () => {
    for (const key of ALL_RULE_KEYS) {
      expect(enD[`reason_${key}`].toLowerCase()).not.toContain('we noticed');
    }
  });
});
