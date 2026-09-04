import { Route, Routes } from 'react-router-dom';
import { apiHealth } from '@/lib/api';
import { useEffect, useState } from 'react';

/**
 * Scaffold only — no features yet.
 *
 * This page exists to prove the pipeline end to end: the client builds, routes
 * resolve, Tailwind compiles, and the dev proxy reaches the API. Stage 2
 * replaces it with the real application flow.
 */
function Placeholder() {
  const [api, setApi] = useState('checking…');

  useEffect(() => {
    apiHealth()
      .then((r) => setApi(r.ok ? 'reachable' : 'responded, but not ok'))
      .catch(() => setApi('not reachable (is the server running?)'));
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-700">
        FAC Recruitment Portal
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Scaffold</h1>
      <p className="mt-3 text-slate-600">
        No features yet. Stage 1 adds the data model; stage 2 the application flow.
      </p>
      <dl className="mt-8 grid gap-2 rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Client build</dt>
          <dd className="font-medium text-emerald-700">working</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">API</dt>
          <dd className="font-medium">{api}</dd>
        </div>
      </dl>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<Placeholder />} />
    </Routes>
  );
}
