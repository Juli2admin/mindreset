export const dynamic = 'force-dynamic';

export default function AdminSupport() {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Support emails
      </div>
      <h1 className="text-[28px] mb-6 font-medium">Inbound queue</h1>

      <div className="border border-dashed border-neutral-300 rounded-lg p-8 bg-white text-center">
        <p className="text-[14px] text-neutral-500 mb-2">Wired in PR 2.</p>
        <p className="text-[13px] text-neutral-400 leading-[1.6] max-w-md mx-auto">
          Inbound emails to <code className="font-mono">support@mindreset.ai</code> will
          land here. AI categorises, drafts a reply in the sender&apos;s locale,
          and queues it for your approval. Auto-send turns on for whitelisted
          routine intents once classification quality is validated.
        </p>
      </div>

      <div className="mt-8 text-[13px] text-neutral-600 leading-[1.65]">
        <p className="font-medium mb-2">What this section will show when live:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>List of pending inbound emails, sorted by urgency</li>
          <li>AI-detected category (billing / emotional / methodology / crisis / other)</li>
          <li>Draft reply with edit-before-send</li>
          <li>Audit log of approved + auto-sent replies</li>
          <li>Sev-5 safety alerts from MiniMind&apos;s scanner</li>
        </ul>
      </div>
    </div>
  );
}
