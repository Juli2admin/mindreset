'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';
import type { PublicTestimonial } from '@/lib/testimonials/queries';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;
const ADVANCE_MS = 7000;     // dwell time per quote — slow, readable
const FADE_MS = 800;         // crossfade duration

// Editorial treatment with a slow auto-advance crossfade. Only one
// testimonial is visible at a time; the rest are stacked behind via CSS
// grid (no absolute positioning, so the container takes the natural
// height of the longest quote and there's no layout jump on advance).
// Respects prefers-reduced-motion by rendering all entries stacked
// vertically with no animation.
export default function TestimonialsSection({
  testimonials,
}: {
  testimonials: PublicTestimonial[];
}) {
  const { palette: PALETTE } = useTheme();
  const t = useTranslations('Testimonials');
  const tA11y = useTranslations('A11y');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (reducedMotion || isPaused || testimonials.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setActiveIndex((i) => (i + 1) % testimonials.length);
    }, ADVANCE_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [reducedMotion, isPaused, testimonials.length]);

  if (testimonials.length === 0) return null;

  // Render testimonials stacked (vertically) for reduced-motion users —
  // they get the full set, no animation. Otherwise render the carousel.
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

      {reducedMotion ? (
        <div className="space-y-16">
          {testimonials.map((entry) => (
            <Quote key={entry.id} entry={entry} palette={PALETTE} />
          ))}
        </div>
      ) : (
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
        >
          {/* CSS-grid stack: every entry occupies the same cell, so the
              container takes the height of the tallest entry — no layout
              jump as we crossfade between them. */}
          <div className="grid">
            {testimonials.map((entry, i) => (
              <div
                key={entry.id}
                className="row-start-1 col-start-1"
                style={{
                  opacity: i === activeIndex ? 1 : 0,
                  transition: `opacity ${FADE_MS}ms ease-in-out`,
                  pointerEvents: i === activeIndex ? 'auto' : 'none',
                }}
                aria-hidden={i !== activeIndex}
              >
                <Quote entry={entry} palette={PALETTE} />
              </div>
            ))}
          </div>

          {/* Dot navigation — also a progress indicator. Min tap target 36px. */}
          {testimonials.length > 1 && (
            <div className="mt-10 flex justify-center gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  aria-label={tA11y('testimonialShowNth', { n: i + 1, total: testimonials.length })}
                  className="min-w-9 min-h-9 inline-flex items-center justify-center"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: i === activeIndex ? 24 : 6,
                      height: 6,
                      borderRadius: 999,
                      background: i === activeIndex ? PALETTE.accent : PALETTE.border,
                      transition: 'width 300ms ease, background 300ms ease',
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p
        className="mt-16 text-center text-[14px] leading-[1.7]"
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

function Quote({
  entry,
  palette,
}: {
  entry: PublicTestimonial;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  return (
    <figure className="max-w-[34rem] mx-auto text-center">
      <span
        aria-hidden
        className="block text-[64px] leading-none mb-2 select-none"
        style={{
          fontFamily: SERIF,
          color: palette.accent,
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
          color: palette.text,
          whiteSpace: 'pre-wrap',
        }}
      >
        {entry.story}
      </blockquote>
      <figcaption
        className="text-[11px] uppercase"
        style={{
          fontFamily: SANS,
          color: palette.textMuted,
          letterSpacing: '0.18em',
          fontWeight: 500,
        }}
      >
        {entry.publicName}
        {entry.ageRange && (
          <span style={{ marginLeft: 10, color: palette.textHint }}>
            · {entry.ageRange}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
