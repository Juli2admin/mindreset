import '../globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ClerkProvider, SignOutButton } from '@clerk/nextjs';
import { currentUserIsAdmin } from '@/lib/admin/auth';

// Admin panel lives at /admin — outside [locale] because it's English-only
// internal tooling. Auth flow: middleware enforces Clerk sign-in for the
// whole /admin tree; this layout then enforces the email allowlist gate
// (ADMIN_EMAILS env var). Non-admin signed-in users get a 404 — not a 401
// — so the existence of /admin is not advertised to the public.
//
// Self-contained layout: renders its own <html>/<body>/ClerkProvider
// because the [locale] layout (which owns those on customer surfaces)
// does not run for /admin paths. The root app/layout.tsx is a passthrough.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'MindReset Admin',
  robots: { index: false, follow: false },
};

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/support', label: 'Support emails' },
  { href: '/admin/testimonials', label: 'Testimonials' },
  { href: '/admin/marketing', label: 'Marketing emails' },
  { href: '/admin/telemetry', label: 'Telemetry' },
  { href: '/admin/subscriptions', label: 'Subscriptions' },
  { href: '/admin/promo-codes', label: 'Promo codes' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!(await currentUserIsAdmin())) {
    notFound();
  }

  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <div className="min-h-screen flex bg-neutral-50 text-neutral-900">
            <aside className="w-60 shrink-0 border-r border-neutral-200 bg-white relative">
              <div className="px-5 py-5 border-b border-neutral-200">
                <Link href="/admin" className="text-[15px] font-semibold tracking-tight">
                  MindReset
                  <span className="text-neutral-500 font-normal"> · Admin</span>
                </Link>
              </div>
              <nav className="py-2">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-5 py-2 text-[14px] hover:bg-neutral-100 transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="absolute bottom-4 left-5">
                <SignOutButton>
                  <button className="text-[12px] text-neutral-500 hover:text-neutral-900">
                    Sign out
                  </button>
                </SignOutButton>
              </div>
            </aside>
            <main className="flex-1 px-10 py-8">{children}</main>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
