/**
 * Certificate Program Configuration
 * Programs and cohort ordering for Wharton + Columbia certificate dashboards.
 */
export type CertProgram = {
  id: string;
  label: string;
  pattern: RegExp;     // matches live Airtable survey names
  historicalLabel: string; // matches program field in historicalNPS.json
  color: string;
  hex: string;
};

export const CERT_PROGRAMS: CertProgram[] = [
  { id: 'private-equity',       label: 'Private Equity',          pattern: /private equity/i,         historicalLabel: 'Private Equity',          color: 'text-violet-600', hex: '#7c3aed' },
  { id: 'real-estate',          label: 'Real Estate',             pattern: /real estate/i,             historicalLabel: 'Real Estate',             color: 'text-blue-600',   hex: '#2563eb' },
  { id: 'fpa',                  label: 'FP&A',                    pattern: /financial planning|fp&a/i, historicalLabel: 'FP&A',                    color: 'text-emerald-600',hex: '#059669' },
  { id: 'applied-value',        label: 'Applied Value Investing', pattern: /applied value investing/i, historicalLabel: 'Applied Value Investing', color: 'text-amber-600',  hex: '#d97706' },
  { id: 'ai-in-finance',        label: 'AI in Finance',           pattern: /ai for business|ai in finance/i, historicalLabel: 'AI in Finance',    color: 'text-pink-600',   hex: '#db2777' },
  { id: 'hedge-fund',           label: 'Hedge Fund',              pattern: /hedge fund/i,              historicalLabel: 'Hedge Fund',              color: 'text-slate-600',  hex: '#475569' },
  // Wharton live cohorts (Spring 2026 in Airtable — rename once program confirmed)
  { id: 'wharton-1',            label: 'Wharton Cohort I',        pattern: /wharton cohort i\b/i,      historicalLabel: '',                        color: 'text-indigo-600', hex: '#4f46e5' },
  { id: 'wharton-2',            label: 'Wharton Cohort II',       pattern: /wharton cohort ii\b/i,     historicalLabel: '',                        color: 'text-cyan-600',   hex: '#0891b2' },
  { id: 'wharton-3',            label: 'Wharton Cohort III',      pattern: /wharton cohort iii\b/i,    historicalLabel: '',                        color: 'text-teal-600',   hex: '#0d9488' },
];

// Ordered cohort periods for trend charts (oldest → newest)
export const COHORT_ORDER = [
  'Fall 2024',
  'Winter 2025',
  'Spring 2025',
  'Fall 2025',
  'Winter 2026',
  'Spring 2026',  // live Airtable data
];

export function matchProgram(surveyName: string): CertProgram | null {
  return CERT_PROGRAMS.find(p => p.pattern.test(surveyName)) ?? null;
}

export function matchProgramByLabel(label: string): CertProgram | null {
  return CERT_PROGRAMS.find(p => p.historicalLabel === label || p.label === label) ?? null;
}

export function isCertProgram(surveyName: string): boolean {
  return CERT_PROGRAMS.some(p => p.pattern.test(surveyName));
}

/** Simple keyword theme extractor */
export const THEMES = [
  { id: 'instruction',  label: 'Instructor Quality',    keywords: ['instructor', 'presenter', 'teacher', 'professor', 'taught', 'explained', 'teaching', 'professor'] },
  { id: 'content',      label: 'Content & Materials',   keywords: ['material', 'content', 'slide', 'case study', 'workbook', 'resource', 'curriculum'] },
  { id: 'pacing',       label: 'Pacing',                keywords: ['pace', 'pacing', 'fast', 'slow', 'rushed', 'timing', 'quickly', 'speed'] },
  { id: 'relevance',    label: 'Real-World Relevance',  keywords: ['relevant', 'practical', 'real world', 'applicable', 'real-world', 'apply', 'industry'] },
  { id: 'technical',    label: 'Technical Skills',      keywords: ['excel', 'model', 'financial model', 'lbo', 'dcf', 'valuation', 'technical', 'formula', 'spreadsheet'] },
  { id: 'difficulty',   label: 'Difficulty Level',      keywords: ['difficult', 'hard', 'challenging', 'complex', 'dense', 'easy', 'simple', 'beginner', 'advanced'] },
  { id: 'value',        label: 'Overall Value',         keywords: ['helpful', 'useful', 'valuable', 'worth', 'recommend', 'great', 'excellent', 'amazing', 'good'] },
  { id: 'engagement',   label: 'Engagement',            keywords: ['engaging', 'interactive', 'boring', 'interesting', 'fun', 'enjoyed', 'enjoyable', 'workshop'] },
  { id: 'support',      label: 'Support & Community',   keywords: ['support', 'community', 'forum', 'help', 'feedback', 'response', 'ta', 'assistant'] },
  { id: 'platform',     label: 'Platform & Access',     keywords: ['platform', 'access', 'interface', 'online', 'video', 'recording', 'portal', 'website'] },
];

export function extractThemes(comment: string): string[] {
  const lower = comment.toLowerCase();
  return THEMES.filter(t => t.keywords.some(k => lower.includes(k))).map(t => t.id);
}
