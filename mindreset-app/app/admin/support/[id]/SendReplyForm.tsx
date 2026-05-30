'use client';

import { useState } from 'react';

// Client-side editable textarea + send button. Server action handles
// the Resend call + Purchase row creation; this component is purely
// the form UI and a "Sending..." pending state.

type Props = {
  id: string;
  initialDraft: string;
  action: (formData: FormData) => Promise<void>;
  disabled?: boolean;
};

export default function SendReplyForm({ id, initialDraft, action, disabled }: Props) {
  const [draft, setDraft] = useState(initialDraft);
  const [sending, setSending] = useState(false);

  return (
    <form
      action={action}
      onSubmit={() => setSending(true)}
      className="space-y-3"
    >
      <input type="hidden" name="id" value={id} />
      <textarea
        name="draft"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={Math.max(8, draft.split('\n').length + 1)}
        disabled={disabled || sending}
        className="w-full text-[13px] border border-neutral-300 rounded p-3 focus:outline-none focus:border-neutral-500 font-sans leading-[1.6] disabled:bg-neutral-50 disabled:text-neutral-500"
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-neutral-500">
          {disabled
            ? 'Already replied — re-run AI to send another.'
            : 'You can edit before sending.'}
        </span>
        <button
          type="submit"
          disabled={disabled || sending || draft.trim().length === 0}
          className="bg-neutral-900 text-white px-5 py-2 rounded-full text-[13px] hover:bg-neutral-700 disabled:bg-neutral-300 disabled:cursor-not-allowed"
        >
          {sending ? 'Sending…' : 'Send reply'}
        </button>
      </div>
    </form>
  );
}
