import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Locale-aware wrappers around next/link, next/navigation. Anywhere we
// currently use `import Link from 'next/link'` or `redirect from
// 'next/navigation'`, switch to this module so URLs auto-prefix the
// active locale (e.g. redirect('/screening') from a /ru/sign-up page
// becomes a redirect to /ru/screening).
//
// Phase i18n.1a updates only auth-flow-critical call sites (sign-up
// gate redirects, /account → /sign-in redirect). Phase i18n.1b sweeps
// the remaining <Link> sites.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
