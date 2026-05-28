'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';
import type { PublicTestimonial } from '@/lib/testimonials/queries';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

// Editorial treatment — no card chrome, just typography. The brand is
// literary, not e-commerce; the previous bgCard=#FFF treatment read as
// product-review boxes on cream paper. Each entry sits in its own
// vertical rhythm with a thin opening-quote mark in the accent colour
// and a small-caps attribution beneath.
export default function TestimonialsSection({
  testimonials,
}: {
  testimonials: PublicTestimonial[];
}) {
  const { palette: PALETTE } = useTheme();
  const t = useTranslations('Testimonials');

  if (testimonials.length === 0) return null;

  return (
    <section
      className="py-24"
      style={{ borderTop: `1px solid ${PALETTE.border}` }}
    >
      <div className="text-center mb-16">
        <div
          className="text-[11px] uppercase tracking-[0.22em] mb-4"
          style={{ color: PALETTE.accent, fontFamily: SANS, fontWeight: 500 }}
        >
          {t('kicker')}
        </div>
        <h2
          className="text-[32px] sm:text-[40px] leading-[1.15] -tracking-[0.01em]"
          style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
        >
          {t('title')}
        </h2>
      </div>

      <div className="space-y-16">
        {testimonials.map((entry) => (
          <figure key={entry.id} className="max-w-[34rem] mx-auto text-center">
            <span
              aria-hidden
              className="block text-[64px] leading-none mb-2 select-none"
              style={{
                fontFamily: SERIF,
                color: PALETTE.accent,
                opacity: 0.55,
              }}
            >
              &ldquo;
            </span>
            <blockquote
              className="text-[19px] sm:text-[20px] leading-[1.65] mb-6"
              style={{
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontWeight: 400,
                color: PALETTE.text,
                whiteSpace: 'pre-wrap',
              }}
            >
              {entry.story}
            </blockquote>
            <figcaption
              className="text-[11px] uppercase"
              style={{
                fontFamily: SANS,
                color: PALETTE.textMuted,
                letterSpacing: '0.18em',
                fontWeight: 500,
              }}
            >
              {entry.publicName}
              {entry.ageRange && (
                <span style={{ marginLeft: 10, color: PALETTE.textHint }}>
                  · {entry.ageRange}
                </span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>

      <p
        className="mt-20 text-center text-[14px] leading-[1.7]"
        style={{ color: PALETTE.textMuted, fontFamily: SANS }}
      >
        {t('shareInvite')}{' '}
        <Link
          href="/share-your-story"
          style={{ color: PALETTE.accent, textDecoration: 'underline' }}
        >
          {t('shareCta')}
        </Link>
      </p>
    </section>
  );
}
