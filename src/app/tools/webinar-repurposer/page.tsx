"use client";

import { useState } from "react";
import { Mic } from "lucide-react";
import type { ContentPack } from "@/lib/repurposer/schema";
import { TranscriptForm } from "@/components/repurposer/TranscriptForm";
import { ContentPackView } from "@/components/repurposer/ContentPackView";

export default function WebinarRepurposerPage() {
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [pack, setPack] = useState<ContentPack | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setPack(null);
    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const text = await res.text();
      const contentType = res.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        const snippet = text.slice(0, 300);
        if (res.status === 504 || /timed out|timeout/i.test(text)) {
          setError(
            "Generation timed out at the platform layer. Try a shorter transcript, or split a long one in half.",
          );
        } else if (res.status === 413 || /too large|payload/i.test(text)) {
          setError(
            "Transcript is too large for the API. Try trimming it down.",
          );
        } else {
          setError(
            `Server returned a non-JSON response (HTTP ${res.status}). First 300 chars: ${snippet}`,
          );
        }
        return;
      }

      let data: { contentPack?: ContentPack; error?: string };
      try {
        data = JSON.parse(text);
      } catch {
        setError(
          `Could not parse server response as JSON. HTTP ${res.status}. Body: ${text.slice(0, 300)}`,
        );
        return;
      }

      if (!res.ok) {
        setError(data.error ?? `Generation failed (HTTP ${res.status}).`);
        return;
      }
      if (!data.contentPack) {
        setError("Server response did not include a content pack.");
        return;
      }
      setPack(data.contentPack);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPack(null);
    setError(null);
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 mb-1">
            <Mic size={16} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
              Marketing Tool
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Webinar Repurposer</h1>
          <p className="mt-1.5 text-sm text-gray-600 leading-relaxed max-w-3xl">
            Paste a webinar transcript and get an editable content pack in WSP&rsquo;s voice —
            3 LinkedIn posts, 1 promo email, 5 timestamped pull quotes, and a blog outline.
            Powered by Claude Sonnet 4.6.
          </p>
        </div>
        {pack && (
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
          >
            New webinar
          </button>
        )}
      </header>

      {!pack && (
        <div className="max-w-3xl">
          <TranscriptForm
            transcript={transcript}
            setTranscript={setTranscript}
            onSubmit={generate}
            loading={loading}
          />
          {loading && (
            <div className="mt-6 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              Generating your content pack — usually 15–30 seconds.
            </div>
          )}
          {error && (
            <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}
        </div>
      )}

      {pack && <ContentPackView pack={pack} />}
    </div>
  );
}
