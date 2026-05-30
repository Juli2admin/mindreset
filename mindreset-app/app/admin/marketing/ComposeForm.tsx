'use client';

import { useState } from 'react';

// Compose form with a Send-state guard. Disables itself while the
// server action is in flight so accidental double-clicks don't trigger
// duplicate sends. There's no client-side recipient resolution — the
// server action picks the audience live at send time, so this form
// can't lie about who the email reaches.

type Props = {
  action: (formData: FormData) => Promise<void>;
  disabled?: boolean;
};

export default function ComposeForm({ action, disabled }: Props) {
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  return (
    <form
      action={action}
      onSubmit={() => setSending(true)}
      className="border border-neutral-200 rounded-lg bg-white p-5 space-y-4"
    >
      <div>
        <label className="block text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-1">
          Subject
        </label>
        <input
          name="subject"
          type="text"
          required
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={disabled || sending}
          placeholder="A short, honest subject line"
          className="w-full text-[14px] border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:border-neutral-500 disabled:bg-neutral-50 disabled:text-neutral-500"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-1">
          Body
        </label>
        <textarea
          name="body"
          required
          rows={12}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={disabled || sending}
          placeholder="Write in plain text. The unsubscribe link is appended automatically — don't include one in your body."
          className="w-full text-[14px] border border-neutral-300 rounded p-3 focus:outline-none focus:border-neutral-500 font-sans leading-[1.6] disabled:bg-neutral-50 disabled:text-neutral-500"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-neutral-500">
          {disabled
            ? 'No opted-in users to send to yet.'
            : sending
              ? 'Sending — do not navigate away.'
              : 'Sends to every opted-in user at the moment you click. No preview, no recall.'}
        </span>
        <button
          type="submit"
          disabled={disabled || sending || subject.trim() === '' || body.trim() === ''}
          className="bg-neutral-900 text-white px-5 py-2 rounded-full text-[13px] hover:bg-neutral-700 disabled:bg-neutral-300 disabled:cursor-not-allowed"
        >
          {sending ? 'Sending…' : 'Send campaign'}
        </button>
      </div>
    </form>
  );
}
