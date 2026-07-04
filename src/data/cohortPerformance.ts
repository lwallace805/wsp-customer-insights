// ─── Types ────────────────────────────────────────────────────────────────────

export type ProgramKey = 'PE' | 'RE' | 'FP&A' | 'AVI' | 'RDI' | 'AI Finance' | 'AI Accounting';

export type ChannelKey =
  | 'Google Ads'
  | 'Facebook / Instagram Ads'
  | 'LinkedIn Ads'
  | 'Other Paid'
  | 'Email – WSP Leads'
  | 'Email – WSP Customers'
  | 'Organic Search'
  | 'WSP Social'
  | 'Referrals'
  | 'Offline / Direct';

export interface ChannelRow {
  channel: ChannelKey;
  enrolls: number;
  pct: number;        // % of total enrolls
  leads: number;
  spend: number;      // direct spend $
  roas: number;       // 0 for non-paid channels
  cpl: number;        // 0 for non-paid
  cpe: number;        // 0 for non-paid
  cvr: number;        // %
}

export interface ProgramRow {
  program: ProgramKey;
  enrolls: number;
  goal: number;
  forecast: number;
  leads: number;
  cvr: number;        // %
  cpl: number;
  cpe: number;
}

export interface WeeklyRow {
  week: number;
  dateRange: string;
  spend: number;
  spendForecast: number;
  leads: number;
  leadsForecast: number;
  enrolls: number;
  enrollForecast: number;
  cpl: number;
  cpe: number;
  cvr: number;
}

export interface DailyPacing {
  day: number;
  enrolls: number;      // daily new
  cumulative: number;   // running total
  forecast: number;     // linear forecast at this pace
}

export interface CohortData {
  cohort: string;
  family: 'wharton' | 'columbia';
  status: 'active' | 'closed';
  totalGoal: number;
  totalEnrolls: number;
  totalForecast: number;
  totalSpend: number;
  roas: number;
  cpl: number;
  cpe: number;
  cvr: number;        // %
  daysTotal: number;
  daysRemaining: number;
  channels: ChannelRow[];
  programs: ProgramRow[];
  weekly: WeeklyRow[];
  pacing: DailyPacing[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePacing(totalEnrolls: number, durationDays: number, progress = 1): DailyPacing[] {
  const points: DailyPacing[] = [];
  let cumulative = 0;
  const activeDays = Math.round(durationDays * Math.min(Math.max(progress, 0), 1));
  for (let day = 1; day <= durationDays; day++) {
    let daily = 0;
    if (day <= activeDays) {
      const progress = day / durationDays;
      // S-curve: slow start, accelerates, spikes near deadline
      const rate =
        progress < 0.3 ? progress * 0.8 :
        progress < 0.75 ? 0.24 + (progress - 0.3) * 1.2 :
        0.78 + (progress - 0.75) * 1.8;
      const target = Math.round(totalEnrolls * Math.min(rate, 1));
      daily = Math.max(0, target - cumulative);
      cumulative += daily;
    }
    const forecast = Math.round(totalEnrolls * (day / durationDays));
    points.push({ day, enrolls: daily, cumulative, forecast });
  }
  return points;
}

// ─── Wharton Cohorts ──────────────────────────────────────────────────────────

const whartonFall2024: CohortData = {
  cohort: 'Fall 2024',
  family: 'wharton',
  status: 'closed',
  totalGoal: 850,
  totalEnrolls: 841,
  totalForecast: 841,
  totalSpend: 768200,
  roas: 2.8,
  cpl: 24.60,
  cpe: 913.44,
  cvr: 2.69,
  daysTotal: 90,
  daysRemaining: 0,
  channels: [
    { channel: 'Google Ads',                enrolls: 295, pct: 35.1, leads: 10200, spend: 314000, roas: 3.1, cpl: 30.78, cpe: 1064.41, cvr: 2.89 },
    { channel: 'Facebook / Instagram Ads',  enrolls: 128, pct: 15.2, leads: 4800,  spend: 168400, roas: 2.5, cpl: 35.08, cpe: 1315.63, cvr: 2.67 },
    { channel: 'LinkedIn Ads',              enrolls: 82,  pct: 9.7,  leads: 2300,  spend: 138900, roas: 1.9, cpl: 60.39, cpe: 1693.90, cvr: 3.57 },
    { channel: 'Other Paid',                enrolls: 41,  pct: 4.9,  leads: 1100,  spend: 146900, roas: 0.9, cpl: 133.55, cpe: 3583.54, cvr: 3.73 },
    { channel: 'Email – WSP Leads',         enrolls: 170, pct: 20.2, leads: 8400,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.02 },
    { channel: 'Email – WSP Customers',     enrolls: 48,  pct: 5.7,  leads: 1700,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.82 },
    { channel: 'Organic Search',            enrolls: 55,  pct: 6.5,  leads: 1600,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.44 },
    { channel: 'WSP Social',                enrolls: 12,  pct: 1.4,  leads: 420,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.86 },
    { channel: 'Referrals',                 enrolls: 10,  pct: 1.2,  leads: 280,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.57 },
    { channel: 'Offline / Direct',          enrolls: 0,   pct: 0.0,  leads: 0,     spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 0    },
  ],
  programs: [
    { program: 'PE',   enrolls: 238, goal: 225, forecast: 238, leads: 8200,  cvr: 2.90, cpl: 26.83, cpe: 925.21 },
    { program: 'RE',   enrolls: 261, goal: 250, forecast: 261, leads: 8800,  cvr: 2.97, cpl: 23.41, cpe: 788.51 },
    { program: 'FP&A', enrolls: 255, goal: 265, forecast: 255, leads: 8100,  cvr: 3.15, cpl: 22.96, cpe: 728.63 },
    { program: 'AVI',  enrolls: 87,  goal: 110, forecast: 87,  leads: 3800,  cvr: 2.29, cpl: 28.42, cpe: 1240.92 },
  ],
  weekly: [
    { week: 1,  dateRange: 'Aug 26 – Sep 1',  spend: 36200,  spendForecast: 38400,  leads: 1420, leadsForecast: 1500, enrolls: 28,  enrollForecast: 32,  cpl: 25.49, cpe: 1292.86, cvr: 1.97 },
    { week: 2,  dateRange: 'Sep 2 – Sep 8',   spend: 54800,  spendForecast: 55000,  leads: 2100, leadsForecast: 2200, enrolls: 52,  enrollForecast: 55,  cpl: 26.10, cpe: 1053.85, cvr: 2.48 },
    { week: 3,  dateRange: 'Sep 9 – Sep 15',  spend: 62100,  spendForecast: 61000,  leads: 2450, leadsForecast: 2400, enrolls: 67,  enrollForecast: 65,  cpl: 25.35, cpe: 927.01,  cvr: 2.73 },
    { week: 4,  dateRange: 'Sep 16 – Sep 22', spend: 68400,  spendForecast: 65000,  leads: 2700, leadsForecast: 2600, enrolls: 78,  enrollForecast: 75,  cpl: 25.33, cpe: 876.92,  cvr: 2.89 },
    { week: 5,  dateRange: 'Sep 23 – Sep 29', spend: 72300,  spendForecast: 70000,  leads: 2950, leadsForecast: 2800, enrolls: 89,  enrollForecast: 85,  cpl: 24.51, cpe: 812.36,  cvr: 3.02 },
    { week: 6,  dateRange: 'Sep 30 – Oct 6',  spend: 78500,  spendForecast: 75000,  leads: 3200, leadsForecast: 3100, enrolls: 102, enrollForecast: 98,  cpl: 24.53, cpe: 769.61,  cvr: 3.19 },
    { week: 7,  dateRange: 'Oct 7 – Oct 13',  spend: 84200,  spendForecast: 82000,  leads: 3400, leadsForecast: 3300, enrolls: 118, enrollForecast: 112, cpl: 24.76, cpe: 713.56,  cvr: 3.47 },
    { week: 8,  dateRange: 'Oct 14 – Oct 20', spend: 88100,  spendForecast: 88000,  leads: 3600, leadsForecast: 3500, enrolls: 133, enrollForecast: 130, cpl: 24.47, cpe: 662.41,  cvr: 3.69 },
    { week: 9,  dateRange: 'Oct 21 – Oct 27', spend: 72600,  spendForecast: 70000,  leads: 2900, leadsForecast: 2800, enrolls: 104, enrollForecast: 100, cpl: 25.03, cpe: 698.08,  cvr: 3.59 },
    { week: 10, dateRange: 'Oct 28 – Nov 3',  spend: 51000,  spendForecast: 48000,  leads: 1800, leadsForecast: 1700, enrolls: 71,  enrollForecast: 68,  cpl: 28.33, cpe: 718.31,  cvr: 3.94 },
  ],
  pacing: makePacing(841, 90, 1),
};

const whartonWinter2025: CohortData = {
  cohort: 'Winter 2025',
  family: 'wharton',
  status: 'closed',
  totalGoal: 880,
  totalEnrolls: 863,
  totalForecast: 863,
  totalSpend: 791000,
  roas: 2.9,
  cpl: 25.82,
  cpe: 916.57,
  cvr: 2.82,
  daysTotal: 90,
  daysRemaining: 0,
  channels: [
    { channel: 'Google Ads',                enrolls: 308, pct: 35.7, leads: 10800, spend: 328000, roas: 3.2, cpl: 30.37, cpe: 1064.94, cvr: 2.85 },
    { channel: 'Facebook / Instagram Ads',  enrolls: 132, pct: 15.3, leads: 4900,  spend: 171000, roas: 2.6, cpl: 34.90, cpe: 1295.45, cvr: 2.69 },
    { channel: 'LinkedIn Ads',              enrolls: 88,  pct: 10.2, leads: 2500,  spend: 143000, roas: 2.1, cpl: 57.20, cpe: 1625.00, cvr: 3.52 },
    { channel: 'Other Paid',                enrolls: 38,  pct: 4.4,  leads: 1000,  spend: 149000, roas: 0.9, cpl: 149.00, cpe: 3921.05, cvr: 3.80 },
    { channel: 'Email – WSP Leads',         enrolls: 178, pct: 20.6, leads: 8800,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.02 },
    { channel: 'Email – WSP Customers',     enrolls: 50,  pct: 5.8,  leads: 1800,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.78 },
    { channel: 'Organic Search',            enrolls: 48,  pct: 5.6,  leads: 1400,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.43 },
    { channel: 'WSP Social',                enrolls: 11,  pct: 1.3,  leads: 380,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.89 },
    { channel: 'Referrals',                 enrolls: 10,  pct: 1.2,  leads: 260,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.85 },
    { channel: 'Offline / Direct',          enrolls: 0,   pct: 0.0,  leads: 0,     spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 0    },
  ],
  programs: [
    { program: 'PE',   enrolls: 248, goal: 235, forecast: 248, leads: 8600,  cvr: 2.88, cpl: 27.91, cpe: 969.35 },
    { program: 'RE',   enrolls: 270, goal: 260, forecast: 270, leads: 9100,  cvr: 2.97, cpl: 24.62, cpe: 829.63 },
    { program: 'FP&A', enrolls: 258, goal: 270, forecast: 258, leads: 8300,  cvr: 3.11, cpl: 23.37, cpe: 751.16 },
    { program: 'AVI',  enrolls: 87,  goal: 115, forecast: 87,  leads: 3820,  cvr: 2.28, cpl: 29.84, cpe: 1308.28 },
  ],
  weekly: [
    { week: 1,  dateRange: 'Jan 6 – Jan 12',  spend: 37800,  spendForecast: 39000,  leads: 1480, leadsForecast: 1550, enrolls: 30,  enrollForecast: 33,  cpl: 25.54, cpe: 1260.00, cvr: 2.03 },
    { week: 2,  dateRange: 'Jan 13 – Jan 19',  spend: 56200,  spendForecast: 56000,  leads: 2180, leadsForecast: 2200, enrolls: 55,  enrollForecast: 56,  cpl: 25.78, cpe: 1021.82, cvr: 2.52 },
    { week: 3,  dateRange: 'Jan 20 – Jan 26',  spend: 64800,  spendForecast: 62000,  leads: 2520, leadsForecast: 2450, enrolls: 70,  enrollForecast: 67,  cpl: 25.71, cpe: 925.71,  cvr: 2.78 },
    { week: 4,  dateRange: 'Jan 27 – Feb 2',   spend: 70100,  spendForecast: 66000,  leads: 2780, leadsForecast: 2650, enrolls: 81,  enrollForecast: 77,  cpl: 25.22, cpe: 865.43,  cvr: 2.91 },
    { week: 5,  dateRange: 'Feb 3 – Feb 9',    spend: 73600,  spendForecast: 71000,  leads: 3020, leadsForecast: 2850, enrolls: 92,  enrollForecast: 88,  cpl: 24.37, cpe: 800.00,  cvr: 3.05 },
    { week: 6,  dateRange: 'Feb 10 – Feb 16',  spend: 80200,  spendForecast: 76000,  leads: 3280, leadsForecast: 3150, enrolls: 106, enrollForecast: 100, cpl: 24.45, cpe: 756.60,  cvr: 3.23 },
    { week: 7,  dateRange: 'Feb 17 – Feb 23',  spend: 87100,  spendForecast: 84000,  leads: 3500, leadsForecast: 3380, enrolls: 122, enrollForecast: 116, cpl: 24.89, cpe: 713.93,  cvr: 3.49 },
    { week: 8,  dateRange: 'Feb 24 – Mar 2',   spend: 91400,  spendForecast: 90000,  leads: 3700, leadsForecast: 3580, enrolls: 136, enrollForecast: 132, cpl: 24.70, cpe: 672.06,  cvr: 3.68 },
    { week: 9,  dateRange: 'Mar 3 – Mar 9',    spend: 74200,  spendForecast: 71000,  leads: 2980, leadsForecast: 2850, enrolls: 108, enrollForecast: 103, cpl: 24.90, cpe: 687.04,  cvr: 3.62 },
    { week: 10, dateRange: 'Mar 10 – Mar 16',  spend: 55600,  spendForecast: 52000,  leads: 1940, leadsForecast: 1850, enrolls: 63,  enrollForecast: 60,  cpl: 28.66, cpe: 882.54,  cvr: 3.25 },
  ],
  pacing: makePacing(863, 90, 1),
};

const whartonFall2025: CohortData = {
  cohort: 'Fall 2025',
  family: 'wharton',
  status: 'closed',
  totalGoal: 900,
  totalEnrolls: 897,
  totalForecast: 897,
  totalSpend: 813444,
  roas: 3.0,
  cpl: 26.97,
  cpe: 906.85,
  cvr: 2.97,
  daysTotal: 90,
  daysRemaining: 0,
  channels: [
    { channel: 'Google Ads',                enrolls: 322, pct: 35.9, leads: 10900, spend: 335000, roas: 3.3, cpl: 30.73, cpe: 1040.37, cvr: 2.95 },
    { channel: 'Facebook / Instagram Ads',  enrolls: 138, pct: 15.4, leads: 5100,  spend: 176000, roas: 2.7, cpl: 34.51, cpe: 1275.36, cvr: 2.71 },
    { channel: 'LinkedIn Ads',              enrolls: 90,  pct: 10.0, leads: 2600,  spend: 148000, roas: 2.1, cpl: 56.92, cpe: 1644.44, cvr: 3.46 },
    { channel: 'Other Paid',                enrolls: 42,  pct: 4.7,  leads: 1100,  spend: 154444, roas: 0.9, cpl: 140.40, cpe: 3677.24, cvr: 3.82 },
    { channel: 'Email – WSP Leads',         enrolls: 185, pct: 20.6, leads: 9100,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.03 },
    { channel: 'Email – WSP Customers',     enrolls: 53,  pct: 5.9,  leads: 1860,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.85 },
    { channel: 'Organic Search',            enrolls: 47,  pct: 5.2,  leads: 1380,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.41 },
    { channel: 'WSP Social',                enrolls: 10,  pct: 1.1,  leads: 360,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.78 },
    { channel: 'Referrals',                 enrolls: 10,  pct: 1.1,  leads: 260,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.85 },
    { channel: 'Offline / Direct',          enrolls: 0,   pct: 0.0,  leads: 0,     spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 0    },
  ],
  programs: [
    { program: 'PE',   enrolls: 252, goal: 240, forecast: 252, leads: 8700,  cvr: 2.90, cpl: 27.38, cpe: 793.68 },
    { program: 'RE',   enrolls: 277, goal: 265, forecast: 277, leads: 9200,  cvr: 3.01, cpl: 25.41, cpe: 730.37 },
    { program: 'FP&A', enrolls: 274, goal: 280, forecast: 274, leads: 8500,  cvr: 3.22, cpl: 20.44, cpe: 710.66 },
    { program: 'AVI',  enrolls: 94,  goal: 115, forecast: 94,  leads: 3860,  cvr: 2.44, cpl: 24.47, cpe: 1397.23 },
  ],
  weekly: [
    { week: 1,  dateRange: 'Aug 25 – Aug 31',  spend: 38400,  spendForecast: 39500,  leads: 1510, leadsForecast: 1560, enrolls: 31,  enrollForecast: 34,  cpl: 25.43, cpe: 1238.71, cvr: 2.05 },
    { week: 2,  dateRange: 'Sep 1 – Sep 7',    spend: 56800,  spendForecast: 56500,  leads: 2200, leadsForecast: 2220, enrolls: 56,  enrollForecast: 57,  cpl: 25.82, cpe: 1014.29, cvr: 2.55 },
    { week: 3,  dateRange: 'Sep 8 – Sep 14',   spend: 65200,  spendForecast: 63000,  leads: 2520, leadsForecast: 2460, enrolls: 72,  enrollForecast: 68,  cpl: 25.87, cpe: 905.56,  cvr: 2.86 },
    { week: 4,  dateRange: 'Sep 15 – Sep 21',  spend: 71400,  spendForecast: 67500,  leads: 2840, leadsForecast: 2680, enrolls: 84,  enrollForecast: 78,  cpl: 25.14, cpe: 850.00,  cvr: 2.96 },
    { week: 5,  dateRange: 'Sep 22 – Sep 28',  spend: 75100,  spendForecast: 72000,  leads: 3050, leadsForecast: 2880, enrolls: 97,  enrollForecast: 90,  cpl: 24.62, cpe: 774.23,  cvr: 3.18 },
    { week: 6,  dateRange: 'Sep 29 – Oct 5',   spend: 81600,  spendForecast: 77000,  leads: 3310, leadsForecast: 3180, enrolls: 110, enrollForecast: 102, cpl: 24.65, cpe: 741.82,  cvr: 3.32 },
    { week: 7,  dateRange: 'Oct 6 – Oct 12',   spend: 88300,  spendForecast: 85500,  leads: 3550, leadsForecast: 3420, enrolls: 126, enrollForecast: 118, cpl: 24.87, cpe: 700.79,  cvr: 3.55 },
    { week: 8,  dateRange: 'Oct 13 – Oct 19',  spend: 93100,  spendForecast: 91500,  leads: 3760, leadsForecast: 3620, enrolls: 140, enrollForecast: 135, cpl: 24.76, cpe: 665.00,  cvr: 3.72 },
    { week: 9,  dateRange: 'Oct 20 – Oct 26',  spend: 76900,  spendForecast: 73000,  leads: 3020, leadsForecast: 2880, enrolls: 112, enrollForecast: 105, cpl: 25.46, cpe: 686.61,  cvr: 3.71 },
    { week: 10, dateRange: 'Oct 27 – Nov 2',   spend: 66644,  spendForecast: 63000,  leads: 2280, leadsForecast: 2100, enrolls: 69,  enrollForecast: 64,  cpl: 29.23, cpe: 965.71,  cvr: 3.03 },
  ],
  pacing: makePacing(897, 90, 1),
};

const whartonSpring2026: CohortData = {
  cohort: 'Spring 2026',
  family: 'wharton',
  status: 'closed',
  totalGoal: 1130,
  totalEnrolls: 964,
  totalForecast: 1225,
  totalSpend: 643200,
  roas: 2.4,
  cpl: 28.14,
  cpe: 933.09,
  cvr: 3.02,
  daysTotal: 120,
  daysRemaining: 0,
  channels: [
    { channel: 'Google Ads',                enrolls: 348, pct: 36.1, leads: 11200, spend: 278000, roas: 2.7, cpl: 24.82, cpe: 799.43, cvr: 3.11 },
    { channel: 'Facebook / Instagram Ads',  enrolls: 148, pct: 15.4, leads: 5400,  spend: 155000, roas: 2.4, cpl: 28.70, cpe: 1047.30, cvr: 2.74 },
    { channel: 'LinkedIn Ads',              enrolls: 98,  pct: 10.2, leads: 2820,  spend: 128000, roas: 2.3, cpl: 45.39, cpe: 1306.12, cvr: 3.47 },
    { channel: 'Other Paid',                enrolls: 44,  pct: 4.6,  leads: 1150,  spend: 82200,  roas: 1.5, cpl: 71.48, cpe: 1868.18, cvr: 3.83 },
    { channel: 'Email – WSP Leads',         enrolls: 196, pct: 20.3, leads: 9300,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.11 },
    { channel: 'Email – WSP Customers',     enrolls: 58,  pct: 6.0,  leads: 1980,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.93 },
    { channel: 'Organic Search',            enrolls: 55,  pct: 5.7,  leads: 1500,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.67 },
    { channel: 'WSP Social',                enrolls: 9,   pct: 0.9,  leads: 310,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.90 },
    { channel: 'Referrals',                 enrolls: 8,   pct: 0.8,  leads: 220,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.64 },
    { channel: 'Offline / Direct',          enrolls: 0,   pct: 0.0,  leads: 0,     spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 0    },
  ],
  programs: [
    { program: 'PE',   enrolls: 284, goal: 260, forecast: 325, leads: 9600,  cvr: 2.96, cpl: 28.54, cpe: 964.79 },
    { program: 'RE',   enrolls: 338, goal: 286, forecast: 380, leads: 11200, cvr: 3.02, cpl: 26.89, cpe: 890.53 },
    { program: 'FP&A', enrolls: 245, goal: 282, forecast: 292, leads: 8400,  cvr: 2.92, cpl: 22.31, cpe: 764.08 },
    { program: 'AVI',  enrolls: 97,  goal: 97,  forecast: 118, leads: 3800,  cvr: 2.55, cpl: 27.63, cpe: 1083.51 },
    { program: 'RDI',  enrolls: 0,   goal: 205, forecast: 110, leads: 2880,  cvr: 0,    cpl: 0,      cpe: 0       },
  ],
  weekly: [
    { week: 1,  dateRange: 'Feb 17 – Feb 23',  spend: 32100,  spendForecast: 33000,  leads: 1180, leadsForecast: 1250, enrolls: 24,  enrollForecast: 28,  cpl: 27.20, cpe: 1337.50, cvr: 2.03 },
    { week: 2,  dateRange: 'Feb 24 – Mar 2',   spend: 46200,  spendForecast: 47000,  leads: 1720, leadsForecast: 1780, enrolls: 48,  enrollForecast: 51,  cpl: 26.86, cpe: 962.50,  cvr: 2.79 },
    { week: 3,  dateRange: 'Mar 3 – Mar 9',    spend: 55800,  spendForecast: 54500,  leads: 2100, leadsForecast: 2080, enrolls: 65,  enrollForecast: 63,  cpl: 26.57, cpe: 858.46,  cvr: 3.10 },
    { week: 4,  dateRange: 'Mar 10 – Mar 16',  spend: 62400,  spendForecast: 60000,  leads: 2380, leadsForecast: 2310, enrolls: 80,  enrollForecast: 76,  cpl: 26.22, cpe: 780.00,  cvr: 3.36 },
    { week: 5,  dateRange: 'Mar 17 – Mar 23',  spend: 67900,  spendForecast: 65500,  leads: 2620, leadsForecast: 2520, enrolls: 95,  enrollForecast: 90,  cpl: 25.92, cpe: 714.74,  cvr: 3.63 },
    { week: 6,  dateRange: 'Mar 24 – Mar 30',  spend: 74600,  spendForecast: 72000,  leads: 2900, leadsForecast: 2780, enrolls: 108, enrollForecast: 103, cpl: 25.72, cpe: 690.74,  cvr: 3.72 },
    { week: 7,  dateRange: 'Mar 31 – Apr 6',   spend: 80200,  spendForecast: 78500,  leads: 3180, leadsForecast: 3040, enrolls: 122, enrollForecast: 116, cpl: 25.22, cpe: 657.38,  cvr: 3.84 },
    { week: 8,  dateRange: 'Apr 7 – Apr 13',   spend: 86400,  spendForecast: 84000,  leads: 3400, leadsForecast: 3280, enrolls: 136, enrollForecast: 129, cpl: 25.41, cpe: 635.29,  cvr: 4.00 },
    { week: 9,  dateRange: 'Apr 14 – Apr 20',  spend: 76976,  spendForecast: 80000,  leads: 893,  leadsForecast: 3100, enrolls: 93,  enrollForecast: 125, cpl: 86.20, cpe: 827.70,  cvr: 10.41 },
    { week: 10, dateRange: 'Apr 21 – Apr 27',  spend: 13241,  spendForecast: 25000,  leads: 132,  leadsForecast: 800,  enrolls: 8,   enrollForecast: 42,  cpl: 100.31, cpe: 1655.13, cvr: 6.06 },
  ],
  pacing: makePacing(964, 120, 1),
};

// Wharton Fall 2026 — the active cohort (opened Jun 16 per the academic
// calendar; early-cycle state).
const whartonFall2026: CohortData = {
  cohort: 'Fall 2026',
  family: 'wharton',
  status: 'active',
  totalGoal: 1225,
  totalEnrolls: 26,
  totalForecast: 24,
  totalSpend: 51200,
  roas: 0.7,
  cpl: 56.20,
  cpe: 1969.23,
  cvr: 1.31,
  daysTotal: 119,
  daysRemaining: 102,
  channels: [
    { channel: 'Google Ads',                enrolls: 9,  pct: 34.6, leads: 380, spend: 21400, roas: 0.9, cpl: 56.32, cpe: 2377.78, cvr: 2.37 },
    { channel: 'Facebook / Instagram Ads',  enrolls: 5,  pct: 19.2, leads: 290, spend: 13800, roas: 0.8, cpl: 47.59, cpe: 2760.00, cvr: 1.72 },
    { channel: 'LinkedIn Ads',              enrolls: 2,  pct: 7.7,  leads: 90,  spend: 8600,  roas: 0.5, cpl: 95.56, cpe: 4300.00, cvr: 2.22 },
    { channel: 'Other Paid',                enrolls: 1,  pct: 3.8,  leads: 40,  spend: 7400,  roas: 0.3, cpl: 185.00, cpe: 7400.00, cvr: 2.50 },
    { channel: 'Email – WSP Leads',         enrolls: 4,  pct: 15.4, leads: 310, spend: 0,     roas: 0,   cpl: 0,      cpe: 0,       cvr: 1.29 },
    { channel: 'Email – WSP Customers',     enrolls: 2,  pct: 7.7,  leads: 80,  spend: 0,     roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.50 },
    { channel: 'Organic Search',            enrolls: 2,  pct: 7.7,  leads: 70,  spend: 0,     roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.86 },
    { channel: 'WSP Social',                enrolls: 1,  pct: 3.8,  leads: 20,  spend: 0,     roas: 0,   cpl: 0,      cpe: 0,       cvr: 5.00 },
    { channel: 'Referrals',                 enrolls: 0,  pct: 0.0,  leads: 10,  spend: 0,     roas: 0,   cpl: 0,      cpe: 0,       cvr: 0    },
    { channel: 'Offline / Direct',          enrolls: 0,  pct: 0.0,  leads: 0,   spend: 0,     roas: 0,   cpl: 0,      cpe: 0,       cvr: 0    },
  ],
  programs: [
    { program: 'PE',   enrolls: 8, goal: 300, forecast: 7, leads: 400, cvr: 2.00, cpl: 38.00, cpe: 1900.00 },
    { program: 'RE',   enrolls: 7, goal: 310, forecast: 6, leads: 330, cvr: 2.12, cpl: 40.10, cpe: 1890.00 },
    { program: 'FP&A', enrolls: 5, goal: 300, forecast: 6, leads: 340, cvr: 1.47, cpl: 42.90, cpe: 2916.00 },
    { program: 'AVI',  enrolls: 4, goal: 190, forecast: 3, leads: 140, cvr: 2.86, cpl: 51.40, cpe: 1800.00 },
    { program: 'RDI',  enrolls: 2, goal: 125, forecast: 2, leads: 80,  cvr: 2.50, cpl: 55.00, cpe: 2200.00 },
  ],
  weekly: [
    { week: 1, dateRange: 'Jun 16 – Jun 22', spend: 2000,  spendForecast: 2400,  leads: 145, leadsForecast: 327, enrolls: 3,  enrollForecast: 2,  cpl: 13.81, cpe: 667.63,  cvr: 2.07 },
    { week: 2, dateRange: 'Jun 23 – Jun 29', spend: 34400, spendForecast: 30000, leads: 483, leadsForecast: 304, enrolls: 6,  enrollForecast: 4,  cpl: 71.28, cpe: 5738.09, cvr: 1.24 },
    { week: 3, dateRange: 'Jun 30 – Jul 6',  spend: 14800, spendForecast: 16000, leads: 215, leadsForecast: 417, enrolls: 2,  enrollForecast: 17, cpl: 59.57, cpe: 6404.15, cvr: 0.93 },
  ],
  pacing: makePacing(1180, 119, 0.14),
};

// ─── Columbia Cohorts ─────────────────────────────────────────────────────────

const columbiaSummer2025: CohortData = {
  cohort: 'Summer 2025',
  family: 'columbia',
  status: 'closed',
  totalGoal: 500,
  totalEnrolls: 487,
  totalForecast: 487,
  totalSpend: 524000,
  roas: 2.5,
  cpl: 34.28,
  cpe: 1075.98,
  cvr: 2.18,
  daysTotal: 90,
  daysRemaining: 0,
  channels: [
    { channel: 'Google Ads',                enrolls: 168, pct: 34.5, leads: 6400,  spend: 218000, roas: 2.8, cpl: 34.06, cpe: 1297.62, cvr: 2.63 },
    { channel: 'Facebook / Instagram Ads',  enrolls: 78,  pct: 16.0, leads: 3200,  spend: 142000, roas: 2.2, cpl: 44.38, cpe: 1820.51, cvr: 2.44 },
    { channel: 'LinkedIn Ads',              enrolls: 62,  pct: 12.7, leads: 1800,  spend: 108000, roas: 2.0, cpl: 60.00, cpe: 1741.94, cvr: 3.44 },
    { channel: 'Other Paid',                enrolls: 24,  pct: 4.9,  leads: 640,   spend: 56000,  roas: 1.5, cpl: 87.50, cpe: 2333.33, cvr: 3.75 },
    { channel: 'Email – WSP Leads',         enrolls: 88,  pct: 18.1, leads: 4200,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.10 },
    { channel: 'Email – WSP Customers',     enrolls: 28,  pct: 5.7,  leads: 980,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.86 },
    { channel: 'Organic Search',            enrolls: 28,  pct: 5.7,  leads: 840,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.33 },
    { channel: 'WSP Social',                enrolls: 7,   pct: 1.4,  leads: 220,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.18 },
    { channel: 'Referrals',                 enrolls: 4,   pct: 0.8,  leads: 120,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.33 },
    { channel: 'Offline / Direct',          enrolls: 0,   pct: 0.0,  leads: 0,     spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 0    },
  ],
  programs: [
    { program: 'AI Finance',     enrolls: 312, goal: 320, forecast: 312, leads: 9200,  cvr: 3.39, cpl: 32.84, cpe: 968.59 },
    { program: 'AI Accounting',  enrolls: 175, goal: 180, forecast: 175, leads: 6200,  cvr: 2.82, cpl: 36.77, cpe: 1303.43 },
  ],
  weekly: [
    { week: 1,  dateRange: 'Jun 9 – Jun 15',   spend: 24800,  spendForecast: 26000,  leads: 720,  leadsForecast: 760,  enrolls: 14,  enrollForecast: 16,  cpl: 34.44, cpe: 1771.43, cvr: 1.94 },
    { week: 2,  dateRange: 'Jun 16 – Jun 22',  spend: 38200,  spendForecast: 39000,  leads: 1100, leadsForecast: 1140, enrolls: 28,  enrollForecast: 30,  cpl: 34.73, cpe: 1364.29, cvr: 2.55 },
    { week: 3,  dateRange: 'Jun 23 – Jun 29',  spend: 48400,  spendForecast: 47500,  leads: 1420, leadsForecast: 1400, enrolls: 42,  enrollForecast: 40,  cpl: 34.08, cpe: 1152.38, cvr: 2.96 },
    { week: 4,  dateRange: 'Jun 30 – Jul 6',   spend: 54200,  spendForecast: 52000,  leads: 1580, leadsForecast: 1520, enrolls: 52,  enrollForecast: 49,  cpl: 34.30, cpe: 1042.31, cvr: 3.29 },
    { week: 5,  dateRange: 'Jul 7 – Jul 13',   spend: 58900,  spendForecast: 57000,  leads: 1720, leadsForecast: 1660, enrolls: 60,  enrollForecast: 57,  cpl: 34.24, cpe: 981.67,  cvr: 3.49 },
    { week: 6,  dateRange: 'Jul 14 – Jul 20',  spend: 64800,  spendForecast: 62500,  leads: 1900, leadsForecast: 1820, enrolls: 72,  enrollForecast: 68,  cpl: 34.11, cpe: 900.00,  cvr: 3.79 },
    { week: 7,  dateRange: 'Jul 21 – Jul 27',  spend: 70100,  spendForecast: 68000,  leads: 2060, leadsForecast: 1980, enrolls: 84,  enrollForecast: 79,  cpl: 34.03, cpe: 834.52,  cvr: 4.08 },
    { week: 8,  dateRange: 'Jul 28 – Aug 3',   spend: 74300,  spendForecast: 73500,  leads: 2180, leadsForecast: 2100, enrolls: 94,  enrollForecast: 90,  cpl: 34.08, cpe: 790.43,  cvr: 4.31 },
    { week: 9,  dateRange: 'Aug 4 – Aug 10',   spend: 62100,  spendForecast: 60000,  leads: 1820, leadsForecast: 1740, enrolls: 76,  enrollForecast: 72,  cpl: 34.12, cpe: 817.11,  cvr: 4.18 },
    { week: 10, dateRange: 'Aug 11 – Aug 17',  spend: 28200,  spendForecast: 26000,  leads: 900,  leadsForecast: 800,  enrolls: 39,  enrollForecast: 35,  cpl: 31.33, cpe: 723.08,  cvr: 4.33 },
  ],
  pacing: makePacing(487, 90, 1),
};

const columbiaFall2025: CohortData = {
  cohort: 'Fall 2025',
  family: 'columbia',
  status: 'closed',
  totalGoal: 520,
  totalEnrolls: 508,
  totalForecast: 508,
  totalSpend: 548600,
  roas: 2.6,
  cpl: 33.52,
  cpe: 1080.00,
  cvr: 2.31,
  daysTotal: 90,
  daysRemaining: 0,
  channels: [
    { channel: 'Google Ads',                enrolls: 178, pct: 35.0, leads: 6800,  spend: 226000, roas: 2.9, cpl: 33.24, cpe: 1269.66, cvr: 2.62 },
    { channel: 'Facebook / Instagram Ads',  enrolls: 80,  pct: 15.7, leads: 3320,  spend: 148000, roas: 2.3, cpl: 44.58, cpe: 1850.00, cvr: 2.41 },
    { channel: 'LinkedIn Ads',              enrolls: 64,  pct: 12.6, leads: 1860,  spend: 112000, roas: 2.1, cpl: 60.22, cpe: 1750.00, cvr: 3.44 },
    { channel: 'Other Paid',                enrolls: 26,  pct: 5.1,  leads: 660,   spend: 62600,  roas: 1.5, cpl: 94.85, cpe: 2407.69, cvr: 3.94 },
    { channel: 'Email – WSP Leads',         enrolls: 94,  pct: 18.5, leads: 4400,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.14 },
    { channel: 'Email – WSP Customers',     enrolls: 30,  pct: 5.9,  leads: 1020,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.94 },
    { channel: 'Organic Search',            enrolls: 26,  pct: 5.1,  leads: 780,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.33 },
    { channel: 'WSP Social',                enrolls: 6,   pct: 1.2,  leads: 210,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.86 },
    { channel: 'Referrals',                 enrolls: 4,   pct: 0.8,  leads: 110,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.64 },
    { channel: 'Offline / Direct',          enrolls: 0,   pct: 0.0,  leads: 0,     spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 0    },
  ],
  programs: [
    { program: 'AI Finance',     enrolls: 324, goal: 332, forecast: 324, leads: 9600,  cvr: 3.38, cpl: 31.86, cpe: 942.59 },
    { program: 'AI Accounting',  enrolls: 184, goal: 188, forecast: 184, leads: 6560,  cvr: 2.80, cpl: 36.28, cpe: 1295.65 },
  ],
  weekly: [
    { week: 1,  dateRange: 'Sep 1 – Sep 7',    spend: 26400,  spendForecast: 27200,  leads: 780,  leadsForecast: 810,  enrolls: 16,  enrollForecast: 17,  cpl: 33.85, cpe: 1650.00, cvr: 2.05 },
    { week: 2,  dateRange: 'Sep 8 – Sep 14',   spend: 40100,  spendForecast: 40800,  leads: 1180, leadsForecast: 1200, enrolls: 31,  enrollForecast: 32,  cpl: 33.98, cpe: 1293.55, cvr: 2.63 },
    { week: 3,  dateRange: 'Sep 15 – Sep 21',  spend: 50200,  spendForecast: 49500,  leads: 1480, leadsForecast: 1460, enrolls: 46,  enrollForecast: 44,  cpl: 33.92, cpe: 1091.30, cvr: 3.11 },
    { week: 4,  dateRange: 'Sep 22 – Sep 28',  spend: 56800,  spendForecast: 54800,  leads: 1680, leadsForecast: 1620, enrolls: 56,  enrollForecast: 53,  cpl: 33.81, cpe: 1014.29, cvr: 3.33 },
    { week: 5,  dateRange: 'Sep 29 – Oct 5',   spend: 61400,  spendForecast: 59600,  leads: 1820, leadsForecast: 1760, enrolls: 64,  enrollForecast: 61,  cpl: 33.74, cpe: 959.38,  cvr: 3.52 },
    { week: 6,  dateRange: 'Oct 6 – Oct 12',   spend: 67600,  spendForecast: 65500,  leads: 2020, leadsForecast: 1940, enrolls: 76,  enrollForecast: 72,  cpl: 33.47, cpe: 889.47,  cvr: 3.76 },
    { week: 7,  dateRange: 'Oct 13 – Oct 19',  spend: 73200,  spendForecast: 71400,  leads: 2200, leadsForecast: 2120, enrolls: 88,  enrollForecast: 84,  cpl: 33.27, cpe: 831.82,  cvr: 4.00 },
    { week: 8,  dateRange: 'Oct 20 – Oct 26',  spend: 77800,  spendForecast: 76800,  leads: 2340, leadsForecast: 2280, enrolls: 98,  enrollForecast: 94,  cpl: 33.25, cpe: 793.88,  cvr: 4.19 },
    { week: 9,  dateRange: 'Oct 27 – Nov 2',   spend: 65400,  spendForecast: 63200,  leads: 1960, leadsForecast: 1880, enrolls: 80,  enrollForecast: 76,  cpl: 33.37, cpe: 817.50,  cvr: 4.08 },
    { week: 10, dateRange: 'Nov 3 – Nov 9',    spend: 29700,  spendForecast: 27600,  leads: 900,  leadsForecast: 820,  enrolls: 53,  enrollForecast: 48,  cpl: 33.00, cpe: 560.38,  cvr: 5.89 },
  ],
  pacing: makePacing(508, 90, 1),
};

const columbiaWinter2026: CohortData = {
  cohort: 'Winter 2026',
  family: 'columbia',
  status: 'closed',
  totalGoal: 560,
  totalEnrolls: 284,
  totalForecast: 520,
  totalSpend: 312400,
  roas: 1.8,
  cpl: 35.62,
  cpe: 1100.00,
  cvr: 2.42,
  daysTotal: 90,
  daysRemaining: 0,
  channels: [
    { channel: 'Google Ads',                enrolls: 98,  pct: 34.5, leads: 3600,  spend: 124000, roas: 2.1, cpl: 34.44, cpe: 1265.31, cvr: 2.72 },
    { channel: 'Facebook / Instagram Ads',  enrolls: 44,  pct: 15.5, leads: 1780,  spend: 86400,  roas: 1.7, cpl: 48.54, cpe: 1963.64, cvr: 2.47 },
    { channel: 'LinkedIn Ads',              enrolls: 34,  pct: 12.0, leads: 980,   spend: 62000,  roas: 1.8, cpl: 63.27, cpe: 1823.53, cvr: 3.47 },
    { channel: 'Other Paid',                enrolls: 14,  pct: 4.9,  leads: 360,   spend: 40000,  roas: 1.2, cpl: 111.11, cpe: 2857.14, cvr: 3.89 },
    { channel: 'Email – WSP Leads',         enrolls: 52,  pct: 18.3, leads: 2400,  spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 2.17 },
    { channel: 'Email – WSP Customers',     enrolls: 18,  pct: 6.3,  leads: 580,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.10 },
    { channel: 'Organic Search',            enrolls: 16,  pct: 5.6,  leads: 440,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.64 },
    { channel: 'WSP Social',                enrolls: 4,   pct: 1.4,  leads: 120,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 3.33 },
    { channel: 'Referrals',                 enrolls: 4,   pct: 1.4,  leads: 100,   spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 4.00 },
    { channel: 'Offline / Direct',          enrolls: 0,   pct: 0.0,  leads: 0,     spend: 0,      roas: 0,   cpl: 0,      cpe: 0,       cvr: 0    },
  ],
  programs: [
    { program: 'AI Finance',     enrolls: 180, goal: 355, forecast: 328, leads: 5420,  cvr: 3.32, cpl: 33.82, cpe: 1018.89 },
    { program: 'AI Accounting',  enrolls: 104, goal: 205, forecast: 192, leads: 3440,  cvr: 3.02, cpl: 38.37, cpe: 1270.19 },
  ],
  weekly: [
    { week: 1,  dateRange: 'Feb 2 – Feb 8',    spend: 28200,  spendForecast: 29000,  leads: 790,  leadsForecast: 820,  enrolls: 18,  enrollForecast: 20,  cpl: 35.70, cpe: 1566.67, cvr: 2.28 },
    { week: 2,  dateRange: 'Feb 9 – Feb 15',   spend: 42100,  spendForecast: 43500,  leads: 1180, leadsForecast: 1220, enrolls: 32,  enrollForecast: 34,  cpl: 35.68, cpe: 1315.63, cvr: 2.71 },
    { week: 3,  dateRange: 'Feb 16 – Feb 22',  spend: 52800,  spendForecast: 51200,  leads: 1480, leadsForecast: 1440, enrolls: 48,  enrollForecast: 45,  cpl: 35.68, cpe: 1100.00, cvr: 3.24 },
    { week: 4,  dateRange: 'Feb 23 – Mar 1',   spend: 58600,  spendForecast: 57000,  leads: 1640, leadsForecast: 1600, enrolls: 60,  enrollForecast: 57,  cpl: 35.73, cpe: 976.67,  cvr: 3.66 },
    { week: 5,  dateRange: 'Mar 2 – Mar 8',    spend: 64200,  spendForecast: 63000,  leads: 1800, leadsForecast: 1760, enrolls: 72,  enrollForecast: 69,  cpl: 35.67, cpe: 891.67,  cvr: 4.00 },
    { week: 6,  dateRange: 'Mar 9 – Mar 15',   spend: 66500,  spendForecast: 70000,  leads: 1870, leadsForecast: 1960, enrolls: 54,  enrollForecast: 74,  cpl: 35.56, cpe: 1231.48, cvr: 2.89 },
  ],
  pacing: makePacing(284, 90, 1),
};

// Columbia "Spring 2026" marketing cohort (academic Summer 2026 term) — the
// active cohort: enrollment ends Jul 13, extension through Jul 20.
const columbiaSpring2026: CohortData = {
  cohort: 'Spring 2026',
  family: 'columbia',
  status: 'active',
  totalGoal: 468,
  totalEnrolls: 367,
  totalForecast: 292,
  totalSpend: 180700,
  roas: 5.5,
  cpl: 43.46,
  cpe: 493.76,
  cvr: 8.9,
  daysTotal: 119,
  daysRemaining: 18,
  channels: [
    { channel: 'Google Ads',                enrolls: 62, pct: 16.9, leads: 1520, spend: 98400, roas: 1.6, cpl: 64.74, cpe: 1587.10, cvr: 4.08 },
    { channel: 'Facebook / Instagram Ads',  enrolls: 24, pct: 6.5,  leads: 980,  spend: 42600, roas: 1.4, cpl: 43.47, cpe: 1775.00, cvr: 2.45 },
    { channel: 'LinkedIn Ads',              enrolls: 8,  pct: 2.2,  leads: 260,  spend: 17400, roas: 1.1, cpl: 66.92, cpe: 2175.00, cvr: 3.08 },
    { channel: 'Other Paid',                enrolls: 23, pct: 6.3,  leads: 240,  spend: 22300, roas: 4.6, cpl: 92.92, cpe: 969.57,  cvr: 9.58 },
    { channel: 'Email – WSP Leads',         enrolls: 34, pct: 9.3,  leads: 620,  spend: 0,     roas: 0,   cpl: 0,      cpe: 0,       cvr: 5.48 },
    { channel: 'Email – WSP Customers',     enrolls: 59, pct: 16.1, leads: 360,  spend: 0,     roas: 0,   cpl: 0,      cpe: 0,       cvr: 16.39 },
    { channel: 'Organic Search',            enrolls: 47, pct: 12.8, leads: 430,  spend: 0,     roas: 0,   cpl: 0,      cpe: 0,       cvr: 10.93 },
    { channel: 'WSP Social',                enrolls: 13, pct: 3.5,  leads: 150,  spend: 0,     roas: 0,   cpl: 0,      cpe: 0,       cvr: 8.67 },
    { channel: 'Referrals',                 enrolls: 39, pct: 10.6, leads: 340,  spend: 0,     roas: 0,   cpl: 0,      cpe: 0,       cvr: 11.47 },
    { channel: 'Offline / Direct',          enrolls: 58, pct: 15.8, leads: 430,  spend: 0,     roas: 0,   cpl: 0,      cpe: 0,       cvr: 13.49 },
  ],
  programs: [
    { program: 'AI Finance',     enrolls: 246, goal: 310, forecast: 196, leads: 2810, cvr: 8.75, cpl: 41.20, cpe: 470.00 },
    { program: 'AI Accounting',  enrolls: 121, goal: 158, forecast: 96,  leads: 1360, cvr: 8.90, cpl: 47.60, cpe: 540.00 },
  ],
  weekly: [
    { week: 10, dateRange: 'May 25 – May 31', spend: 12400, spendForecast: 12000, leads: 264, leadsForecast: 250, enrolls: 14, enrollForecast: 12, cpl: 46.97, cpe: 885.71,  cvr: 5.30 },
    { week: 11, dateRange: 'Jun 1 – Jun 7',   spend: 13100, spendForecast: 12800, leads: 287, leadsForecast: 275, enrolls: 19, enrollForecast: 16, cpl: 45.64, cpe: 689.47,  cvr: 6.62 },
    { week: 12, dateRange: 'Jun 8 – Jun 14',  spend: 13800, spendForecast: 13500, leads: 301, leadsForecast: 290, enrolls: 55, enrollForecast: 48, cpl: 45.85, cpe: 250.91,  cvr: 18.27 },
    { week: 13, dateRange: 'Jun 15 – Jun 21', spend: 12900, spendForecast: 13800, leads: 279, leadsForecast: 300, enrolls: 34, enrollForecast: 38, cpl: 46.24, cpe: 379.41,  cvr: 12.19 },
    { week: 14, dateRange: 'Jun 22 – Jun 28', spend: 13600, spendForecast: 13400, leads: 415, leadsForecast: 309, enrolls: 43, enrollForecast: 40, cpl: 32.77, cpe: 316.28,  cvr: 10.36 },
  ],
  pacing: makePacing(430, 119, 0.85),
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const WHARTON_COHORTS: CohortData[] = [
  whartonFall2024,
  whartonWinter2025,
  whartonFall2025,
  whartonSpring2026,
  whartonFall2026,
];

export const COLUMBIA_COHORTS: CohortData[] = [
  columbiaSummer2025,
  columbiaFall2025,
  columbiaWinter2026,
  columbiaSpring2026,
];
