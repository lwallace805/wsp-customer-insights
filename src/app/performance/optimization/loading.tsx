// Segment-level loading boundary. Without this, clicking the nav link to this
// force-dynamic route gives no feedback — the router silently waits on the
// server render (the snapshot fetch + AI briefing), so the button looks dead.
// This skeleton shows instantly on navigation while the page streams in.

export default function OptimizationLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="h-6 w-56 rounded bg-white/10 mb-2" />
          <div className="h-3 w-80 rounded bg-white/5" />
        </div>
        <div className="h-7 w-40 rounded-lg bg-white/5" />
      </div>

      {/* Severity summary */}
      <div className="flex gap-4 flex-wrap mb-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-[#161b22] border border-white/10 rounded-xl px-5 py-4 flex items-center gap-3 flex-1 min-w-[160px]"
          >
            <div className="h-5 w-5 rounded bg-white/10" />
            <div>
              <div className="h-6 w-8 rounded bg-white/10 mb-1.5" />
              <div className="h-3 w-16 rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>

      {/* Insight card skeletons */}
      <div className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-[#161b22] border border-white/10 rounded-xl p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="h-4 w-2/3 rounded bg-white/10" />
              <div className="h-4 w-20 rounded-full bg-white/5" />
            </div>
            <div className="space-y-2 ml-7">
              <div className="h-3 w-full rounded bg-white/5" />
              <div className="h-3 w-5/6 rounded bg-white/5" />
            </div>
            <div className="h-8 w-full rounded-lg bg-white/[0.04] mt-3 ml-7" />
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-gray-500">Loading optimization priorities…</p>
    </div>
  );
}
