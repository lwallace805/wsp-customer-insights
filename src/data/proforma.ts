// ─── Pro forma demo data ──────────────────────────────────────────────────────
//
// Illustrative data for the P0 pro forma of the centralized marketing dashboard
// (see the July 2026 pro forma doc). Everything here is fake but internally
// consistent; it exists so the structure can be reviewed before real data is
// wired to the intake tabs. Decisions baked in: B2C only (no B2B anywhere),
// forecast = completion-ratio x 60/40 weighted day-out curve, ROAS gross
// default with net toggle, bot-excluded lead basis for Spring/Fall '25.

// ─── Pulse (L0) ───────────────────────────────────────────────────────────────

export interface PulseCohortCard {
  key: string;
  label: string;
  family: 'wharton' | 'columbia';
  enrolls: number;
  goal: number;
  forecastToDate: number;   // where the 60/40 curve says we should be today
  daysRemaining: number;
  daysTotal: number;
}

export interface PulseTodayCard {
  yesterdayActual: number;
  yesterdayGoal: number;
  todayGoal: number;
  cohortToDate: number;
}

export interface PulseLeadsCard {
  weekTotal: number;
  weekForecast: number;
  googleWeekTotal: number;
  googleWeekForecast: number;
}

export interface CombinedRow {
  label: string;
  actual: number | null;
  forecast: number | null;
  placeholder?: string;     // for bootcamps / retail rows with no feed yet
}

export interface DeadlineHourRow {
  time: string;
  current: number | null;
  priorCohort: number;
  priorCohort2: number;
  goal: number;
}

export interface SourceFreshness {
  source: string;
  updatedThrough: string;
  cadence: string;
  lagging: boolean;
}

export interface PulseData {
  asOf: string;
  cohorts: PulseCohortCard[];
  today: PulseTodayCard;
  leads: PulseLeadsCard;
  combined: CombinedRow[];
  deadline: {
    cohortLabel: string;
    deadlineLabel: string;
    priorLabels: [string, string];
    rows: DeadlineHourRow[];
  };
  freshness: SourceFreshness[];
}

export const PULSE: PulseData = {
  asOf: 'July 2, 2026',
  cohorts: [
    { key: 'wharton-fall-26', label: "Wharton Fall '26", family: 'wharton', enrolls: 214, goal: 1225, forecastToDate: 196, daysRemaining: 94, daysTotal: 118 },
    { key: 'cbsee-fall-26', label: "CBSEE Fall '26", family: 'columbia', enrolls: 61, goal: 485, forecastToDate: 75, daysRemaining: 71, daysTotal: 119 },
  ],
  today: { yesterdayActual: 11, yesterdayGoal: 8, todayGoal: 9, cohortToDate: 275 },
  leads: { weekTotal: 1908, weekForecast: 1800, googleWeekTotal: 812, googleWeekForecast: 795 },
  combined: [
    { label: 'B2C Enrollments — both cohorts', actual: 275, forecast: 271 },
    { label: 'Leads — both cohorts (wk)', actual: 1908, forecast: 1800 },
    { label: 'Bootcamps', actual: null, forecast: null, placeholder: 'Feed TBD — placeholder per 6/26 call' },
    { label: 'Self-Study / Retail', actual: null, forecast: null, placeholder: 'Feed TBD — placeholder per 6/26 call' },
  ],
  deadline: {
    cohortLabel: "Wharton Fall '26",
    deadlineLabel: 'Early Enrollment Deadline · Aug 4, 2026',
    priorLabels: ["Spring '26", "Winter '26"],
    rows: [
      { time: '12PM EST', current: null, priorCohort: 15, priorCohort2: 11, goal: 12 },
      { time: '3PM EST', current: null, priorCohort: 17, priorCohort2: 18, goal: 20 },
      { time: '5PM EST', current: null, priorCohort: 22, priorCohort2: 22, goal: 25 },
      { time: '7PM EST', current: null, priorCohort: 26, priorCohort2: 22, goal: 25 },
      { time: '10PM EST', current: null, priorCohort: 36, priorCohort2: 26, goal: 29 },
      { time: 'Midnight EST', current: null, priorCohort: 41, priorCohort2: 30, goal: 34 },
    ],
  },
  freshness: [
    { source: 'HubSpot purchaser / lead export (intake #1)', updatedThrough: 'Jul 1, 2026', cadence: 'Daily · manual paste', lagging: false },
    { source: 'Paid platform daily grid (intake #2)', updatedThrough: 'Jul 1, 2026', cadence: 'Daily · manual keying', lagging: false },
    { source: 'Enrollment team doc (L2 feed)', updatedThrough: 'Jun 15, 2026', cadence: 'Weekly · contract tab', lagging: true },
    { source: 'Channel attribution reconciliation', updatedThrough: 'Post-cohort pass pending', cadence: 'Per cohort · Jon', lagging: true },
  ],
};

// ─── Full Funnel (L1) ─────────────────────────────────────────────────────────

export type ComparisonKey = 'prior' | 'sameSeason' | 'avg3';

export const COMPARISON_LABELS: Record<ComparisonKey, string> = {
  prior: "Prior cohort (Spring '26)",
  sameSeason: "Same season (Fall '25)",
  avg3: 'Last 3 cohort avg',
};

export interface FunnelProgramRow {
  program: string;
  toDate: number;
  forecast: number;
  prior: number;
}

export interface FunnelRow {
  metric: string;
  format: 'usd' | 'usd2' | 'int' | 'pct';
  higherIsBetter: boolean;
  toDate: number;
  forecast: number;
  prior: Record<ComparisonKey, number>;
  perProgram: FunnelProgramRow[];
}

export interface FullFunnelData {
  dayOut: number;
  phase: string;
  phaseNote: string;
  rows: FunnelRow[];
}

export const FULL_FUNNEL: Record<'wharton' | 'columbia', FullFunnelData> = {
  wharton: {
    dayOut: 94,
    phase: 'Phase 2 · Early Enrollment Marketing',
    phaseNote: 'Historically ~47% of cohort enrollments land in Phase 2, ~45% in the deadline window, ~8% in extension.',
    rows: [
      {
        metric: 'Spend', format: 'usd', higherIsBetter: false,
        toDate: 128400, forecast: 121000,
        prior: { prior: 119750, sameSeason: 111400, avg3: 116200 },
        perProgram: [
          { program: 'PE', toDate: 38200, forecast: 36300, prior: 35900 },
          { program: 'RE', toDate: 33400, forecast: 31500, prior: 31100 },
          { program: 'FP&A', toDate: 26800, forecast: 25400, prior: 25200 },
          { program: 'AVI', toDate: 18600, forecast: 17700, prior: 17400 },
          { program: 'RDI', toDate: 11400, forecast: 10100, prior: 10150 },
        ],
      },
      {
        metric: 'CPL', format: 'usd2', higherIsBetter: false,
        toDate: 48.10, forecast: 52.00,
        prior: { prior: 55.20, sameSeason: 51.30, avg3: 53.40 },
        perProgram: [
          { program: 'PE', toDate: 43.90, forecast: 47.00, prior: 49.80 },
          { program: 'RE', toDate: 46.50, forecast: 50.10, prior: 53.20 },
          { program: 'FP&A', toDate: 49.70, forecast: 54.20, prior: 57.90 },
          { program: 'AVI', toDate: 55.10, forecast: 59.00, prior: 62.40 },
          { program: 'RDI', toDate: 58.80, forecast: 63.50, prior: 66.10 },
        ],
      },
      {
        metric: 'Leads', format: 'int', higherIsBetter: true,
        toDate: 2670, forecast: 2327,
        prior: { prior: 2169, sameSeason: 2172, avg3: 2176 },
        perProgram: [
          { program: 'PE', toDate: 870, forecast: 772, prior: 721 },
          { program: 'RE', toDate: 718, forecast: 629, prior: 585 },
          { program: 'FP&A', toDate: 539, forecast: 469, prior: 435 },
          { program: 'AVI', toDate: 338, forecast: 300, prior: 279 },
          { program: 'RDI', toDate: 205, forecast: 157, prior: 149 },
        ],
      },
      {
        metric: 'Lead → Enroll CVR', format: 'pct', higherIsBetter: true,
        toDate: 8.0, forecast: 9.2,
        prior: { prior: 9.6, sameSeason: 9.1, avg3: 9.3 },
        perProgram: [
          { program: 'PE', toDate: 8.6, forecast: 9.7, prior: 10.2 },
          { program: 'RE', toDate: 8.4, forecast: 9.5, prior: 9.9 },
          { program: 'FP&A', toDate: 7.8, forecast: 9.0, prior: 9.4 },
          { program: 'AVI', toDate: 7.1, forecast: 8.3, prior: 8.7 },
          { program: 'RDI', toDate: 6.3, forecast: 7.6, prior: 7.9 },
        ],
      },
      {
        metric: 'Enrollments', format: 'int', higherIsBetter: true,
        toDate: 214, forecast: 196,
        prior: { prior: 208, sameSeason: 198, avg3: 202 },
        perProgram: [
          { program: 'PE', toDate: 75, forecast: 68, prior: 74 },
          { program: 'RE', toDate: 60, forecast: 55, prior: 58 },
          { program: 'FP&A', toDate: 42, forecast: 39, prior: 41 },
          { program: 'AVI', toDate: 24, forecast: 23, prior: 23 },
          { program: 'RDI', toDate: 13, forecast: 11, prior: 12 },
        ],
      },
      {
        metric: 'CPE', format: 'usd', higherIsBetter: false,
        toDate: 600, forecast: 617,
        prior: { prior: 576, sameSeason: 563, avg3: 575 },
        perProgram: [
          { program: 'PE', toDate: 509, forecast: 534, prior: 485 },
          { program: 'RE', toDate: 557, forecast: 573, prior: 536 },
          { program: 'FP&A', toDate: 638, forecast: 651, prior: 615 },
          { program: 'AVI', toDate: 775, forecast: 770, prior: 757 },
          { program: 'RDI', toDate: 877, forecast: 918, prior: 846 },
        ],
      },
    ],
  },
  columbia: {
    dayOut: 71,
    phase: 'Phase 2 · Early Enrollment Marketing',
    phaseNote: 'Historically ~47% of cohort enrollments land in Phase 2, ~45% in the deadline window, ~8% in extension.',
    rows: [
      {
        metric: 'Spend', format: 'usd', higherIsBetter: false,
        toDate: 46800, forecast: 44200,
        prior: { prior: 43100, sameSeason: 40900, avg3: 42300 },
        perProgram: [
          { program: 'AI F&B', toDate: 46800, forecast: 44200, prior: 43100 },
        ],
      },
      {
        metric: 'CPL', format: 'usd2', higherIsBetter: false,
        toDate: 37.70, forecast: 39.50,
        prior: { prior: 41.20, sameSeason: 38.90, avg3: 40.10 },
        perProgram: [
          { program: 'AI F&B', toDate: 37.70, forecast: 39.50, prior: 41.20 },
        ],
      },
      {
        metric: 'Leads', format: 'int', higherIsBetter: true,
        toDate: 1240, forecast: 1180,
        prior: { prior: 1046, sameSeason: 1052, avg3: 1055 },
        perProgram: [
          { program: 'AI F&B', toDate: 1240, forecast: 1180, prior: 1046 },
        ],
      },
      {
        metric: 'Lead → Enroll CVR', format: 'pct', higherIsBetter: true,
        toDate: 4.9, forecast: 6.4,
        prior: { prior: 6.8, sameSeason: 6.2, avg3: 6.5 },
        perProgram: [
          { program: 'AI F&B', toDate: 4.9, forecast: 6.4, prior: 6.8 },
        ],
      },
      {
        metric: 'Enrollments', format: 'int', higherIsBetter: true,
        toDate: 61, forecast: 75,
        prior: { prior: 71, sameSeason: 65, avg3: 69 },
        perProgram: [
          { program: 'AI F&B', toDate: 61, forecast: 75, prior: 71 },
        ],
      },
      {
        metric: 'CPE', format: 'usd', higherIsBetter: false,
        toDate: 767, forecast: 589,
        prior: { prior: 607, sameSeason: 629, avg3: 613 },
        perProgram: [
          { program: 'AI F&B', toDate: 767, forecast: 589, prior: 607 },
        ],
      },
    ],
  },
};

// ─── Leads (L1, Jon's deck replacement) ───────────────────────────────────────

export interface LeadsWeekRow {
  week: number;
  dateRange: string;
  total: number;
  totalForecast: number;
  google: number;
  googleForecast: number;
}

export interface LeadsProgramRow {
  program: string;
  leadsToDate: number;
  leadsForecast: number;
  cvrNeeded: number;      // CVR needed on projected leads to still hit goal
  cvrHistorical: number;  // historical final CVR
}

export interface LeadsData {
  basisNote: string;
  weeks: LeadsWeekRow[];
  programs: LeadsProgramRow[];
}

export const LEADS: Record<'wharton' | 'columbia', LeadsData> = {
  wharton: {
    basisNote: "Bot-excluded basis. Forecast = 60/40 weighted model on Winter '26 + Spring '26 (bot leads excluded).",
    weeks: [
      { week: 1, dateRange: 'May 4 – May 10', total: 512, totalForecast: 540, google: 221, googleForecast: 235 },
      { week: 2, dateRange: 'May 11 – May 17', total: 588, totalForecast: 560, google: 254, googleForecast: 242 },
      { week: 3, dateRange: 'May 18 – May 24', total: 611, totalForecast: 585, google: 259, googleForecast: 251 },
      { week: 4, dateRange: 'May 25 – May 31', total: 549, totalForecast: 590, google: 231, googleForecast: 253 },
      { week: 5, dateRange: 'Jun 1 – Jun 7', total: 634, totalForecast: 610, google: 271, googleForecast: 262 },
      { week: 6, dateRange: 'Jun 8 – Jun 14', total: 662, totalForecast: 640, google: 283, googleForecast: 274 },
      { week: 7, dateRange: 'Jun 15 – Jun 21', total: 641, totalForecast: 665, google: 268, googleForecast: 284 },
      { week: 8, dateRange: 'Jun 22 – Jun 28', total: 703, totalForecast: 690, google: 302, googleForecast: 296 },
    ],
    programs: [
      { program: 'PE', leadsToDate: 870, leadsForecast: 772, cvrNeeded: 4.8, cvrHistorical: 5.3 },
      { program: 'RE', leadsToDate: 718, leadsForecast: 629, cvrNeeded: 5.9, cvrHistorical: 6.6 },
      { program: 'FP&A', leadsToDate: 539, leadsForecast: 469, cvrNeeded: 4.6, cvrHistorical: 4.4 },
      { program: 'AVI', leadsToDate: 338, leadsForecast: 300, cvrNeeded: 4.9, cvrHistorical: 4.7 },
      { program: 'RDI', leadsToDate: 205, leadsForecast: 157, cvrNeeded: 5.4, cvrHistorical: 4.7 },
    ],
  },
  columbia: {
    basisNote: "Bot-excluded basis. Forecast = 60/40 weighted model on Winter '26 + Fall '25.",
    weeks: [
      { week: 1, dateRange: 'May 25 – May 31', total: 248, totalForecast: 260, google: 96, googleForecast: 102 },
      { week: 2, dateRange: 'Jun 1 – Jun 7', total: 287, totalForecast: 275, google: 112, googleForecast: 108 },
      { week: 3, dateRange: 'Jun 8 – Jun 14', total: 301, totalForecast: 290, google: 119, googleForecast: 114 },
      { week: 4, dateRange: 'Jun 15 – Jun 21', total: 279, totalForecast: 300, google: 108, googleForecast: 118 },
      { week: 5, dateRange: 'Jun 22 – Jun 28', total: 312, totalForecast: 310, google: 124, googleForecast: 122 },
    ],
    programs: [
      { program: 'AI F&B', leadsToDate: 1240, leadsForecast: 1180, cvrNeeded: 6.4, cvrHistorical: 6.5 },
    ],
  },
};

// ─── Lower Funnel (L2, Aubrey's chain + advisor layer) ───────────────────────

export interface LowerFunnelMetric {
  metric: string;
  format: 'int' | 'pct';
  higherIsBetter: boolean;
  perProgram: { program: string; actual: number; baseline: number }[];
}

export interface AdvisorRow {
  advisor: string;
  weeklyEmails: number;        // goal 200–225
  closedEmails: number;        // goal 80
  taskCompletion: number;      // % — goal 90
  consultCvr: number;          // % — goal 35
  noShowRate: number;          // % — goal <10
  enrolls: number;
  enrollTarget: number;
}

export interface LowerFunnelData {
  baselineNote: string;
  updatedThrough: string;
  metrics: LowerFunnelMetric[];
  advisors: AdvisorRow[];
}

const WHARTON_LF_PROGRAMS = ['PE', 'RE', 'FP&A', 'AVI', 'RDI'];

function lf(metric: string, format: 'int' | 'pct', higherIsBetter: boolean, values: [number, number][]): LowerFunnelMetric {
  return {
    metric, format, higherIsBetter,
    perProgram: values.map(([actual, baseline], i) => ({ program: WHARTON_LF_PROGRAMS[i], actual, baseline })),
  };
}

export const LOWER_FUNNEL: Record<'wharton' | 'columbia', LowerFunnelData> = {
  wharton: {
    baselineNote: 'Baseline = prior-cohort at same day-out, normalized for program count (5 programs this cohort vs. 4 prior — raw comparisons overstate the baseline).',
    updatedThrough: 'Jun 15, 2026',
    metrics: [
      lf('Info Session RSVPs', 'int', true, [[898, 1119], [1832, 1066], [640, 590], [433, 722], [862, 245]]),
      lf('Info Session Attendees', 'int', true, [[246, 347], [260, 320], [214, 196], [198, 266], [188, 76]]),
      lf('Consults', 'int', true, [[147, 173], [113, 131], [49, 46], [102, 116], [31, 24]]),
      lf('Consult → Enroll CVR', 'pct', true, [[25, 32], [32, 39], [29, 46], [22, 35], [52, 40]]),
      lf('TA Applications', 'int', true, [[52, 48], [44, 41], [29, 26], [21, 24], [12, 8]]),
      lf('TA Enrollments', 'int', true, [[31, 29], [27, 25], [17, 16], [12, 14], [7, 5]]),
    ],
    advisors: [
      { advisor: 'Advisor 1', weeklyEmails: 218, closedEmails: 84, taskCompletion: 93, consultCvr: 36, noShowRate: 7, enrolls: 71, enrollTarget: 72 },
      { advisor: 'Advisor 2', weeklyEmails: 204, closedEmails: 77, taskCompletion: 88, consultCvr: 33, noShowRate: 9, enrolls: 66, enrollTarget: 72 },
      { advisor: 'Advisor 3', weeklyEmails: 231, closedEmails: 92, taskCompletion: 95, consultCvr: 38, noShowRate: 6, enrolls: 78, enrollTarget: 72 },
    ],
  },
  columbia: {
    baselineNote: 'Baseline = prior-cohort at same day-out.',
    updatedThrough: 'Jun 15, 2026',
    metrics: [
      { metric: 'Info Session RSVPs', format: 'int', higherIsBetter: true, perProgram: [{ program: 'AI F&B', actual: 662, baseline: 562 }] },
      { metric: 'Info Session Attendees', format: 'int', higherIsBetter: true, perProgram: [{ program: 'AI F&B', actual: 284, baseline: 246 }] },
      { metric: 'Consults', format: 'int', higherIsBetter: true, perProgram: [{ program: 'AI F&B', actual: 91, baseline: 72 }] },
      { metric: 'Consult → Enroll CVR', format: 'pct', higherIsBetter: true, perProgram: [{ program: 'AI F&B', actual: 23, baseline: 21 }] },
      { metric: 'TA Applications', format: 'int', higherIsBetter: true, perProgram: [{ program: 'AI F&B', actual: 209, baseline: 177 }] },
      { metric: 'TA Enrollments', format: 'int', higherIsBetter: true, perProgram: [{ program: 'AI F&B', actual: 73, baseline: 62 }] },
    ],
    advisors: [
      { advisor: 'Advisor 1', weeklyEmails: 212, closedEmails: 81, taskCompletion: 91, consultCvr: 34, noShowRate: 8, enrolls: 22, enrollTarget: 21 },
      { advisor: 'Advisor 2', weeklyEmails: 198, closedEmails: 74, taskCompletion: 86, consultCvr: 31, noShowRate: 11, enrolls: 18, enrollTarget: 21 },
      { advisor: 'Advisor 3', weeklyEmails: 226, closedEmails: 88, taskCompletion: 94, consultCvr: 37, noShowRate: 5, enrolls: 24, enrollTarget: 21 },
    ],
  },
};
