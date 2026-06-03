// Server-side helpers for the public Testimonials block.
//
// Display rule: render the block whenever there are at least
// MIN_TESTIMONIALS_TO_SHOW approved entries GLOBALLY (across all
// locales). Matching-locale testimonials are preferred (shown first);
// if there aren't enough, approved testimonials from other locales fill
// the remaining slots so the block always renders. This matches the
// product decision (2026-06-02) that the social-proof block must show
// on every locale once we have enough total testimonials — locale
// becomes a preference, not a strict gate.

import prisma from '@/lib/prisma';

export const MIN_TESTIMONIALS_TO_SHOW = 3;
export const MAX_STORY_LENGTH = 1500;
const MAX_DISPLAYED = 12;

export type PublicTestimonial = {
  id: string;
  publicName: string;
  ageRange: string | null;
  story: string;
};

// Returns approved testimonials, prioritising the requested locale. Falls
// back to approved testimonials in other locales when the current-locale
// pool is smaller than MAX_DISPLAYED. Returns an empty array (callers
// then suppress the public block) only when the GLOBAL approved count
// is below MIN_TESTIMONIALS_TO_SHOW.
export async function getApprovedTestimonials(locale: string): Promise<PublicTestimonial[]> {
  const select = {
    id: true,
    publicName: true,
    ageRange: true,
    story: true,
  } as const;

  const inLocale = await prisma.testimonial.findMany({
    where: { status: 'approved', locale },
    orderBy: { approvedAt: 'desc' },
    select,
    take: MAX_DISPLAYED,
  });

  if (inLocale.length >= MAX_DISPLAYED) return inLocale;

  const remaining = MAX_DISPLAYED - inLocale.length;
  const others = await prisma.testimonial.findMany({
    where: { status: 'approved', locale: { not: locale } },
    orderBy: { approvedAt: 'desc' },
    select,
    take: remaining,
  });

  const combined = [...inLocale, ...others];
  if (combined.length < MIN_TESTIMONIALS_TO_SHOW) return [];
  return combined;
}
