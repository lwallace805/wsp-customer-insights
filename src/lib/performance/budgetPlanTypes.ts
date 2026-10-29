// Client-safe shapes for the Wharton budget-pacing view. Kept apart from
// budgetPlan.ts so the page bundle never pulls in `googleapis`.

export const BUDGET_CHANNELS = ['Google', 'Bing', 'Meta', 'LinkedIn'] as const;
export type BudgetChannel = (typeof BUDGET_CHANNELS)[number];

/** One column of the pacing plan: a cohort week as the workbook numbers it. */
export interface PlanWeek {
  /** 1-based week-from-open, exactly as the sheet's own week-number row. */
  week: number;
  /** As written in the sheet, e.g. "10/14-10/19". */
  dateRange: string;
  start: string;   // YYYY-MM-DD
  end: string;     // YYYY-MM-DD, inclusive
  days: number;
  /** The days-to-deadline bucket the sheet assigns the week, e.g. "61-90d",
   *  "8-21d | ★ Early Enroll", "$0 — Post-cohort". */
  bucket: string;
}

export interface PlanCampaign {
  program: string;
  campaignType: string;
  name: string;
  optEvent: string;
  /** Cohort-total planned spend for the campaign. */
  spend: number;
  /** Planned spend per week, aligned to `BudgetPlan.weeks`. */
  weekly: number[];
}

export interface ChannelPlan {
  channel: BudgetChannel;
  /** The block's own TOTAL row — cohort-total planned spend. */
  total: number;
  /** TOTAL row, per week. Sums to `total`. */
  weekly: number[];
  /** TOTAL row, planned spend per day within each week. */
  daily: number[];
  campaigns: PlanCampaign[];
  /** Provenance, e.g. `Budget Pacing (Wharton V3)!A13`. */
  source: string;
}

export interface ProgramPlan {
  program: string;
  spend: number;
  cpe: number | null;
  enrollments: number | null;
  leads: number | null;
  cpl: number | null;
  cvr: number | null;
  roas: number | null;
}

export interface BucketPlan {
  bucket: string;
  /** Week numbers the bucket covers. */
  weeks: number[];
  total: number;
  byChannel: Record<BudgetChannel, number>;
}

/** Executive Budget Summary — "CHANNEL MIX" table, one row per channel plus TOTAL. */
export interface ChannelMixRow {
  channel: string;
  budget: number | null;
  share: number | null;            // fraction of total
  projEnrollments: number | null;
  projCpe: number | null;
  projLeads: number | null;
  projCpl: number | null;
}

/** Executive Budget Summary — "BUDGET OVERVIEW" table: plan vs prior-cohort actual. */
export interface OverviewRow {
  metric: string;                  // "Total Budget ($)", "Google Spend ($)", …
  priorActual: number | null;
  plan: number | null;
  cocDollar: number | null;
  cocPct: number | null;           // fraction
}

/** Executive Budget Summary — "PROGRAM SPEND SUMMARY — … Plan" matrix. */
export interface ProgramChannelRow {
  program: string;
  byChannel: Record<BudgetChannel, number | null>;
  total: number | null;
  enrollments: number | null;
  cpe: number | null;
}

export interface PlanCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface BudgetPlan {
  docTitle: string;
  sheetId: string;
  pacingTab: string;
  summaryTab: string | null;
  /** The plan's cohort-total paid budget, null when the all-paid block failed
   *  its own reconciliation. */
  totalBudget: number | null;
  weeks: PlanWeek[];
  /** The "All Paid Ads" block: cohort total, its weekly/daily TOTAL row and
   *  the per-program totals. Null (with a note) when it doesn't reconcile. */
  allPaid: {
    total: number;
    weekly: number[];
    daily: number[];
    programs: ProgramPlan[];
  } | null;
  /** Per-channel blocks. A channel whose block failed reconciliation is
   *  absent here and named in `notes`. */
  channels: Partial<Record<BudgetChannel, ChannelPlan>>;
  /** Planned spend by days-to-deadline bucket, summed from the channel
   *  blocks that reconciled. Null when none did. */
  byBucket: BucketPlan[] | null;
  summary: {
    priorLabel: string;            // "Fall 2026 Actual"
    planLabel: string;             // "Winter 2027 Plan"
    overview: OverviewRow[] | null;
    channelMix: ChannelMixRow[] | null;
    programByChannel: ProgramChannelRow[] | null;
  } | null;
  checks: PlanCheck[];
  notes: string[];
  fetchedAt: string;
}

// ─── Joined payload (plan vs actual) ─────────────────────────────────────────

export interface BudgetPacingChannel {
  channel: BudgetChannel | 'Total';
  /** Cohort-total planned spend. */
  budget: number | null;
  share: number | null;
  /** Planned spend through `alignment.throughDate` (complete days only). */
  plannedToDate: number | null;
  /** Planned spend through the END of the current week. */
  plannedThroughWeek: number | null;
  /** Cohort-to-date actual spend from the cohort doc's Paid WoW tab. */
  actualToDate: number | null;
  /** The cohort doc's own to-date spend forecast, for reference. */
  docForecastToDate: number | null;
  variance: number | null;         // actual − plannedToDate
  variancePct: number | null;      // variance ÷ plannedToDate
  /** Prior cohort's FULL-COHORT actual from the Executive Budget Summary —
   *  a final, not a week-aligned figure. */
  priorActual: number | null;
}

export interface BudgetPacingWeek {
  week: number;
  dateRange: string;
  start: string;
  end: string;
  bucket: string;
  planned: number | null;
  plannedByChannel: Record<BudgetChannel, number | null>;
  /** All-paid actual spend for the week from the Paid WoW weekly series. */
  actual: number | null;
  cumPlanned: number | null;
  cumActual: number | null;
  status: 'past' | 'current' | 'future';
}

export interface BudgetPacingData {
  cohort: { key: string; label: string; termLabel: string; opens: string; extEnds: string };
  asOf: string;
  alignment: {
    basis: 'week-from-open';
    /** Plan week containing `asOf`; null before the plan starts. */
    currentWeek: number | null;
    /** `getCohortWeek()` for the same day, for cross-reference. */
    calendarWeek: number;
    /** Last complete day the to-date figures cover (the day before `asOf`). */
    throughDate: string;
    /** Complete days of the current week included in `plannedToDate`. */
    daysIntoWeek: number;
    note: string;
  };
  plan: BudgetPlan;
  actuals: {
    docTitle: string;
    sheetId: string;
    tab: string;
    totalSpend: number | null;
    /** Weeks in the Paid WoW series with any spend keyed. */
    weeksKeyed: number;
    /** Cross-check only: the cohort doc's raw "Ad Spend" tab (daily spend keyed
     *  per platform) summed through `alignment.throughDate`. Null when the tab
     *  is absent. It exists to flag a Paid WoW tab that hasn't been rolled up;
     *  it is never substituted for the Paid WoW figure. */
    adSpend: {
      tab: string;
      byChannel: Partial<Record<BudgetChannel, number>>;
      total: number;
      lastKeyedDate: string | null;
      /** Within 1% / $100 of the Paid WoW to-date total. */
      agreesWithPaidWoW: boolean;
    } | null;
  } | null;
  channels: BudgetPacingChannel[];
  weekly: BudgetPacingWeek[];
  notes: string[];
  fetchedAt: string;
}
