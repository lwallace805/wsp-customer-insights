'use client';

import { useState } from 'react';
import {
  Phone, CheckCircle2, AlertTriangle, XCircle, Copy, Check,
  ChevronDown, ExternalLink, ClipboardList, MessageSquareQuote,
  ListChecks, Clock, HelpCircle, ShieldQuestion, BookOpen, Info,
  FileText,
} from 'lucide-react';
import {
  EMPLOYERS, PROGRAM_META, VERDICT_LEGEND, CROSS_EMPLOYER_SUMMARY,
  CROSS_EMPLOYER_NOTE, UNIVERSAL_TALKING_POINTS, TOP_QUESTIONS,
  OBJECTIONS, SOURCES, BRIGHT_HORIZONS_LOC, PROOF_POINTS, type Verdict, type Employer,
} from './data';

/* ── Verdict color system ──────────────────────────────────────── */
const VERDICT_STYLES: Record<
  Verdict,
  {
    dot: string;
    pillActive: string;
    banner: string;
    bannerText: string;
    icon: typeof CheckCircle2;
    iconColor: string;
    badge: string;
  }
> = {
  clear: {
    dot: 'bg-emerald-500',
    pillActive: 'bg-emerald-600 text-white border-emerald-600',
    banner: 'bg-emerald-50 border-emerald-200',
    bannerText: 'text-emerald-900',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  likely: {
    dot: 'bg-amber-500',
    pillActive: 'bg-amber-500 text-white border-amber-500',
    banner: 'bg-amber-50 border-amber-200',
    bannerText: 'text-amber-900',
    icon: AlertTriangle,
    iconColor: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-800',
  },
  difficult: {
    dot: 'bg-red-500',
    pillActive: 'bg-red-600 text-white border-red-600',
    banner: 'bg-red-50 border-red-200',
    bannerText: 'text-red-900',
    icon: XCircle,
    iconColor: 'text-red-600',
    badge: 'bg-red-100 text-red-700',
  },
};

/* ── Copy-to-clipboard button ──────────────────────────────────── */
function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      className={`inline-flex items-center gap-1.5 shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
        copied
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
      }`}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

/* ── Section heading ───────────────────────────────────────────── */
function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: typeof CheckCircle2;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={16} className="text-gray-400" />
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {children}
      </h3>
    </div>
  );
}

/* ── Employer detail view ──────────────────────────────────────── */
function EmployerDetail({ e }: { e: Employer }) {
  const v = VERDICT_STYLES[e.verdict];
  const VIcon = v.icon;
  const allPitch = e.managerPitch.map((p) => `• ${p}`).join('\n\n');

  return (
    <div className="space-y-6">
      {/* Verdict banner */}
      <div className={`rounded-2xl border ${v.banner} p-5`}>
        <div className="flex items-start gap-3">
          <VIcon size={24} className={`${v.iconColor} shrink-0 mt-0.5`} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold text-gray-900">{e.name}</span>
              <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${v.badge}`}>
                {e.verdictWord}
              </span>
            </div>
            <p className={`mt-1 font-semibold ${v.bannerText}`}>{e.verdictHeadline}.</p>
            <p className="mt-0.5 text-sm text-gray-700">{e.verdictSummary}</p>
          </div>
        </div>
      </div>

      {/* Recommended path */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
        <SectionHeading icon={ListChecks}>Recommended path</SectionHeading>
        <p className="text-[15px] leading-relaxed text-gray-800 font-medium">
          {e.recommendedPath}
        </p>
      </div>

      {/* At a glance */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
        <SectionHeading icon={Info}>At a glance</SectionHeading>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {e.atAGlance.map((row) => (
            <div key={row.label} className="border-b border-gray-100 pb-3 last:border-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {row.label}
              </dt>
              <dd className="mt-0.5 text-sm text-gray-800 leading-snug">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Manager pitch — copyable */}
      <div className="rounded-2xl border border-violet-200 bg-violet-50/40 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="flex items-center gap-2">
            <MessageSquareQuote size={16} className="text-violet-500" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-700">
              What to say — manager pitch
            </h3>
          </div>
          <CopyButton text={allPitch} label="Copy all" />
        </div>
        <ul className="space-y-2.5">
          {e.managerPitch.map((p, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl bg-white border border-violet-100 p-3"
            >
              <p className="text-[15px] leading-relaxed text-gray-800 flex-1">
                &ldquo;{p}&rdquo;
              </p>
              <CopyButton text={p} />
            </li>
          ))}
        </ul>
      </div>

      {/* Two-column: approval steps + timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <SectionHeading icon={ClipboardList}>How to get approval</SectionHeading>
          <ol className="space-y-2.5">
            {e.approvalSteps.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">{s}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <SectionHeading icon={Clock}>Timeline &amp; paperwork</SectionHeading>
          <ul className="space-y-2.5">
            {e.timeline.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300 mt-2" />
                <p className="text-sm text-gray-700 leading-relaxed">{t}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Will X cover this */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
        <SectionHeading icon={HelpCircle}>
          Will {e.name} cover the AI for Business &amp; Finance Certificate?
        </SectionHeading>
        <ul className="space-y-2.5">
          {e.willCover.map((c, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300 mt-2" />
              <p className="text-sm text-gray-700 leading-relaxed">{c}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Gaps */}
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5">
        <SectionHeading icon={ShieldQuestion}>
          Gaps — verify or have the employee confirm with HR
        </SectionHeading>
        <ul className="space-y-1.5">
          {e.gaps.map((g, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400 mt-2" />
              <p className="text-sm text-gray-600 leading-relaxed">{g}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── Collapsible block (for Quick Reference) ───────────────────── */
function Collapsible({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: typeof CheckCircle2;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <Icon size={17} className="text-gray-400" />
          <span className="font-semibold text-gray-900 text-[15px]">{title}</span>
        </span>
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  );
}

/* ── BrightHorizons LOC Workflow ───────────────────────────────── */
function BrightHorizonsLOC() {
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-700 leading-relaxed">{BRIGHT_HORIZONS_LOC.summary}</p>

      {/* Critical flags */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
        <h4 className="text-sm font-semibold text-amber-900 mb-2.5 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-600 shrink-0" />
          Critical flags
        </h4>
        <ul className="space-y-2">
          {BRIGHT_HORIZONS_LOC.criticalFlags.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400 mt-2" />
              <p className="text-sm text-amber-800 leading-relaxed">{f}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Step-by-step workflow */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Step-by-step workflow</h4>
        <ol className="space-y-3">
          {BRIGHT_HORIZONS_LOC.workflow.map((s) => (
            <li key={s.step} className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                {s.step}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-semibold text-gray-900">{s.title}</span>
                  <span className="text-[11px] text-gray-400">({s.actor})</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{s.details}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Two-column: student input fields + invoice requirements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">What students enter when submitting</h4>
          <dl className="space-y-2">
            {BRIGHT_HORIZONS_LOC.studentFields.map((f) => (
              <div key={f.field} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{f.field}</dt>
                <dd className="mt-0.5 text-sm text-gray-800 leading-snug">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Invoice must include</h4>
          <ul className="space-y-2">
            {BRIGHT_HORIZONS_LOC.invoiceRequirements.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300 mt-2" />
                <p className="text-sm text-gray-700 leading-relaxed">{r}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Coaching language — copyable */}
      <div className="rounded-2xl border border-violet-200 bg-violet-50/40 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="flex items-center gap-2">
            <MessageSquareQuote size={16} className="text-violet-500" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-700">
              Coaching language for the advisor call
            </h3>
          </div>
          <CopyButton
            text={BRIGHT_HORIZONS_LOC.coachingLanguage.map((c) => `• ${c}`).join('\n\n')}
            label="Copy all"
          />
        </div>
        <ul className="space-y-2.5">
          {BRIGHT_HORIZONS_LOC.coachingLanguage.map((c, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl bg-white border border-violet-100 p-3"
            >
              <p className="text-[15px] leading-relaxed text-gray-800 flex-1">{c}</p>
              <CopyButton text={c} />
            </li>
          ))}
        </ul>
      </div>

      {/* Applies to */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          Applies to — which employers use this workflow
        </h4>
        <ul className="space-y-1.5">
          {BRIGHT_HORIZONS_LOC.employers.map((e, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300 mt-2" />
              <p className="text-sm text-gray-600 leading-relaxed">{e}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Open questions */}
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5">
        <SectionHeading icon={ShieldQuestion}>
          Open questions — for Aubrey&rsquo;s team to clarify
        </SectionHeading>
        <ul className="space-y-1.5">
          {BRIGHT_HORIZONS_LOC.openQuestions.map((q, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400 mt-2" />
              <p className="text-sm text-gray-600 leading-relaxed">{q}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Internal proof points */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FileText size={16} className="text-gray-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Internal Proof Points (Citi &amp; JPMorgan Chase)
          </h3>
        </div>
        <InternalProofPoints />
      </div>
    </div>
  );
}

/* ── Internal Proof Points ───────────────────────────────────────── */
function InternalProofPoints() {
  return (
    <div className="space-y-5">
      {/* Source attribution */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5">
        <p className="text-xs text-blue-700 leading-relaxed">
          <span className="font-semibold">Source:</span> {PROOF_POINTS.source}
        </p>
      </div>

      {/* Two-column employer cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {PROOF_POINTS.employers.map((emp) => {
          const v = VERDICT_STYLES[emp.verdict];
          const verdictLabel =
            emp.verdict === 'clear' ? 'Clear' : emp.verdict === 'likely' ? 'Likely' : 'Difficult';
          return (
            <div key={emp.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
              {/* Card header */}
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-base font-bold text-gray-900">{emp.name}</span>
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${v.badge}`}
                  >
                    {verdictLabel}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  <span className="font-medium">Administrator:</span>{' '}
                  <span className="font-semibold text-gray-700">{emp.administrator}</span>
                  <span className="text-gray-300 mx-1.5">&middot;</span>
                  <span className="font-mono text-[11px] text-gray-400">{emp.adminUrl}</span>
                </p>
              </div>

              {/* Stats */}
              <dl className="divide-y divide-gray-100">
                {emp.stats.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between gap-3 py-1.5 first:pt-0 last:pb-0"
                  >
                    <dt className="text-xs text-gray-500 leading-tight">{s.label}</dt>
                    <dd className="text-sm font-bold text-gray-900 tabular-nums shrink-0">
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Program mix */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  Program mix
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {emp.programMix.map((pm) => (
                    <span
                      key={pm.program}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 text-gray-600 text-[11px] px-2.5 py-1"
                    >
                      {pm.program}
                      <span className="font-bold text-gray-900">{pm.count}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Recommended path + terms */}
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Recommended path
                </p>
                <p className="text-xs text-gray-700 leading-relaxed">{emp.recommendedPath}</p>
                <p className="text-[11px] text-gray-500">Cap: {emp.cap}</p>
                <p className="text-[11px] text-gray-500">Pre-approval: {emp.preApproval}</p>
              </div>

              {/* Advisor line */}
              <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 flex-1">
                  <MessageSquareQuote size={13} className="text-violet-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-800 leading-relaxed">
                    &ldquo;{emp.advisorLine}&rdquo;
                  </p>
                </div>
                <CopyButton text={emp.advisorLine} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Combined callout */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-6 py-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {PROOF_POINTS.combinedCallout.totalLearners}
            </div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-0.5">
              combined learners
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {PROOF_POINTS.combinedCallout.withSubsidy}
            </div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-0.5">
              employer subsidy on record
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {PROOF_POINTS.combinedCallout.npsPromoters}
            </div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-0.5">
              NPS promoters
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 text-center mt-3 leading-relaxed">
          137 combined learners across both firms, 53 with employer subsidy on record, 24 NPS
          promoters as the warm list for sourcing testimonials.
        </p>
      </div>

      {/* Caveats */}
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2.5">
          Data caveats
        </p>
        <ul className="space-y-1.5">
          {PROOF_POINTS.caveats.map((c, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300 mt-2" />
              <p className="text-xs text-gray-600 leading-relaxed">{c}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── Quick Reference view ──────────────────────────────────────── */
function QuickReference() {
  return (
    <div className="space-y-4">
      {/* Cross-employer summary */}
      <Collapsible title="Cross-employer summary" icon={ListChecks} defaultOpen>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-4 font-semibold">Employer</th>
                <th className="py-2 pr-4 font-semibold">Verdict</th>
                <th className="py-2 pr-4 font-semibold">Cap</th>
                <th className="py-2 pr-4 font-semibold">Platform</th>
                <th className="py-2 font-semibold">Recommended path</th>
              </tr>
            </thead>
            <tbody>
              {CROSS_EMPLOYER_SUMMARY.map((r) => {
                const v = VERDICT_STYLES[r.verdict];
                return (
                  <tr key={r.employer} className="border-t border-gray-100 align-top">
                    <td className="py-3 pr-4 font-semibold text-gray-900 whitespace-nowrap">
                      {r.employer}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${v.dot}`} />
                        <span className="text-gray-700">{r.verdictWord}</span>
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-700">{r.cap}</td>
                    <td className="py-3 pr-4 text-gray-700">{r.platform}</td>
                    <td className="py-3 text-gray-700">{r.recommendedPath}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100">
          {CROSS_EMPLOYER_NOTE}
        </p>
      </Collapsible>

      {/* Universal talking points */}
      <Collapsible title="Universal talking points (all employers)" icon={MessageSquareQuote}>
        <div className="space-y-5">
          {UNIVERSAL_TALKING_POINTS.map((g) => (
            <div key={g.heading}>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">{g.heading}</h4>
              <ul className="space-y-2">
                {g.points.map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300 mt-2" />
                    <p className="text-sm text-gray-700 leading-relaxed">{p}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Collapsible>

      {/* Top inbound questions */}
      <Collapsible title="Top 4 inbound questions" icon={HelpCircle}>
        <div className="space-y-5">
          {TOP_QUESTIONS.map((qa) => (
            <div key={qa.q}>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">{qa.q}</h4>
              <ul className="space-y-2">
                {qa.a.map((line, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300 mt-2" />
                    <p className="text-sm text-gray-700 leading-relaxed">{line}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Collapsible>

      {/* Objection handling */}
      <Collapsible title="Objection handling" icon={ShieldQuestion}>
        <div className="space-y-4">
          {OBJECTIONS.map((o) => (
            <div key={o.objection} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">{o.objection}</p>
              <ul className="space-y-2">
                {o.counters.map((c, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2" />
                    <p className="text-sm text-gray-700 leading-relaxed">{c}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Collapsible>

      {/* Verdict legend */}
      <Collapsible title="Verdict color legend" icon={Info}>
        <ul className="space-y-3">
          {VERDICT_LEGEND.map((l) => {
            const v = VERDICT_STYLES[l.verdict];
            return (
              <li key={l.verdict} className="flex items-start gap-3">
                <span className={`shrink-0 w-3 h-3 rounded-full ${v.dot} mt-1`} />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{l.label}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{l.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Collapsible>

      {/* Sources */}
      <Collapsible title="Sources & references" icon={BookOpen}>
        <div className="space-y-4">
          {SOURCES.map((s) => (
            <div key={s.employer}>
              <h4 className="text-sm font-semibold text-gray-900 mb-1.5">{s.employer}</h4>
              {s.note && (
                <p className="text-xs text-gray-500 italic leading-relaxed mb-2">{s.note}</p>
              )}
              <ul className="space-y-1">
                {s.links.map((l) => (
                  <li key={l.url}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {l.label}
                      <ExternalLink size={12} className="opacity-60" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */
// Sentinel for the default Bright Horizons / EdAssist LOC view (not an employer id).
const BRIGHT_HORIZONS_VIEW = 'bright-horizons';

export default function EmployerReimbursementPage() {
  // BRIGHT_HORIZONS_VIEW = the default LOC workflow; null = Quick Reference;
  // otherwise the selected employer id.
  const [selected, setSelected] = useState<string | null>(BRIGHT_HORIZONS_VIEW);
  const employer = EMPLOYERS.find((e) => e.id === selected) ?? null;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <header className="mb-5">
        <div className="flex items-center gap-2 text-emerald-700 mb-1">
          <Phone size={16} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
            Enrollment Advisor Tool
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Employer Reimbursement Reference</h1>
        <p className="mt-1.5 text-sm text-gray-600 leading-relaxed max-w-3xl">
          {PROGRAM_META.program}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>Last updated {PROGRAM_META.lastUpdated}</span>
          <span className="text-gray-300">·</span>
          <span>Cohort closes {PROGRAM_META.cohortClose}</span>
          <span className="text-gray-300">·</span>
          <span className="inline-flex items-center gap-1 text-amber-600">
            <Info size={12} /> Living document — verify flagged gaps with HR
          </span>
        </div>
      </header>

      {/* Sticky employer selector */}
      <div className="sticky top-14 z-30 -mx-6 px-6 py-3 bg-gray-50/95 backdrop-blur border-b border-gray-200 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {/* Default: Bright Horizons / EdAssist LOC — the most common pathway */}
          <button
            type="button"
            onClick={() => setSelected(BRIGHT_HORIZONS_VIEW)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              selected === BRIGHT_HORIZONS_VIEW
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
            }`}
          >
            <FileText size={14} />
            Bright Horizons / EdAssist
            <span
              className={`ml-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                selected === BRIGHT_HORIZONS_VIEW
                  ? 'bg-white/20 text-white'
                  : 'bg-violet-200/70 text-violet-700'
              }`}
            >
              Most common
            </span>
          </button>
          <span className="w-px h-5 bg-gray-200 mx-1" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mr-1">
            Employer
          </span>
          {EMPLOYERS.map((e) => {
            const v = VERDICT_STYLES[e.verdict];
            const active = selected === e.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelected(e.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? v.pillActive
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${active ? 'bg-white/90' : v.dot}`}
                />
                {e.name}
              </button>
            );
          })}
          <span className="w-px h-5 bg-gray-200 mx-1" />
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              selected === null
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <BookOpen size={14} />
            Quick Reference
          </button>
        </div>
      </div>

      {/* Body */}
      {selected === BRIGHT_HORIZONS_VIEW ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
            <div className="flex items-start gap-3">
              <FileText size={24} className="text-violet-600 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-bold text-gray-900">
                    Bright Horizons / EdAssist — Letter of Credit
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                    Most common pathway
                  </span>
                </div>
                <p className="mt-1 font-semibold text-violet-900">
                  Start here — this is the path most campaign employers use.
                </p>
                <p className="mt-0.5 text-sm text-gray-700">
                  JPMorgan Chase, Goldman Sachs, Citi, Bank of America, PepsiCo, and likely Boeing
                  all run the same 6-step LOC workflow. Microsoft is the exception (manager-approved
                  team training budget) — see its tab.
                </p>
              </div>
            </div>
          </div>
          <BrightHorizonsLOC />
        </div>
      ) : employer ? (
        <EmployerDetail e={employer} />
      ) : (
        <QuickReference />
      )}

      {/* Footer note */}
      <p className="mt-10 pt-5 border-t border-gray-200 text-xs text-gray-400 leading-relaxed">
        {PROGRAM_META.status} For: {PROGRAM_META.audience}. Internal advisor reference — not for
        external distribution. Coverage verdicts are research-based estimates; always confirm with
        the employee&rsquo;s HR or benefits administrator before promising coverage.
      </p>
    </div>
  );
}
