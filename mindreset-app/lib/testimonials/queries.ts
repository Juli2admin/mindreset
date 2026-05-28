// Server-side helpers for the public Testimonials block.
//
// Display rule: render the block only when there are at least
// MIN_TESTIMONIALS_TO_SHOW approved entries in the current locale. Zero
// or one or two testimonials reads as "no one trusts this app yet" — the
// fix is to hide the block until enough have accumulated.

import prisma from '@/lib/prisma';

export const MIN_TESTIMONIALS_TO_SHOW = 3;
export const MAX_STORY_LENGTH = 1500;

export type PublicTestimonial = {
  id: string;
  publicName: string;
  ageRange: string | null;
  story: string;
};

// Returns approved testimonials in the given locale. Empty array (callers
// should not render the block) if there are fewer than MIN_TESTIMONIALS_TO_SHOW.
export async function getApprovedTestimonials(locale: string): Promise<PublicTestimonial[]> {
  const rows = await prisma.testimonial.findMany({
    where: { status: 'approved', locale },
    orderBy: { approvedAt: 'desc' },
    select: {
      id: true,
      publicName: true,
      ageRange: true,
      story: true,
    },
    take: 12,
  });
  if (rows.length < MIN_TESTIMONIALS_TO_SHOW) return [];
  return rows;
}
