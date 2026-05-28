'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';
import type { PublicTestimonial } from '@/lib/testimonials/queries';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

// Renders a curated set of approved testimonials. The parent server
// component fetches them and passes them as a prop, returning null when
// there are fewer than the minimum to display — this client component
// just renders what it's given.
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
      className="py-20"
      style={{ borderTop: `1px solid ${PALETTE.border}` }}
    >
      <div
        className="text-[11px] uppercase tracking-[0.22em] mb-4 text-center"
        style={{ color: PALETTE.accent, fontFamily: SANS, fontWeight: 500 }}
      >
        {t('kicker')}
      </div>
      <h2
        className="text-[32px] sm:text-[40px] leading-[1.1] mb-12 text-center"
        style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
      >
        {t('title')}
      </h2>

      <div className="space-y-8">
        {testimonials.map((entry) => (
          <figure
            key={entry.id}
            className="rounded-lg p-6 sm:p-8"
            style={{
              background: PALETTE.bgCard,
              border: `1px solid ${PALETTE.border}`,
            }}
          >
            <blockquote
              className="text-[17px] leading-[1.7] mb-5"
              style={{
                fontFamily: SERIF,
                fontWeight: 400,
                color: PALETTE.text,
                whiteSpace: 'pre-wrap',
              }}
            >
              {entry.story}
            </blockquote>
            <figcaption
              className="text-[13px]"
              style={{ fontFamily: SANS, color: PALETTE.textMuted, letterSpacing: '0.04em' }}
            >
              — {entry.publicName}
              {entry.ageRange && (
                <span style={{ marginLeft: 8 }}>· {entry.ageRange}</span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>

      <p
        className="mt-12 text-center text-[14px]"
        style={{ color: PALETTE.textMuted, fontFamily: SANS, lineHeight: 1.7 }}
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
