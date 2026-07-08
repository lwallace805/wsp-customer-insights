'use client';

// Full-width warning shown on any tab (or tab state) whose numbers are NOT
// live. Illustrative data must be unmissable — a footnote is not enough.
export default function ProFormaBanner({ note }: { note?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <span className="mt-0.5 text-amber-400 text-base leading-none">⚠</span>
      <div>
        <p className="text-sm font-semibold text-amber-300 uppercase tracking-wide">
          Pro forma — illustrative data, not live
        </p>
        <p className="text-xs text-amber-200/70 mt-0.5">
          {note ?? 'The numbers below are placeholders for reviewing the structure. Do not use them for decisions — live wiring is tracked in the build plan.'}
        </p>
      </div>
    </div>
  );
}
