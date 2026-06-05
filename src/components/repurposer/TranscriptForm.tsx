"use client";

import { FormEvent } from "react";

type Props = {
  transcript: string;
  setTranscript: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
};

export function TranscriptForm({
  transcript,
  setTranscript,
  onSubmit,
  loading,
}: Props) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!loading && transcript.trim().length > 0) onSubmit();
  }

  const charCount = transcript.length;
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  const tooShort = transcript.length > 0 && transcript.length < 200;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-900">
          Webinar transcript
        </span>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste the full transcript here. Speaker names and timestamps are fine — we keep them."
          rows={14}
          disabled={loading}
          className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
        />
      </label>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {wordCount.toLocaleString()} words · {charCount.toLocaleString()} chars
          {tooShort && (
            <span className="ml-2 text-amber-600">
              (paste at least a few paragraphs)
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || transcript.trim().length === 0}
          className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? "Generating…" : "Generate content pack"}
        </button>
      </div>
    </form>
  );
}
