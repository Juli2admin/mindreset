export const dynamic = 'force-dynamic';

export default function AdminMarketing() {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Marketing emails
      </div>
      <h1 className="text-[28px] mb-6 font-medium">Audiences and campaigns</h1>

      <div className="border border-dashed border-neutral-300 rounded-lg p-8 bg-white text-center">
        <p className="text-[14px] text-neutral-500 mb-2">Wired in PR 3.</p>
        <p className="text-[13px] text-neutral-400 leading-[1.6] max-w-md mx-auto">
          Resend Audiences will sync here so you can segment subscribers,
          compose campaigns (welcome flow, win-back, milestone, newsletter),
          preview, send, and see open / click stats.
        </p>
      </div>

      <div className="mt-8 text-[13px] text-neutral-600 leading-[1.65]">
        <p className="font-medium mb-2">What this section will show when live:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Audience list with segments (locale, tier, last active, sign-up date)</li>
          <li>Compose page — optional AI draft, template library, preview</li>
          <li>Send + audit log + delivery / open / click stats</li>
          <li>GDPR-compliant unsubscribe management</li>
          <li>Newsletter signup form embed (for non-customers)</li>
        </ul>
      </div>
    </div>
  );
}
