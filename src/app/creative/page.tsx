'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Layers, ChevronDown, MessageSquare, Send, Trash2,
  BarChart2, AlertTriangle, CheckCircle, Clock,
} from 'lucide-react';
import { CREATIVE_PROGRAMS } from '@/data/creativeReviews';
import type { AdConcept, TestingPriority } from '@/data/creativeReviews';

// ── Types ────────────────────────────────────────────────────────────────────

type Comment = {
  id: string;
  adId: string;
  author: string;
  text: string;
  createdAt: string;
};

// ── Priority badge ────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TestingPriority, { label: string; className: string; icon: React.ElementType }> = {
  first:  { label: 'Test First',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  second: { label: 'Test Second', className: 'bg-blue-50 text-blue-700 border-blue-200',         icon: BarChart2 },
  third:  { label: 'Test Third',  className: 'bg-gray-50 text-gray-500 border-gray-200',          icon: Clock },
};

function PriorityBadge({ priority }: { priority: TestingPriority }) {
  const { label, className, icon: Icon } = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${className}`}>
      <Icon size={10} />
      {label}
    </span>
  );
}

// ── Comment section ───────────────────────────────────────────────────────────

function CommentSection({ adId }: { adId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [author, setAuthor] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('creative-reviewer-name') || '' : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/creative-comments?adId=${encodeURIComponent(adId)}`)
      .then(r => r.json())
      .then(setComments)
      .catch(() => {});
  }, [open, adId]);

  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/creative-comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId, author, text }),
    });
    if (res.ok) {
      const c = await res.json();
      setComments(prev => [...prev, c]);
      setText('');
      if (author) localStorage.setItem('creative-reviewer-name', author);
    }
    setSubmitting(false);
  };

  const remove = async (id: string) => {
    await fetch(`/api/creative-comments?id=${id}`, { method: 'DELETE' });
    setComments(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="border-t border-gray-100 mt-4 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
      >
        <MessageSquare size={12} />
        {comments.length > 0 || open
          ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}`
          : 'Leave feedback'}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {comments.length > 0 && (
            <div className="space-y-2">
              {comments.map(c => (
                <div key={c.id} className="bg-gray-50 rounded-lg p-2.5 text-sm group relative">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-medium text-gray-700 text-xs">{c.author || 'Anonymous'}</span>
                    <span className="text-gray-300 text-xs">·</span>
                    <span className="text-gray-400 text-xs">
                      {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-gray-700 text-xs leading-relaxed">{c.text}</p>
                  <button
                    onClick={() => remove(c.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <input
              type="text"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Your name"
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
            />
            <div className="flex gap-1.5">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
                placeholder="Add a comment… (⌘↵ to submit)"
                rows={2}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 resize-none bg-white"
              />
              <button
                onClick={submit}
                disabled={submitting || !text.trim()}
                className="self-end p-1.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white rounded-lg transition-colors"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ad card ───────────────────────────────────────────────────────────────────

function AdCard({ ad, programId, batchId }: { ad: AdConcept; programId: string; batchId: string }) {
  const adId = `${programId}/${batchId}/${ad.id}`;
  const [imgExpanded, setImgExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {/* Image */}
      <div
        className="relative bg-gray-50 cursor-zoom-in"
        style={{ aspectRatio: '1 / 1' }}
        onClick={() => setImgExpanded(true)}
      >
        <Image
          src={ad.image}
          alt={ad.name}
          fill
          className="object-contain p-2"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute top-2 left-2">
          <span className="bg-white/90 backdrop-blur-sm text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full border border-gray-200">
            #{ad.id}
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <PriorityBadge priority={ad.testingPriority} />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1">{ad.name}</h3>
        <div className="flex flex-wrap gap-1 mb-3">
          <span className="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
            {ad.format}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          <span className="font-medium text-gray-600">Audience:</span> {ad.audience}
        </p>

        {/* Rationale */}
        <ul className="space-y-1.5 flex-1">
          {ad.rationale.map((point, i) => (
            <li key={i} className="flex gap-2 text-xs text-gray-600 leading-relaxed">
              <span className="text-emerald-500 font-bold mt-0.5 shrink-0">·</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <CommentSection adId={adId} />
      </div>

      {/* Lightbox */}
      {imgExpanded && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8 cursor-zoom-out"
          onClick={() => setImgExpanded(false)}
        >
          <div className="relative max-w-2xl w-full max-h-[90vh] aspect-square">
            <Image
              src={ad.image}
              alt={ad.name}
              fill
              className="object-contain"
              sizes="800px"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Batch summary card ────────────────────────────────────────────────────────

function BatchSummary({ batch }: { batch: (typeof CREATIVE_PROGRAMS)[0]['batches'][0] }) {
  return (
    <div className="bg-gray-900 text-white rounded-2xl p-6 mb-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{batch.label}</p>
          <p className="text-base font-medium text-white leading-relaxed max-w-3xl">{batch.summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-white/10">
        {batch.performanceContext.map(p => (
          <div key={p.metric}>
            <p className="text-xs text-gray-400">{p.metric}</p>
            <p className="text-sm font-semibold text-white">{p.value}</p>
            {p.note && <p className="text-xs text-amber-400 mt-0.5">{p.note}</p>}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t border-white/10">
        <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-300 leading-relaxed">{batch.creativeGap}</p>
      </div>
    </div>
  );
}

// ── Filter controls ───────────────────────────────────────────────────────────

const PRIORITY_FILTERS: { value: TestingPriority | 'all'; label: string }[] = [
  { value: 'all',    label: 'All ads' },
  { value: 'first',  label: 'Test First' },
  { value: 'second', label: 'Test Second' },
  { value: 'third',  label: 'Test Third' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CreativePage() {
  const [activeProgramId, setActiveProgramId] = useState(CREATIVE_PROGRAMS[0].id);
  const [activeBatchId, setActiveBatchId]     = useState(CREATIVE_PROGRAMS[0].batches[0].id);
  const [priorityFilter, setPriorityFilter]   = useState<TestingPriority | 'all'>('all');

  const program = CREATIVE_PROGRAMS.find(p => p.id === activeProgramId) ?? CREATIVE_PROGRAMS[0];
  const batch   = program.batches.find(b => b.id === activeBatchId) ?? program.batches[0];

  const visibleAds = priorityFilter === 'all'
    ? batch.ads
    : batch.ads.filter(a => a.testingPriority === priorityFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Creative Review</h1>
        <p className="text-gray-500 mt-0.5">Ad concepts with strategic rationale and team feedback.</p>
      </div>

      {/* Program tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {CREATIVE_PROGRAMS.map(p => (
          <button
            key={p.id}
            onClick={() => {
              setActiveProgramId(p.id);
              setActiveBatchId(p.batches[0].id);
              setPriorityFilter('all');
            }}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              activeProgramId === p.id
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Batch + filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Batch selector */}
        <div className="flex gap-1.5">
          {program.batches.map(b => (
            <button
              key={b.id}
              onClick={() => { setActiveBatchId(b.id); setPriorityFilter('all'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-colors ${
                activeBatchId === b.id
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium'
                  : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <Layers size={13} />
              {b.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        {/* Priority filter */}
        <div className="flex gap-1.5">
          {PRIORITY_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setPriorityFilter(f.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                priorityFilter === f.value
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-gray-400">
          {visibleAds.length} ad{visibleAds.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Batch summary */}
      <BatchSummary batch={batch} />

      {/* Ad grid */}
      {visibleAds.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No ads match this filter.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleAds.map(ad => (
            <AdCard key={ad.id} ad={ad} programId={activeProgramId} batchId={activeBatchId} />
          ))}
        </div>
      )}
    </div>
  );
}
