// /account → /home redirect.
//
// /account was the user's post-sign-up landing page until /home replaced
// it (see /home/page.tsx). This redirect is kept so any external link or
// bookmark to /account (e.g. from the welcome email sent before /home
// existed) still lands the user in the right place. Locale-aware: a
// request to /ru/account redirects to /ru/home, etc.
import { redirect } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

export default function AccountPage({
  params,
}: {
  params: { locale: string };
}) {
  redirect({ href: '/home', locale: params.locale });
}
