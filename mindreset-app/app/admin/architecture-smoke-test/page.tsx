'use client';

// PR η Step 2b — admin browser page for the A-full architecture smoke test.
// One button. Fires the API route which does the real Anthropic call.
// Displays the pass/fail table + the model's reply text + the tool input.
//
// This exists ONLY so Julia can prove the API delivers what the docs say
// before we refactor the route handler. Not linked from the main admin
// nav — reached via direct URL or the /admin/telemetry cross-reference
// added below.

import { useState } from 'react';

type Check = {
  label: string;
  value: string;
  pass: boolean;
};

type Result = {
  ok: boolean;
  criticalPass?: boolean;
  overall?: string;
  visibleReply?: string;
  checks?: Check[];
  usage?: unknown;
  toolInput?: unknown;
  timing?: {
    ttfbMs: number | null;
    totalMs: number;
  };
  error?: string;
  message?: string;
  stack?: string | null;
};

export default function ArchitectureSmokeTestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function runSmoke() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/journey-architecture-smoke', {
        method: 'POST',
      });
      const data = (await res.json()) as Result;
      setResult(data);
    } catch (err) {
      setResult({
        ok: false,
        error: 'client_error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Engineering
      </div>
      <h1 className="text-[28px] mb-4 font-medium">
        Architecture smoke test — PR η A-full
      </h1>
      <p className="text-[13px] leading-[1.65] text-neutral-600 mb-6 max-w-2xl">
        One click fires a single real call to Sonnet 4-6 with the new strict
        tool + adaptive extended thinking. Verifies that the API delivers
        what the docs say — tool call happens, required fields present,
        no leak into text stream. This runs BEFORE the route handler is
        refactored, so if anything fails we stop and reassess. About $0.05
        per run. Nothing is persisted.
      </p>

      <button
        onClick={runSmoke}
        disabled={loading}
        className="mb-8 px-5 py-2 bg-neutral-900 text-white rounded-md text-[13px] font-medium hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Running…' : 'Run smoke test'}
      </button>

      {result && (
        <div className="space-y-6">
          {/* Overall verdict */}
          {result.overall && (
            <div
              className={`border rounded-lg p-4 ${
                result.criticalPass
                  ? 'border-green-300 bg-green-50 text-green-900'
                  : 'border-red-300 bg-red-50 text-red-900'
              }`}
            >
              <div className="text-[11px] uppercase tracking-[0.12em] mb-1 opacity-70">
                Overall
              </div>
              <div className="text-[15px] font-medium">{result.overall}</div>
            </div>
          )}

          {/* Error case */}
          {!result.ok && (
            <div className="border border-red-300 bg-red-50 text-red-900 rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-[0.12em] mb-1 opacity-70">
                Error
              </div>
              <div className="text-[13px] font-mono">
                {result.error}: {result.message}
              </div>
              {result.stack && (
                <pre className="mt-3 text-[11px] overflow-x-auto bg-white p-2 rounded border border-red-200 whitespace-pre-wrap">
                  {result.stack}
                </pre>
              )}
            </div>
          )}

          {/* Model's visible reply */}
          {result.visibleReply !== undefined && (
            <div className="border border-neutral-200 rounded-lg p-5 bg-white">
              <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-3">
                Model's reply (what would stream to a user)
              </div>
              <div className="text-[13px] leading-[1.65] text-neutral-900 whitespace-pre-wrap">
                {result.visibleReply || <em className="text-neutral-500">(empty)</em>}
              </div>
            </div>
          )}

          {/* Per-criterion pass/fail table */}
          {result.checks && (
            <div className="border border-neutral-200 rounded-lg p-5 bg-white">
              <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-3">
                Checks
              </div>
              <table className="w-full text-[13px]">
                <tbody>
                  {result.checks.map((c) => (
                    <tr
                      key={c.label}
                      className="border-b border-neutral-100 last:border-b-0"
                    >
                      <td className="py-2 pr-4 text-neutral-700 w-8">
                        {c.pass ? '✅' : '❌'}
                      </td>
                      <td className="py-2 pr-4 text-neutral-700 w-1/2">
                        {c.label}
                      </td>
                      <td className="py-2 text-neutral-900 font-mono text-[12px]">
                        {c.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Usage */}
          {result.usage && (
            <div className="border border-neutral-200 rounded-lg p-5 bg-white">
              <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-3">
                Token usage (billing)
              </div>
              <pre className="text-[12px] font-mono overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(result.usage, null, 2)}
              </pre>
            </div>
          )}

          {/* Tool input the model produced */}
          {result.toolInput !== undefined && (
            <div className="border border-neutral-200 rounded-lg p-5 bg-white">
              <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-3">
                Tool input the model produced
              </div>
              <pre className="text-[12px] font-mono overflow-x-auto whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                {JSON.stringify(result.toolInput, null, 2)}
              </pre>
            </div>
          )}

          {/* Copy-friendly single blob for pasting into chat */}
          <div className="border border-dashed border-neutral-300 rounded-lg p-5 bg-white">
            <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-3">
              Copy everything (paste to Claude)
            </div>
            <textarea
              readOnly
              className="w-full h-32 font-mono text-[11px] p-3 border border-neutral-200 rounded bg-neutral-50"
              value={JSON.stringify(result, null, 2)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
