// Shared types for the Performance Dashboards section.
// Data is a curated snapshot of the source Google Sheets — see each data file
// for its source sheet ID. Re-sync by asking Claude to re-read the sheets.

export type School = 'wharton' | 'columbia';
export type SchoolFilter = 'all' | School;

// ── Historical cohort performance ────────────────────────────────────────────

export type ChannelKey =
  | 'ppc'             // Ads - Google / FB / LI / Other
  | 'email'           // Emails to WSP Leads and Customers
  | 'organicSearch'
  | 'aiReferral'
  | 'social'          // WSP Social
  | 'website'         // WSP Website
  | 'referrals'
  | 'sponsored'       // Sponsored Content
  | 'affiliates'      // Paid Affiliates
  | 'offline';        // Offline / Direct (Channel Unknown)

export const CHANNEL_LABELS: Record<ChannelKey, string> = {
  ppc: 'PPC (Google/FB/LI)',
  email: 'Email (WSP Leads)',
  organicSearch: 'Organic Search',
  aiReferral: 'AI Referral',
  social: 'WSP Social',
  website: 'WSP Website',
  referrals: 'Referrals',
  sponsored: 'Sponsored Content',
  affiliates: 'Paid Affiliates',
  offline: 'Offline / Direct',
};

export const PAID_CHANNELS: ChannelKey[] = ['ppc', 'sponsored', 'affiliates'];

export interface CohortHistory {
  cohort: string;            // e.g. "Spring 2023"
  shortLabel: string;        // e.g. "S'23"
  school: School;
  certCount: number;         // number of certificate programs live during cohort
  paidEnrolls: number;       // Traditional Paid Channels (PPC + Sponsored Content)
  organicEnrolls: number;    // Organic/Direct/Owned Channels
  totalEnrolls: number;      // net of refunds, during marketing cycle
  b2bEnrolls: number;
  totalEnrollsExB2B: number;
  totalLeads: number;        // raw
  leadsExBots: number | null; // bot-adjusted where available
  leadCvr: number;           // % lead → enrollment (bot-adjusted)
  cpl: number;               // $
  cpe: number;               // $
  ppcRoas: number;           // x
  blendedRoas: number;       // x
  ppcSpend: number | null;   // $
  totalSpend: number | null; // $
  avgNetRev: number;         // $ per enrollment
  channelEnrolls: Partial<Record<ChannelKey, number>>;
  callout?: string;          // notable event affecting this cohort
}

// ── Program-level history ─────────────────────────────────────────────────────

export type ProgramKey = 'pe' | 're' | 'fpa' | 'avi' | 'rdi' | 'ai';

export const PROGRAM_LABELS: Record<ProgramKey, string> = {
  pe: 'Private Equity',
  re: 'Real Estate',
  fpa: 'FP&A',
  avi: 'Applied Value Investing',
  rdi: 'Restructuring & Distressed Investing',
  ai: 'AI for Business & Finance',
};

export const PROGRAM_SCHOOL: Record<ProgramKey, School> = {
  pe: 'wharton',
  re: 'wharton',
  fpa: 'wharton',
  avi: 'wharton',
  rdi: 'wharton',
  ai: 'columbia',
};

export interface ProgramCohortStat {
  cohort: string;        // e.g. "Spring 2024"
  leads: number | null;
  cvr: number | null;    // %
}

export interface ProgramHistory {
  program: ProgramKey;
  stats: ProgramCohortStat[];
}

// ── Current cohort snapshot (live layer or static fallback) ──────────────────

export interface ProgramCurrent {
  program: ProgramKey;
  enrolls: { realTime: number; forecast: number; finalTarget: number };
  leads: { realTime: number; forecast: number; finalTarget: number };
  leadCvr: number | null;          // % current
  infoSessionRsvps?: { realTime: number; baseline: number; target: number | null };
}

export interface ChannelMixComparison {
  channel: string;
  current: number;       // % of enrollments
  priorCohort: number;
  priorYear: number;
}

export interface CurrentSnapshot {
  asOf: string;                       // ISO date the source data was updated through
  live: boolean;                      // true when fetched from sheets, false when static fallback
  programs: ProgramCurrent[];
  paidVsOrganic: Record<School, { paid: number; organic: number; priorCohortPaid: number; priorYearPaid: number }>;
  channelMix: Record<School, ChannelMixComparison[]>;
  forecastNote: string;
}

// ── Traffic (GA4 weekly) ──────────────────────────────────────────────────────

export interface TrafficWeek {
  weekStart: string;   // ISO date
  seo: number | null;
  ai: number | null;
  direct: number | null;
  paid: number | null;
  other: number | null;
  total: number | null;
}

export interface YoYWeeklySeries {
  label: string;
  y2025: (number | null)[];   // aligned by week index from start of year
  y2026: (number | null)[];
}

// ── Self-study / retail ───────────────────────────────────────────────────────

export interface SelfStudyWeek {
  weekStart: string;          // ISO date
  budget: number | null;
  actual: number | null;
  priorYear: number | null;
}

export interface SelfStudyYear {
  year: number;
  weeks: SelfStudyWeek[];
  ytd: { budget: number | null; actual: number | null; priorYear: number | null };
}

// ── Optimization insights ─────────────────────────────────────────────────────

export type InsightSeverity = 'critical' | 'warning' | 'positive';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  school: School | 'both';
  title: string;
  evidence: string[];        // metric bullets backing the insight
  action: string;            // recommended next step
}
