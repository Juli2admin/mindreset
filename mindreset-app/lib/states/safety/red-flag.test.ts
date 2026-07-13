// Tests for the State-module red-flag keyword scanner.
//
// The scanner delegates to lib/journey/safety/keywords — where the full
// pattern set + false-positive nuances are tested. These tests confirm
// the delegation is wired correctly for the State surface (hits,
// non-hits, RU locale response, flag-type propagation).

import { describe, it, expect } from 'vitest';
import {
  scanForStateRedFlag,
  getStateCrisisResponseForLocale,
} from './red-flag';

describe('scanForStateRedFlag', () => {
  it('matches unambiguous suicidal intent', () => {
    const hit = scanForStateRedFlag("I want to die");
    expect(hit.matched).toBe(true);
    expect(hit.flagType).toBe('suicidal');
  });

  it('matches self-harm intent', () => {
    const hit = scanForStateRedFlag('I am going to cut myself tonight');
    expect(hit.matched).toBe(true);
    expect(hit.flagType).toBe('self-harm');
  });

  it('matches violence intent', () => {
    const hit = scanForStateRedFlag('I am going to kill him');
    expect(hit.matched).toBe(true);
    expect(hit.flagType).toBe('violence');
  });

  it('does NOT match plain distress / anxiety language', () => {
    // The most common Anxiety-module opening. Must NOT trip crisis.
    expect(scanForStateRedFlag("I feel anxious").matched).toBe(false);
    expect(scanForStateRedFlag("my heart is racing").matched).toBe(false);
    expect(scanForStateRedFlag("I'm panicking").matched).toBe(false);
    expect(scanForStateRedFlag("I feel overwhelmed").matched).toBe(false);
    expect(scanForStateRedFlag("I can't stop worrying").matched).toBe(false);
  });

  it('does NOT match "I can\'t breathe" as somatic body-report', () => {
    // Post-release phenomenology fix carried over from Journey. In the
    // Anxiety module this shape is even more common — panic can present
    // as "I can't breathe" and the correct response is 4-7-8 breathing,
    // NOT freeze the module.
    expect(scanForStateRedFlag("I can't breathe").matched).toBe(false);
    expect(scanForStateRedFlag("my chest is tight and I can't breathe").matched).toBe(false);
  });

  it('MATCHES "I can\'t breathe" WITH emergency co-signal', () => {
    // The Journey fix left this shape as a hit — it does signal real
    // acute distress the AI can't manage on its own.
    expect(scanForStateRedFlag("help me I can't breathe, call someone").matched).toBe(true);
    expect(scanForStateRedFlag("I can't breathe I'm dying help").matched).toBe(true);
  });

  it('does NOT match domestic-abuse disclosure', () => {
    // "I don't want to live with him" false-positive carried over.
    // In the Anxiety module a user disclosing an abusive home
    // relationship must be able to name it without freezing the module.
    expect(scanForStateRedFlag("I don't want to live with him").matched).toBe(false);
    expect(scanForStateRedFlag("I don't want to be here with my mother").matched).toBe(false);
  });
});

describe('getStateCrisisResponseForLocale', () => {
  it('returns EN by default', () => {
    const r = getStateCrisisResponseForLocale(null);
    expect(r).toContain('Samaritans');
    expect(r).toContain('116 123');
  });

  it('returns RU for locale ru', () => {
    const r = getStateCrisisResponseForLocale('ru');
    expect(r).toContain('Samaritans');
    expect(r).toContain('116 123');
    expect(r).toMatch(/В Великобритании|Вне Великобритании/);
  });

  it('falls back to EN for unknown locales — never silently fails', () => {
    const r = getStateCrisisResponseForLocale('fr');
    expect(r).toContain('Samaritans');
  });
});
