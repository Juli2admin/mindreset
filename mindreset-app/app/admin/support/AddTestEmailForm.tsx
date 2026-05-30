'use client';

import { useState } from 'react';

// Test-data form for the support queue. Lets admin manually create a
// SupportEmail row so the UI can be driven without real inbound. PR 2c
// will remove this and wire Resend Inbound for the real flow.

type Props = {
  action: (formData: FormData) => Promise<void>;
};

export default function AddTestEmailForm({ action }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-neutral-200 rounded-lg bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 text-[13px] text-neutral-600 hover:text-neutral-900 flex items-center justify-between"
      >
        <span>
          {open ? '−' : '+'} Add test email (simulates an inbound)
        </span>
        <span className="text-[11px] text-neutral-400">PR 2a only</span>
      </button>
      {open && (
        <form action={action} className="border-t border-neutral-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-1">
                From email
              </label>
              <input
                name="fromEmail"
                type="email"
                required
                placeholder="user@example.com"
                className="w-full text-[13px] border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-1">
                From name (optional)
              </label>
              <input
                name="fromName"
                type="text"
                placeholder="Anna Petrova"
                className="w-full text-[13px] border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:border-neutral-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-1">
              Subject
            </label>
            <input
              name="subject"
              type="text"
              required
              placeholder="Question about my subscription"
              className="w-full text-[13px] border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:border-neutral-500"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-1">
              Body
            </label>
            <textarea
              name="bodyText"
              required
              rows={6}
              placeholder="Hi, I subscribed last week but..."
              className="w-full text-[13px] border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:border-neutral-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="bg-neutral-900 text-white px-5 py-2 rounded-full text-[13px] hover:bg-neutral-700"
          >
            Add to queue
          </button>
        </form>
      )}
    </div>
  );
}
