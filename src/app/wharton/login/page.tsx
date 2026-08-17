'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Only ever a same-site path, and only one we own: an open redirect here would
  // let a link that looks like ours land someone somewhere else after login.
  const nextParam = params.get('next');
  const next = nextParam && /^\/wharton(\/|$)/.test(nextParam) ? nextParam : '/wharton';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/wharton/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? 'Something went wrong. Please try again.');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-[#161b22] border border-white/10 rounded-xl p-6 sm:p-7">
      <label htmlFor="password" className="block text-sm text-gray-300 mb-2">
        Access password
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={e => setPassword(e.target.value)}
        className="w-full bg-[#0d1117] border border-white/15 rounded-lg px-3 py-2.5 text-white
                   placeholder-gray-600 focus:outline-none focus:border-blue-500"
        placeholder="Enter the password you were given"
      />

      {error && (
        <p role="alert" className="text-sm text-red-400 mt-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || password.length === 0}
        className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600
                   text-white font-medium rounded-lg px-4 py-2.5 transition-colors"
      >
        {busy ? 'Checking…' : 'View dashboard'}
      </button>

      <p className="text-xs text-gray-500 mt-4">
        You&apos;ll stay signed in on this browser for 30 days.
      </p>
    </form>
  );
}

export default function WhartonLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
          Wall Street Prep
        </p>
        <h1 className="text-2xl font-semibold mt-1.5 mb-6">Wharton Online — Enrollments</h1>
        <Suspense fallback={<div className="h-56" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
