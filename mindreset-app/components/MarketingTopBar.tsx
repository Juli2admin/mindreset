'use client';

// Marketing-surface TopBar wrapper. Public pages (about, faq, terms,
// privacy, journal, alternatives, vs/*, share-your-story) are server
// components that can't call useUser() directly. This thin client shim
// lets each of them render an auth-aware right slot:
//   - signed-in visitor → <UserButton /> so they can jump to Manage
//     account / Sign out (same as /home / chat surfaces).
//   - signed-out visitor → nothing (marketing nav + wordmark cover the
//     conversion path; adding a "Sign in" text link here would triple
//     the CTA count next to the marketing nav).
//
// Matches the same pattern PricingClient already uses inline:
//   <TopBar showMarketingNav right={isSignedIn ? <UserButton /> : null} />
// so this is not a new visual pattern, just a shared implementation.

import { UserButton, useUser } from '@clerk/nextjs';
import TopBar from './TopBar';

type Props = {
  /** Forwards to TopBar.showTreeMark. Landing has its own bespoke Header
   *  so this stays off by default; marketing pages currently pass nothing. */
  showTreeMark?: boolean;
};

export default function MarketingTopBar({ showTreeMark = false }: Props) {
  const { isSignedIn } = useUser();
  return (
    <TopBar
      showTreeMark={showTreeMark}
      showMarketingNav
      right={isSignedIn ? <UserButton /> : null}
    />
  );
}
