import { describe, expect, it, vi } from 'vitest';

describe('isPilotTester', () => {
  it('returns false for null / undefined / empty', async () => {
    const { isPilotTester } = await import('./testers');
    expect(isPilotTester(null)).toBe(false);
    expect(isPilotTester(undefined)).toBe(false);
    expect(isPilotTester('')).toBe(false);
    expect(isPilotTester('   ')).toBe(false);
  });

  it('returns false for an email not in the allowlist', async () => {
    const { isPilotTester } = await import('./testers');
    expect(isPilotTester('random@example.com')).toBe(false);
  });

  it('is case-insensitive and trims whitespace when the allowlist has entries', async () => {
    vi.resetModules();
    vi.doMock('./testers', async () => {
      const actual = await vi.importActual<typeof import('./testers')>('./testers');
      const emails: ReadonlySet<string> = new Set(['juli@example.com']);
      return {
        ...actual,
        PILOT_TESTER_EMAILS: emails,
        isPilotTester: (email: string | null | undefined) => {
          if (!email) return false;
          return emails.has(email.trim().toLowerCase());
        },
      };
    });
    const { isPilotTester } = await import('./testers');
    expect(isPilotTester('juli@example.com')).toBe(true);
    expect(isPilotTester('JULI@example.com')).toBe(true);
    expect(isPilotTester('  juli@example.com  ')).toBe(true);
    expect(isPilotTester('someone@else.com')).toBe(false);
    vi.doUnmock('./testers');
  });
});
