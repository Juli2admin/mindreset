'use client';

// Marketing-surface TopBar wrapper. Public pages (about, faq, terms,
// privacy, journal, alternatives, vs/*, share-your-story) are server
// components that can't call useUser() directly, so this thin client
// shim adds an auth-aware right slot:
//   - signed-in visitor → "Account" link → /home
//   - signed-out visitor → "Sign in" link → /sign-in
//
// Mirrors the pattern Landing's bespoke Header (components/Landing.jsx)
// already uses — text link only, no UserButton. The reason we don't drop
// the plain <UserButton /> here (as PricingClient does today) is that its
// popover only offers "Manage account" / "Sign out" — no direct route to
// /home. On a marketing page a signed-in visitor's primary need is to
// get back to their space in one click; the text link delivers that,
// and account management can happen from /home where UserButton lives.

import { useTranslations } from 'next-intl';
import { useUser } from '@clerk/nextjs';
import { Link } from '@/i18n/navigation';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';
import TopBar from './TopBar';

export default function MarketingTopBar() {
  const t = useTranslations('TopBar');
  const { palette: PALETTE } = useTheme();
  const { isLoaded, isSignedIn } = useUser();
  // isLoaded gate avoids the pre-hydration "Sign in" flash when the user is
  // in fact signed in. Renders nothing until Clerk resolves; on marketing
  // surfaces the right slot briefly being empty is quieter than swapping
  // link text after mount.
  const authLink = isLoaded ? (
    <Link
      href={isSignedIn ? '/home' : '/sign-in'}
      className="text-[13px] transition-colors hover:underline underline-offset-2"
      style={{ fontFamily: TOKENS.sans, color: PALETTE.textMuted }}
    >
      {isSignedIn ? t('account') : t('signIn')}
    </Link>
  ) : null;
  return <TopBar showMarketingNav right={authLink} />;
}
