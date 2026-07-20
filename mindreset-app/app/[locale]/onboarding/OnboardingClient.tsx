'use client';

// 4-step onboarding client — Step 2 (2026-07-20).
//
// Buttons write codes, nothing else. Each selection saves immediately
// (partial saves merge server-side and survive an abandoned flow), then
// advances. Skip is visible on every step and set-once server-side.
// Revisits arrive with current answers preselected; changing one saves
// the new value the same way.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  ONBOARDING_WHY,
  ONBOARDING_AREA,
  ONBOARDING_STYLE,
  ONBOARDING_GOAL,
} from '@/lib/platform/types';

type Answers = {
  why: string | null;
  area: string | null;
  style: string | null;
  goal: string | null;
};

type StepKey = 'why' | 'area' | 'style' | 'goal';

const STEPS: { key: StepKey; title: string; options: readonly string[] }[] = [
  { key: 'why', title: 'title1', options: ONBOARDING_WHY },
  { key: 'area', title: 'title2', options: ONBOARDING_AREA },
  { key: 'style', title: 'title3', options: ONBOARDING_STYLE },
  { key: 'goal', title: 'title4', options: ONBOARDING_GOAL },
];

export default function OnboardingClient({
  initialAnswers,
}: {
  initialAnswers: Answers;
}) {
  const t = useTranslations('Onboarding');
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  async function post(body: unknown): Promise<void> {
    // Saves are best-effort from the client's point of view: a network
    // failure must never trap the user in onboarding. The server merge
    // means whatever DID land is kept.
    try {
      await fetch('/api/platform/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      // swallow — see note above
    }
  }

  async function choose(code: string) {
    if (saving) return;
    setSaving(true);
    setAnswers((a) => ({ ...a, [step.key]: code }));
    await post({ answers: { [step.key]: code } });
    setSaving(false);
    if (isLast) {
      router.push('/home');
    } else {
      setStepIdx((i) => i + 1);
    }
  }

  async function skip() {
    if (saving) return;
    setSaving(true);
    await post({ skip: true });
    setSaving(false);
    router.push('/home');
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-xl">
        {stepIdx === 0 && (
          <p className="text-[14px] text-neutral-600 mb-6">{t('intro')}</p>
        )}

        <div className="flex items-center justify-between mb-4">
          <span className="text-[12px] uppercase tracking-[0.12em] text-neutral-500">
            {t('stepIndicator', { n: stepIdx + 1 })}
          </span>
          <button
            type="button"
            onClick={skip}
            className="text-[13px] text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
          >
            {t('skip')}
          </button>
        </div>

        <h1 className="text-[20px] font-semibold mb-5">{t(step.title)}</h1>

        <div className="flex flex-col gap-2.5">
          {step.options.map((code) => {
            const selected = answers[step.key] === code;
            return (
              <button
                key={code}
                type="button"
                disabled={saving}
                onClick={() => choose(code)}
                className={`text-left border rounded-lg px-4 py-3 transition-colors ${
                  selected
                    ? 'border-neutral-900 bg-white'
                    : 'border-neutral-200 bg-white hover:border-neutral-400'
                }`}
              >
                <span className="text-[15px]">{t(`${step.key}_${code}`)}</span>
                {step.key === 'style' && (
                  <span className="block text-[13px] text-neutral-500 mt-1">
                    {t(`style_${code}_sub`)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-6">
          {stepIdx > 0 ? (
            <button
              type="button"
              onClick={() => setStepIdx((i) => i - 1)}
              className="text-[13px] text-neutral-500 hover:text-neutral-800"
            >
              ← {t('back')}
            </button>
          ) : (
            <span />
          )}
          <span className="text-[12px] text-neutral-400">{t('footerNote')}</span>
        </div>
      </div>
    </main>
  );
}
