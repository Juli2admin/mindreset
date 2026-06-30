import { describe, it, expect } from 'vitest';
import { splitReplyAndReport, displayableReply } from './parse';

const R = '<state-report>{"intensity":4,"safetyFlag":"none","recommendedAction":"advance"}</state-report>';

describe('splitReplyAndReport — report-first contract', () => {
  it('report-first: reply is the text after the report', () => {
    const s = splitReplyAndReport(`${R}\nHello, I hear you.`);
    expect(s.humanReply).toBe('Hello, I hear you.');
    expect(s.rawStateReport).toContain('"recommendedAction":"advance"');
  });
  it('legacy report-last still works (reply before report)', () => {
    const s = splitReplyAndReport(`Hello, I hear you. ${R}`);
    expect(s.humanReply).toBe('Hello, I hear you.');
    expect(s.rawStateReport).toContain('"intensity":4');
  });
  it('no report → whole text is the reply', () => {
    const s = splitReplyAndReport('Just a warm reply.');
    expect(s.humanReply).toBe('Just a warm reply.');
    expect(s.rawStateReport).toBeNull();
  });
  it('truncated report (open, no close) → report null, reply is text before open', () => {
    const s = splitReplyAndReport('<state-report>{"intensity":4');
    expect(s.rawStateReport).toBeNull();
    expect(s.humanReply).toBe('');
  });
});

describe('displayableReply — report-first streaming', () => {
  it('returns null while still inside the leading report', () => {
    expect(displayableReply('<state-rep', false)).toBeNull();
    expect(displayableReply('<state-report>{"intensity":4', false)).toBeNull();
    expect(displayableReply('   ', false)).toBeNull(); // leading whitespace only
  });
  it('returns the reply once the report closes', () => {
    expect(displayableReply(`${R}\nHello there`, false)).toBe('Hello there');
  });
  it('legacy report-last: shows text before the open tag', () => {
    expect(displayableReply(`Hello there ${R}`, true)).toBe('Hello there ');
  });
  it('no report: holds back a tail until final', () => {
    const text = 'A short reply';
    // not final → holds back one tag-length tail (so a forming <state-report> cannot leak)
    expect(displayableReply(text, false)!.length).toBeLessThan(text.length);
    // final → full text
    expect(displayableReply(text, true)).toBe(text);
  });
  it('is monotonic: streamed deltas never need to be retracted', () => {
    const full = `${R}\nThis is the warm reply, several words long.`;
    let prev = '';
    for (let i = 1; i <= full.length; i++) {
      const d = displayableReply(full.slice(0, i), false);
      if (d === null) continue;
      // each result must extend the previous (start with it)
      expect(d.startsWith(prev) || prev.startsWith(d)).toBe(true);
      if (d.length >= prev.length) prev = d;
    }
    expect(displayableReply(full, true)).toBe('This is the warm reply, several words long.');
  });
});
