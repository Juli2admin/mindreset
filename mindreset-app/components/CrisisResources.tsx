'use client';

import { useTranslations } from 'next-intl';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';

// Phase i18n.2a — content moved from in-file COPY object to next-intl
// message bundles under the `CrisisResources` namespace. Component reads
// translations via useTranslations; arrays come back via t.raw().
//
// Landing-only section (rendered above the shared Footer on /).
// Content is identical across pages but only mounted from Landing.jsx.

type CrisisItem = { name: string; detail: string };

export default function CrisisResources() {
  const t = useTranslations('CrisisResources');
  const { palette: PALETTE } = useTheme();
  const crisisLabel = t('crisisLabel');
  const crisisItems = t.raw('crisisItems') as CrisisItem[];
  const disclaimer = t('disclaimer');

  return (
    <section
      className="mt-24 pt-10"
      style={{ borderTop: `1px solid ${PALETTE.border}` }}
      aria-label={crisisLabel}
    >
      <div
        className="mb-8 rounded-xl p-6"
        style={{
          background: PALETTE.bgSubtle,
          border: `1px solid ${PALETTE.border}`,
        }}
      >
        <div
          className="text-[11px] uppercase tracking-[0.18em] mb-4"
          style={{
            color: PALETTE.danger,
            fontWeight: 500,
            fontFamily: TOKENS.sans,
          }}
        >
          {crisisLabel}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {crisisItems.map((item) => (
            <div key={item.name}>
              <div
                className="text-[15px] mb-0.5"
                style={{
                  color: PALETTE.text,
                  fontWeight: 500,
                  fontFamily: TOKENS.serif,
                }}
              >
                {item.name}
              </div>
              <div
                className="text-[13px]"
                style={{ color: PALETTE.textMuted, fontFamily: TOKENS.sans }}
              >
                {item.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p
        className="text-[13px] leading-[1.7] max-w-[42rem]"
        style={{ color: PALETTE.textHint, fontFamily: TOKENS.sans }}
      >
        {disclaimer}
      </p>
    </section>
  );
}
