// Employer Reimbursement Reference — Enrollment Advisor Guide
// Program: AI for Business & Finance Certificate
//          (Columbia Business School Executive Education + Wall Street Prep cobrand)
//
// Source: Employer_Reimbursement_Advisor_Reference.docx (v1, last updated May 31, 2026)
// Living document — public-source research; gaps flagged per employer section.

export type Verdict = 'clear' | 'likely' | 'difficult';

export interface GlanceRow {
  label: string;
  value: string;
}

export interface Employer {
  id: string;
  name: string;
  /** verdict severity used for color coding */
  verdict: Verdict;
  /** short verdict word shown on the selector pill, e.g. "Clear", "Likely", "Difficult" */
  verdictWord: string;
  /** headline verdict line shown in the banner */
  verdictHeadline: string;
  /** one-line plain summary of the recommended move */
  verdictSummary: string;
  /** the single recommended path, shown as a callout */
  recommendedPath: string;
  atAGlance: GlanceRow[];
  approvalSteps: string[];
  willCover: string[];
  timeline: string[];
  /** copy-ready manager pitch talking points */
  managerPitch: string[];
  gaps: string[];
}

export const PROGRAM_META = {
  program:
    'AI for Business & Finance Certificate (Columbia Business School Executive Education + Wall Street Prep cobrand)',
  audience:
    "Enrollment advisors handling inbound calls from the employer reimbursement campaign",
  lastUpdated: 'June 11, 2026',
  status:
    'Living document. Public-source research compiled to v1; gaps flagged in each section and will fill in as we hear back from employer ambassadors and HR contacts.',
  cohortClose: 'July 13, 2026',
};

/* ── BrightHorizons / EdAssist LOC Process ──────────────────────── */

export interface LOCWorkflowStep {
  step: number;
  title: string;
  actor: string;
  details: string;
}

export const BRIGHT_HORIZONS_LOC = {
  summary:
    'This is the most common employer-pay pathway, and the one Aubrey + Kristen\'s team documented from real enrollment experience (June 10, 2026). Most campaign employers — Goldman Sachs, Citi, Bank of America, PepsiCo, and likely Boeing — process employer-pay enrollments through Bright Horizons / EdAssist using a Letter of Credit (LOC). The student secures a signed LOC from their employer before enrolling, WSP works with Finance to send an invoice to EdAssist per the LOC instructions, and payment flows from EdAssist to WSP. Coach every Bright Horizons prospect through the exact 6-step sequence below.',

  employers: [
    'Goldman Sachs — Bright Horizons / EdAssist (LOC workflow confirmed)',
    'Citi — citi.edassist.com. Caveat: Citi\'s standard tuition program likely excludes a non-credit cert, so the business-unit training budget is the proven fallback (Citi is the #1 employer for CBS AI, 5 enrollments). Some students still route via EdAssist.',
    'Bank of America — trp.edassist.com (LOC workflow; pre-pay voucher option available)',
    'PepsiCo — Bright Horizons / EdAssist (LOC workflow confirmed)',
    'Boeing — likely Bright Horizons / EdAssist, but verify the prospect\'s benefit platform before assuming the LOC workflow applies.',
    'JPMorgan Chase — EXCEPTION: JPMC is NOT in the EdAssist database. It uses a reimbursement-only path through Guild Education (student pays upfront, submits a reimbursement claim). Longer process. See the JPMC employer section.',
  ],

  studentFields: [
    { field: 'Institution', value: '"Columbia Business School" — or "University of Pennsylvania Wharton School" for Wharton programs. Do NOT enter Wall Street Prep.' },
    { field: 'Course name', value: 'The exact program name WSP sends the student (e.g., AI for Business & Finance Certificate)' },
    { field: 'Course dates', value: 'Cohort start and end dates' },
    { field: 'Course code', value: 'Enter "NA" (most students do)' },
    { field: 'Course credits', value: 'NOT zero — the field rejects "0". Most students enter "NA". (Open question: the exact value students should input is still being confirmed.)' },
  ],

  invoiceRequirements: [
    'Institution name: "Columbia Business School" (or "Wharton School, University of Pennsylvania" for Wharton programs) — NOT Wall Street Prep. If this is wrong, the LOC will be rejected.',
    'Student full name',
    'LOC identification number',
    'Course name',
    'Course dates (start and end)',
    'Employer name',
    'Itemized breakdown of tuition and all fees associated with the course',
  ],

  criticalFlags: [
    'Invoices must come from Columbia or Wharton, NOT WSP. The invoice cannot show "Wall Street Prep" or "WSP" anywhere — it must be issued under Columbia Business School (or Wharton) as the institution. Finance and Chris M need to be aligned on this for every employer-reimbursement invoice. If this is wrong, the LOC will be rejected.',
    'Credit hours must be listed, even though the program is non-credit. The EdAssist form expects credit hours and rejects "0". Most students enter "NA" for course code and credits. We do not yet know the defensible value to give for credit hours — flag this as an open question for Aubrey\'s team.',
    'Gray-area risk: the approval form indicates a college-credit course, but the WSP/Columbia program is non-credit Executive Education. Bright Horizons has not flagged any issues to date, but if their audit tightens we could be caught in non-alignment between the LOC approval and the actual course type. Worth tracking and worth a future conversation with Bright Horizons or Chris M if rejections start.',
    'JPMC exception: JPMorgan Chase is NOT in the EdAssist database and cannot use the LOC path. JPMC students go through Guild Education\'s reimbursement-only process (pay upfront, reimburse after). Longer process — set that expectation early.',
  ],

  coachingLanguage: [
    '"Your employer uses Bright Horizons / EdAssist for tuition reimbursement. I\'ll walk you through the six-step Letter of Credit process so you know exactly what to enter, what we\'ll need from you, and what we handle on our end."',
    '"When you submit the course in your EdAssist portal, enter Columbia Business School as the institution and the course name we\'ll send you. For credit hours, the field doesn\'t accept zero; most students enter NA. We\'ll send you the exact text to copy."',
    '"Once you have your signed Letter of Credit, forward it to us. We work with our Finance team to generate the invoice in the format EdAssist requires."',
    '"The invoice will come from Columbia Business School, not from Wall Street Prep. That\'s important: EdAssist won\'t process invoices that show WSP as the institution."',
  ],

  openQuestions: [
    'What value do students put in the credit hours field if "0" isn\'t accepted? (Need a defensible default before the next cohort to avoid flagging risk.)',
    'Are post-course follow-up steps required from the student (e.g., grade or completion confirmation back to EdAssist)?',
    'Can students submit an LOC request after the course start date, or is pre-approval the only path?',
    "What's the typical LOC turnaround time from each employer (submission to approval)?",
  ],

  workflow: [
    {
      step: 1,
      title: 'Student submits course for approval',
      actor: 'Student',
      details:
        "Student submits the course for approval through their employer's benefit portal (linked to Bright Horizons / EdAssist). They include the institution (Columbia Business School), course name, course dates, course code (NA), and course credits (NA — \"0\" is not an accepted value).",
    },
    {
      step: 2,
      title: 'Letter of Credit issued',
      actor: 'Bright Horizons / EdAssist',
      details:
        'Student receives an approval notification and is issued a Letter of Credit. They review and sign the document.',
    },
    {
      step: 3,
      title: 'Student shares the signed LOC with Enrollment',
      actor: 'Student → WSP Enrollment',
      details: 'Student forwards their signed Letter of Credit to the WSP Enrollment team.',
    },
    {
      step: 4,
      title: 'Invoice generated per LOC instructions',
      actor: 'WSP Enrollment + Finance',
      details:
        'Enrollment works with Finance to generate the invoice per the LOC instructions. The invoice must include: institution name (Columbia Business School — NOT WSP), student name and LOC identification number, course name, course dates, employer name, and an itemized breakdown of tuition and all fees.',
    },
    {
      step: 5,
      title: 'Student enrolled',
      actor: 'WSP Enrollment',
      details: 'Student is enrolled when Finance confirms the invoice has been sent to EdAssist.',
    },
    {
      step: 6,
      title: 'Payment follow-up & student takes course',
      actor: 'WSP Enrollment + Finance',
      details:
        'Enrollment follows up with Finance on payment and communicates with the student if there are any issues. Student takes the course. Note: students likely cannot submit a new LOC request after the course starts — pre-approval must be secured first.',
    },
  ] as LOCWorkflowStep[],
};

export const VERDICT_LEGEND: { verdict: Verdict; label: string; description: string }[] = [
  {
    verdict: 'clear',
    label: 'Green — Clear path',
    description:
      'Tuition program likely covers the cert; coach the prospect to apply.',
  },
  {
    verdict: 'likely',
    label: 'Yellow — Likely covered',
    description:
      "Likely covered but data is older or unclear. Confirm with the employee's HR before assuming.",
  },
  {
    verdict: 'difficult',
    label: 'Red — Difficult path',
    description:
      'Standard tuition program likely does NOT cover the cert. Coach the prospect to use a department training budget or manager-approved L&D pathway instead.',
  },
];

export interface SummaryRow {
  employer: string;
  verdict: Verdict;
  verdictWord: string;
  cap: string;
  platform: string;
  recommendedPath: string;
}

export const CROSS_EMPLOYER_SUMMARY: SummaryRow[] = [
  {
    employer: 'Goldman Sachs',
    verdict: 'likely',
    verdictWord: 'Likely',
    cap: '~$10K/yr [older data]',
    platform: 'BrightHorizons/EdAssist (confirmed)',
    recommendedPath: 'BrightHorizons LOC workflow; confirm cap with HR',
  },
  {
    employer: 'JPMorganChase',
    verdict: 'clear',
    verdictWord: 'Clear',
    cap: '$7,500/yr out-of-catalog',
    platform: 'Guild Education (NOT EdAssist)',
    recommendedPath: 'Out-of-catalog Guild path; pay upfront, reimburse. LOC path N/A — JPMC not in EdAssist DB.',
  },
  {
    employer: 'Citi',
    verdict: 'likely',
    verdictWord: 'Likely',
    cap: 'BU training budget (tuition program excludes)',
    platform: 'EdAssist (tuition); BU training budget (proven)',
    recommendedPath: 'Business-unit training budget — proven path (5 CBS AI enrollments)',
  },
  {
    employer: 'Bank of America',
    verdict: 'clear',
    verdictWord: 'Clear',
    cap: '$7,500/yr + $1K stipend',
    platform: 'BrightHorizons EdAssist (trp.edassist.com)',
    recommendedPath: 'BrightHorizons LOC workflow; request pre-pay voucher',
  },
  {
    employer: 'PepsiCo',
    verdict: 'likely',
    verdictWord: 'Likely',
    cap: 'Not confirmed',
    platform: 'BrightHorizons/EdAssist (confirmed)',
    recommendedPath: 'BrightHorizons LOC workflow; confirm cap and eligibility with HR',
  },
  {
    employer: 'Boeing',
    verdict: 'likely',
    verdictWord: 'Likely',
    cap: 'Not documented',
    platform: 'Possibly BrightHorizons/EdAssist (unconfirmed)',
    recommendedPath: 'Unconfirmed — verify with HR whether BrightHorizons applies',
  },
  {
    employer: 'Microsoft',
    verdict: 'difficult',
    verdictWord: 'Difficult',
    cap: 'Team budget varies (formal program excludes cert)',
    platform: 'EdAssist (formal, excludes); team training budget (alt)',
    recommendedPath: 'Manager-approved team/group training budget — strongest for Finance/Corp Dev/Treasury/Strategy roles',
  },
  {
    employer: 'Visa',
    verdict: 'clear',
    verdictWord: 'Clear',
    cap: '$5,250/yr (IRS §127)',
    platform: 'Internal Visa education benefit',
    recommendedPath: 'Standard $5,250 education benefit; manager pre-approval, work-related (3 CBS AI enrollments)',
  },
  {
    employer: 'Mastercard',
    verdict: 'likely',
    verdictWord: 'Likely',
    cap: 'Up to $5,250/yr (IRS §127)',
    platform: 'Internal Mastercard education benefit',
    recommendedPath: 'Standard $5,250 education benefit; confirm with HR (no historical signal yet)',
  },
];

export const CROSS_EMPLOYER_NOTE =
  "The Bright Horizons / EdAssist Letter of Credit (LOC) workflow is the most common pathway — start there (it's the default tab). It applies to Goldman Sachs, Bank of America, and PepsiCo, and likely Boeing (verify the platform first). Two exceptions and two nuances: JPMorgan Chase is NOT in the EdAssist database, so it uses a reimbursement-only path through Guild Education (pay upfront, reimburse after — longer process). Microsoft's formal tuition program explicitly excludes non-credit certs, so MSFT prospects route through a manager-approved team training budget (strongest for Finance/Corp Dev/Treasury/Strategy roles). Citi is in EdAssist but its tuition program likely excludes a non-credit cert, so the business-unit training budget is the proven fallback — Citi is the #1 employer for CBS AI with 5 employer-pay enrollments. Visa is historically validated (3 CBS AI enrollments via the $5,250 IRS §127 benefit); Mastercard is a clean policy fit but has no historical signal yet.";

export interface TalkingGroup {
  heading: string;
  points: string[];
}

export const UNIVERSAL_TALKING_POINTS: TalkingGroup[] = [
  {
    heading: 'On positioning',
    points: [
      'Lead with Columbia. The AI for Business & Finance Certificate is cobranded with Columbia Business School Executive Education. Columbia is the accredited institutional partner, which satisfies the most common eligibility gate (accredited-institution requirement).',
      'Frame as job-related. The single most important word in any approval conversation is "job-related." Coach prospects to draft a one-sentence explanation of how the program applies to their current role before they approach their manager or HR.',
      'Name the curriculum. Python for Finance, Predictive Analytics & Forecasting, Risk & Portfolio Modeling, Generative AI & LLMs, AI Automation with APIs, AI Copilots & Productivity Tools. The specificity makes the case feel concrete, not generic AI.',
      'Reinforce no coding required. This removes the most common objection that finance professionals self-disqualify on.',
    ],
  },
  {
    heading: 'On the IRS Section 127 tax line',
    points: [
      'Up to $5,250/calendar year of employer educational assistance is tax-free to the employee under IRS Section 127. Above that ceiling, the amount is taxable W-2 wages unless the program is job-related under IRC Section 132 (working condition fringe).',
      'For employers with caps above $5,250 (BofA $7,500; JPMC $7,500 out-of-catalog; GS ~$10K [likely]), the difference is reported on W-2. Visa and Mastercard cap at $5,250, which is fully tax-free — the cert price maps almost exactly to the benefit.',
      'Most prospects do not need this level of tax detail; only bring it up if asked or if the prospect is calculating the net cost.',
    ],
  },
  {
    heading: 'On timing and the July 13 cohort',
    points: [
      'Enrollment for this cohort closes July 13, 2026. End-to-end employer-pay process typically runs 4 to 5 weeks (LP form, advisor call, employer ask, HR approval, reimbursement processing).',
      'After ~June 15, leads that need to clear employer approval are unlikely to make this cohort; coach them on next cohort options to avoid losing the lead.',
      'For prospects who already have employer approval (manager already verbally said yes), the 2-week reimbursement processing is the binding constraint and they can still hit July 13.',
    ],
  },
  {
    heading: 'On the funnel itself',
    points: [
      'Inbound calls from this campaign land via the off-platform LP. Prospects have already submitted an LP form before the advisor call. Treat them as warm but not yet committed.',
      'Brochure and self-serve enrollment paths are visible on the Thank-You page as secondary options. If the prospect is exploring solo, the brochure is the right hand-off, not the advisor call.',
    ],
  },
];

export interface QA {
  q: string;
  a: string[];
}

export const TOP_QUESTIONS: QA[] = [
  {
    q: '1. How do I get my employer to approve this?',
    a: [
      'This depends on the employer. See the per-employer sections for specifics. General framing for any employer:',
      'Start with the manager, not HR. Most reimbursement programs require manager pre-approval before HR or the benefits platform will process the request.',
      'Lead with job-relatedness. Manager needs to be able to defend the spend as supporting current role or future internal growth.',
      'Bring the syllabus and the Columbia cobrand. These two artifacts make the case concrete.',
      'Ask for the specific reimbursement channel by name. "Should I apply through the tuition program (EdAssist / Guild / etc.) or through team training budget?"',
    ],
  },
  {
    q: "2. What's the reimbursement amount or cap?",
    a: [
      'Per-employer caps are in the at-a-glance cards. Quick read:',
      'BofA: $7,500/year plus $1,000 books stipend',
      'JPMC: $7,500/year out-of-catalog for grad-level certs',
      "Citi: $7,500/year graduate tuition program (cert routes through the business-unit training budget instead — proven path, 5 CBS AI enrollments)",
      'Visa: $5,250/year education benefit (IRS §127); 3 historical CBS AI enrollments',
      'Mastercard: up to $5,250/year (IRS §127); no historical signal yet — confirm with HR',
      'Goldman: ~$10,000/year [likely, data older]',
    ],
  },
  {
    q: '3. Will my employer cover this specific WSP program?',
    a: [
      "Honest answer: it depends on the employer's policy interpretation. The advisor's job is to coach the prospect on which path to use and what to say. See per-employer sections for the verdict and recommended pitch.",
    ],
  },
  {
    q: '4. Timeline and paperwork',
    a: [
      'Typical employer-pay timeline (any employer): 2 to 4 weeks for pre-approval, plus the program runtime, plus 2 to 6 weeks for reimbursement after completion.',
      'BofA pre-pay voucher option eliminates the post-completion reimbursement wait.',
      'Documentation always includes: invoice from WSP, course syllabus (for job-relatedness), proof of payment, and completion certificate / grade after the program ends.',
    ],
  },
];

export interface Objection {
  objection: string;
  counters: string[];
}

export const OBJECTIONS: Objection[] = [
  {
    objection: '"My employer doesn\'t pay for non-degree programs."',
    counters: [
      'Counter: This is cobranded with Columbia Business School Executive Education; Columbia is the accredited institutional partner. The accredited-institution requirement is the main gate for non-degree certs.',
      'If the employer still excludes professional certs from the tuition program (the Citi and Microsoft cases), redirect to the team or department training budget. "That\'s a tuition-program rule. The team training budget channel is different and is the right channel for this kind of program." At Citi this path is proven — 5 employees enrolled in the CBS AI cohorts this way.',
    ],
  },
  {
    objection: '"My manager won\'t approve this."',
    counters: [
      'Counter: Ask what specifically the manager would need to see. Often it\'s a one-page summary tying the program to current role outcomes (faster modeling, automated workflows, better AI-augmented analysis).',
      'Offer to send the WSP one-pager for that program; the prospect forwards it to the manager.',
    ],
  },
  {
    objection: '"I don\'t have $5,000 to front before reimbursement."',
    counters: [
      'Counter (BofA): "BofA has a pre-pay voucher option that pays the school directly. You don\'t have to front it."',
      'Counter (others): "The reimbursement timeline is typically 4 to 6 weeks after completion. Most programs reimburse before you\'d see the credit card bill clear if you charge it."',
      'Counter (general): "Some prospects pay the application fee now to lock in the seat and then process reimbursement through their employer in parallel during the 8-week program."',
    ],
  },
  {
    objection: '"What if I leave the company during the program?"',
    counters: [
      'Counter: "Most employer reimbursement programs require you to be actively employed at the time of reimbursement, not throughout the program. Check your employer\'s specific policy."',
      'Counter (JPMC specific): "JPMC has a clawback: keep 50% if you stay 1 year post-reimbursement, 100% at 2 years."',
      'Counter (BofA specific): "BofA requires a one-year post-completion employment commitment after finishing a degree program. For a non-degree certificate, this is less likely to apply but worth confirming with HR."',
    ],
  },
  {
    objection: '"How long does this take to get approved?"',
    counters: [
      'Counter: "Plan on 2 to 4 weeks for pre-approval at most large employers. The fastest path is to have your manager and HR aligned in parallel before the formal application."',
      'Counter (Citi or Microsoft team-budget path): "Team budget approval is faster: usually 1 to 3 weeks because it doesn\'t go through a benefits platform."',
    ],
  },
];

export interface SourceGroup {
  employer: string;
  links: { label: string; url: string }[];
  /** optional provenance note shown above the links */
  note?: string;
}

export const SOURCES: SourceGroup[] = [
  {
    employer: 'Goldman Sachs',
    links: [
      { label: 'Goldman Sachs Careers: Benefits', url: 'https://www.goldmansachs.com/careers/benefits' },
      { label: 'Glassdoor: Goldman Sachs Tuition Assistance', url: 'https://www.glassdoor.com/Benefits/Goldman-Sachs-Tuition-Assistance-BNFT41_E2800_N1.htm' },
      { label: 'Levels.fyi: Goldman Sachs Benefits', url: 'https://www.levels.fyi/companies/goldman-sachs/benefits' },
      { label: 'Fortuna Admissions: Companies That Pay for Your MBA', url: 'https://fortunaadmissions.com/companies-that-pay-for-mba/' },
    ],
  },
  {
    employer: 'JPMorganChase',
    links: [
      { label: 'Guild Education: JPMC portal', url: 'https://www.guildeducation.com/jpmc' },
      { label: 'JPMC Guild login', url: 'https://jpmc.guildeducation.com/' },
      { label: 'Learn.org: JPMorgan Chase Tuition Reimbursement', url: 'https://learn.org/financial-aid/jpmorgan-chase-tuition-reimbursement' },
      { label: 'College Transitions: JPMorgan Chase Tuition Assistance', url: 'https://www.collegetransitions.com/blog/jpmorgan-chase-tuition-assistance-online-degrees-for-chase-employees/' },
      { label: 'Benefit News: JPMorgan tuition-free education benefits', url: 'https://www.benefitnews.com/news/at-jpmorgan-tuition-free-education-benefits-helped-this-working-mom-advance-her-career' },
    ],
  },
  {
    employer: 'Citi',
    links: [
      { label: 'Citi Tuition Program Guidelines PDF (updated Jan 2024)', url: 'https://www.citibenefits.com/-/media/Mercer/CitiBenefits/Documents/tuition-program-guidelines.pdf' },
      { label: 'Citi Tuition Program FAQ (US/PR)', url: 'https://www.citibenefits.com/-/media/Mercer/CitiBenefits/Documents/Citi-Tuition-Program-FAQ.pdf' },
      { label: 'Citi Benefits: Professional Development', url: 'https://www.citibenefits.com/Work-or-Life/Professional-Development' },
      { label: 'Citi EdAssist portal', url: 'https://citi.edassist.com/' },
      { label: 'Bright Horizons: Citi Enhances Education Program (Sept 2022)', url: 'https://investors.brighthorizons.com/news-releases/news-release-details/citi-enhances-education-program-support-employee-career-and' },
    ],
  },
  {
    employer: 'Bank of America',
    links: [
      { label: 'Learn.org: Bank of America Tuition Reimbursement', url: 'https://learn.org/financial-aid/bank-of-america-tuition-reimbursement' },
      { label: 'BofA Careers: Benefits', url: 'https://careers.bankofamerica.com/en-us/benefits' },
      { label: 'BofA Careers: The Academy', url: 'https://careers.bankofamerica.com/en-us/career-development/the-academy' },
      { label: 'Bright Horizons EdAssist (BofA portal)', url: 'https://trp.edassist.com/' },
      { label: 'Benefit News: BofA tuition support story', url: 'https://www.benefitnews.com/news/bank-of-america-employee-earned-two-degrees-in-two-years-with-zero-debt' },
      { label: 'Pathstream: Universal Banker Model', url: 'https://pathstream.com/resources/universal-banker-model-deliver/' },
    ],
  },
  {
    employer: 'Microsoft',
    links: [
      { label: 'Microsoft US Benefits: Tuition Assistance', url: 'https://usbenefits.microsoft.com/us/en/tuition-assistance.html' },
      { label: 'Microsoft US Benefits: Get help with college', url: 'https://usbenefits.microsoft.com/us/en/get-help-with-college.html' },
      { label: 'Microsoft Careers: Benefits', url: 'https://careers.microsoft.com/v2/global/en/benefits' },
      { label: 'Learn.org: Microsoft Tuition Reimbursement', url: 'https://learn.org/financial-aid/microsoft-tuition-reimbursement' },
      { label: 'EdAssist by Bright Horizons (Microsoft portal)', url: 'https://microsoft.edassist.com/start/welcome' },
    ],
  },
  {
    employer: 'Visa',
    note: 'Coverage validated by internal data: WSP Employer Reimbursement Analysis (Apr 2026) shows 3 Visa employer-pay CBS AI enrollments across the Summer + Fall 2025 cohorts. Reimbursement structure follows the standard IRS §127 ($5,250, job-related, manager-approved) model. Confirm the internal submission process with the employee\'s HR.',
    links: [
      { label: 'IRS: Educational Assistance Programs FAQ (Section 127)', url: 'https://www.irs.gov/newsroom/frequently-asked-questions-about-educational-assistance-programs' },
      { label: 'Columbia Provost: Executive (Non-Credit) Education definition', url: 'https://provost.columbia.edu/content/executive-non-credit-education' },
    ],
  },
  {
    employer: 'Mastercard',
    note: 'No historical WSP enrollment signal — coverage is policy-inferred, not yet confirmed in practice. Mastercard is the structural twin to Visa (payments-tech profile, similar finance-role density, similar $5,250 IRS §127 reimbursement). Confirm coverage with the employee\'s HR before promising it.',
    links: [
      { label: 'IRS: Educational Assistance Programs FAQ (Section 127)', url: 'https://www.irs.gov/newsroom/frequently-asked-questions-about-educational-assistance-programs' },
      { label: 'Columbia Provost: Executive (Non-Credit) Education definition', url: 'https://provost.columbia.edu/content/executive-non-credit-education' },
    ],
  },
  {
    employer: 'Cross-employer',
    links: [
      { label: 'IRS: Educational Assistance Programs FAQ (Section 127)', url: 'https://www.irs.gov/newsroom/frequently-asked-questions-about-educational-assistance-programs' },
      { label: 'Columbia Provost: Executive (Non-Credit) Education definition', url: 'https://provost.columbia.edu/content/executive-non-credit-education' },
      { label: 'Bright Horizons EdAssist: Educational Assistance Program', url: 'https://www.brighthorizons.com/employers/edassist/educational-assistance-program' },
    ],
  },
];

export const EMPLOYERS: Employer[] = [
  {
    id: 'goldman-sachs',
    name: 'Goldman Sachs',
    verdict: 'likely',
    verdictWord: 'Likely',
    verdictHeadline: 'Likely qualifies',
    verdictSummary:
      'Public data is older/anecdotal; verify with the employee\'s HR before banking on it.',
    recommendedPath:
      'Standard HR/benefits portal submission plus manager sign-off, with pre-approval before enrollment. Confirm the current cap and process with HR.',
    atAGlance: [
      { label: 'Annual cap', value: '~$10,000/year [likely; cited by multiple aggregators, GS does not publish]' },
      { label: 'Tenure requirement', value: '1 year of service before applying [likely; anecdotal]' },
      { label: 'Platform / admin', value: 'BrightHorizons / EdAssist — confirmed by enrollment team (see BrightHorizons LOC workflow in Quick Reference)' },
      { label: 'Pre-approval', value: 'Required before enrollment [likely; standard banking-sector practice]' },
      { label: 'Tax treatment', value: 'Tax-free up to IRS $5,250/year; amounts above are taxable W-2 wages' },
    ],
    approvalSteps: [
      'Goldman uses BrightHorizons / EdAssist for employer-pay enrollments. Follow the BrightHorizons LOC workflow (Quick Reference → BrightHorizons / EdAssist LOC process): student submits for course approval through the EdAssist benefit portal, receives a Letter of Credit, shares the signed LOC with Enrollment, and WSP Finance sends an invoice to EdAssist.',
      'Pre-approval (manager sign-off) is required before enrollment.',
      'Goldman also runs a selective MBA sponsorship track for high-performing associates/VPs (typically 2 to 6 years tenure) with manager nomination and committee approval. That track is separate from the standard EdAssist reimbursement path.',
    ],
    willCover: [
      'No public GS documentation addresses non-degree external certificates directly. The Columbia Business School Executive Education cobranding is the strongest qualification lever to lead with: many Section 127 plans accept executive-education programs from accredited universities even when non-degree.',
      'Lead the manager pitch with: cobranded with Columbia Business School Executive Education, 8-week program, job-related for finance/IB/markets/AM/strategy roles.',
      'Goldman has internal L&D plus a Coursera partnership; expect questions about why external is needed. Coach the prospect to frame as: focused finance + AI integration, taught by practitioners, not generic AI content.',
    ],
    timeline: [
      'Pre-approval typically 2 to 6 weeks at large banks [industry-standard, not GS-specific]',
      'Reimbursement after completion via payroll, typically 4 to 8 weeks after final paperwork [industry-standard]',
      'Documentation: paid receipts/invoices, transcript or completion certificate with grade',
    ],
    managerPitch: [
      'This is the AI for Business & Finance Certificate cobranded with Columbia Business School Executive Education. Columbia is the accredited partner.',
      "It's a structured 8-week program built specifically for finance professionals; covers Python for finance, predictive analytics, GenAI/LLMs, AI automation with APIs, and AI copilots for productivity.",
      'It maps directly to my work in [role/team] because [specific application: faster model building / automated research workflows / AI-assisted analysis / etc.]',
      'No coding experience required; the program is designed for finance professionals.',
    ],
    gaps: [
      'Exact current annual cap (the $10K figure is unverified against 2024-2026 GS documents)',
      'Specific portal name and submission system',
      'Whether part-time employees qualify',
      'Grade requirement specifics for non-degree programs',
      'Treatment of completion certificates (vs. graded courses)',
    ],
  },
  {
    id: 'jpmorganchase',
    name: 'JPMorganChase',
    verdict: 'clear',
    verdictWord: 'Clear',
    verdictHeadline: 'Clear path',
    verdictSummary:
      'Out-of-catalog $7,500/year reimbursement track through Guild Education; pre-approval required.',
    recommendedPath:
      'Out-of-catalog Guild path: pre-approve through Guild, pay tuition upfront, then submit receipts + proof of completion for reimbursement (up to $7,500/year).',
    atAGlance: [
      { label: 'Annual cap', value: '$7,500/year for grad-level/certificate/professional certifications outside the Guild catalog; $5,250/year for outside-catalog undergrad; 100% (no cap) for in-catalog programs' },
      { label: 'Tenure requirement', value: 'Benefits-eligible; standard Guild deployments typically require ~90 days [likely; JPMC does not publish explicit waiting period]' },
      { label: 'Platform / admin', value: 'Guild Education at jpmc.guildeducation.com — NOT BrightHorizons/EdAssist' },
      { label: 'Pre-approval', value: 'Required for out-of-catalog programs; employee pays upfront, submits receipts plus proof of completion for reimbursement' },
      { label: 'Tax treatment', value: 'Tax-free up to $5,250; amounts above (in the $7,500 cert track) are taxable W-2 wages' },
      { label: 'BrightHorizons LOC', value: 'NOT available — JPMC is not registered in the EdAssist/BrightHorizons database. Students attempting the LOC path must use Guild\'s standard reimbursement (pay upfront, reimburse after). Longer process — set this expectation early.' },
    ],
    approvalSteps: [
      'Employee logs into jpmc.guildeducation.com via SSO.',
      'Works with a Guild coach to confirm the program fits the out-of-catalog reimbursement criteria (job-related, qualifying credential type).',
      'Submits pre-approval application before enrolling; pays tuition out of pocket.',
      'After completion, submits receipts plus proof of completion through Guild for reimbursement.',
    ],
    willCover: [
      'Most plausible path: out-of-catalog $7,500/year reimbursement track for professional certificates. JPMC already covers Dalton CFP and Mark Meldrum CFA at 100% in-catalog, which proves finance-aligned non-degree providers are clearly in-scope philosophically; WSP is not a confirmed Guild partner in public sources, so the prospect goes through the out-of-catalog path.',
      'Pitch as: Columbia Business School Executive Education cobranded certificate, job-related to finance role, falls under the out-of-catalog $7,500 track.',
      'Coach prospects to expect administrative friction. Glassdoor reviewers report the out-of-catalog reimbursement process can require multiple follow-ups per semester. In-catalog Guild programs are direct-billed and frictionless; out-of-catalog is not.',
    ],
    timeline: [
      'Pre-approval through Guild: typically 1 to 3 weeks [Guild standard SLA, not JPMC-specific]',
      'Reimbursement after completion: process is reportedly slow; coach to plan ~6 to 12 weeks post-submission',
      'Documentation: paid receipts, proof of payment, completion certificate, passing grade per class (B or higher cited anecdotally)',
      'Clawback: per Glassdoor reports, 50% kept at 1 year post-reimbursement, 100% at 2 years',
    ],
    managerPitch: [
      'JPMorganChase already covers Mark Meldrum CFA and Dalton CFP at 100% through Guild. This is the same category of credential, just routed through the out-of-catalog $7,500/year reimbursement track because WSP isn\'t yet a Guild-catalog partner.',
      'The program is cobranded with Columbia Business School Executive Education and is directly job-related to my [role] work.',
      "I'd pay upfront and submit for reimbursement after completion.",
    ],
    gaps: [
      'WSP is not currently a Guild catalog partner (verify before sending prospect to assume in-catalog path).',
      'Explicit job-relatedness criteria for the $7,500 out-of-catalog cert track not publicly documented.',
      'BrightHorizons/EdAssist LOC path is NOT available for JPMC students — JPMC is not registered in the EdAssist database. If a student asks about the LOC path, redirect to Guild Education standard reimbursement.',
    ],
  },
  {
    id: 'citi',
    name: 'Citi',
    verdict: 'likely',
    verdictWord: 'Likely',
    verdictHeadline: 'Workable via the business-unit training budget — proven in practice',
    verdictSummary:
      "Citi's standard tuition program (EdAssist) likely excludes a non-credit cert — but the business-unit training budget channel works. Citi is the #1 employer for CBS AI with 5 employer-pay enrollments. Route to the team budget, not the tuition program.",
    recommendedPath:
      'Business-unit / department training budget — a proven path at Citi. Coach the prospect to position the cert as manager-approved L&D / training, not tuition reimbursement — the same channel Citi uses for CFA/CPA candidates and the one 5 CBS AI enrollees almost certainly used.',
    atAGlance: [
      { label: 'Historical CBS AI enrollments', value: '5 employer-pay enrollments (Summer + Fall 2025) — Citi is the #1 employer for CBS AI. Almost certainly via business-unit training budget, not the tuition program.' },
      { label: 'Annual cap', value: '$5,250 undergrad / $7,500 grad through the standard Citi Tuition Program — but the cert likely does not qualify there. The team training budget is the working channel (no fixed published cap; manager discretion).' },
      { label: 'Tenure requirement', value: '90 days at Citi (tuition program)' },
      { label: 'Platform / admin', value: 'Bright Horizons EdAssist at citi.edassist.com (tuition program — likely excludes non-credit cert); business-unit training budget via manager + HR business partner (recommended path)' },
      { label: 'BrightHorizons LOC', value: 'Citi is in the EdAssist database, so the LOC path is technically available. However, the standard tuition program likely excludes non-credit certs — route to BU training budget instead (proven path). Some Citi students may still use the LOC path if their manager routes them through EdAssist.' },
      { label: 'Pre-approval', value: 'Manager approval; for the team-budget path, line manager + business-unit L&D lead' },
      { label: 'Tuition-program coverage gap', value: 'Citi explicitly excludes CFA, CFP, CPA, PHR, Six Sigma, and similar standalone professional certs from the tuition program. The team training budget is the documented workaround — and the data shows it works.' },
    ],
    approvalSteps: [
      'Route to the business-unit training budget, not EdAssist. Position the cert as manager-approved L&D / training, not tuition reimbursement.',
      'Target: line manager + L&D lead for their business unit (ICG / Markets / Banking / Consumer).',
      'Frame: "This is a focused training investment, not a degree program. I\'d like to fund it from my team\'s training budget, similar to how CFA prep gets funded."',
      'Confirm: ask the prospect to check with their manager and HR business partner; the same path that Citi uses for CFA/CPA candidates — and that 5 CBS AI enrollees used — is the right channel here.',
    ],
    willCover: [
      'Yes, via the business-unit training budget — and this is proven, not theoretical. Citi is the #1 employer for CBS AI in the WSP enrollment data, with 5 employer-pay enrollments across the Summer + Fall 2025 cohorts, almost certainly routed through the business-unit training budget channel.',
      'Through the standard Tuition Program / EdAssist: still unlikely. Citi\'s published Tuition Program Guidelines (updated Jan 2024) limit eligibility to courses at accredited U.S. colleges and explicitly exclude standalone professional certifications. Do not send prospects down the EdAssist path for this cert.',
      'If the prospect insists on the EdAssist path anyway: have them call EdAssist coaching first to get a yes/no read before enrolling. Free 1:1 coaching is included.',
    ],
    timeline: [
      'Business-unit training budget approval timeline is variable: 1 to 4 weeks depending on manager and budget cycle — typically faster than the tuition platform because it skips EdAssist.',
      'Documentation usually simpler than EdAssist: invoice from WSP, manager email approval, finance/PO process per business unit.',
    ],
    managerPitch: [
      'Five Citi colleagues have already enrolled in this Columbia AI program with company support — it\'s the #1 employer in the program. I\'d like to fund it the same way, through our team training budget.',
      'The Citi tuition program excludes standalone certs, so the team training budget is the right channel — the same way we fund CFA prep or other professional development.',
      "It's a focused 8-week AI + finance certificate, cobranded with Columbia Business School Executive Education, and it applies directly to my work in [role/team] because [specific application].",
    ],
    gaps: [
      'The 5 historical enrollments are strong evidence the path works, but the exact internal mechanism (which budget line, approval chain) is inferred — confirm the BU training budget pitch path with someone in CIB / ICG before relying on it in scripts.',
      'No public list of approved non-credit Exec Ed programs through Citi EdAssist.',
      'Department training budget specifics and any cap vary by business unit; no public guidance.',
    ],
  },
  {
    id: 'bank-of-america',
    name: 'Bank of America',
    verdict: 'clear',
    verdictWord: 'Clear',
    verdictHeadline: 'Strongest tuition-program path of the active employers',
    verdictSummary:
      'Covers professional certifications; pre-pay voucher option eliminates upfront cost.',
    recommendedPath:
      'Tuition program through EdAssist (trp.edassist.com). Submit for pre-approval and request the pre-pay voucher so BofA pays the school directly — no out-of-pocket front.',
    atAGlance: [
      { label: 'Annual cap', value: '$7,500/year plus $1,000 books/supplies stipend; resets annually, no lifetime maximum' },
      { label: 'Tenure requirement', value: '6 months at BofA' },
      { label: 'Eligibility', value: 'Full-time AND part-time US employees (includes branch staff, not just corporate)' },
      { label: 'Platform / admin', value: 'BrightHorizons EdAssist at trp.edassist.com; support 855-825-0120. Uses BrightHorizons LOC workflow — see Quick Reference → BrightHorizons / EdAssist LOC process.' },
      { label: 'Pre-approval', value: 'Required before enrolling; coursework approved in advance via EdAssist portal, then manager and 2nd-level manager' },
      { label: 'Payment option', value: 'Pre-pay voucher available; voucher pays the school directly so employee does not front the cost' },
    ],
    approvalSteps: [
      'Employee logs into trp.edassist.com.',
      'Submits coursework for pre-approval (course details, syllabus, cost, dates).',
      'EdAssist reviews for policy compliance, routes to direct manager, then to 2nd-level manager for approval.',
      'If approved with pre-pay voucher: voucher pays school directly.',
      'If approved with reimbursement: employee pays upfront, submits proof of completion plus grade for reimbursement.',
    ],
    willCover: [
      'Likely yes, with medium-high confidence. The Columbia Exec Ed cobrand satisfies the accredited-institution requirement; the program is clearly job-related for any finance, banking, analyst, strategy, or corporate function role; and BofA has existing external-vendor precedent.',
      'BofA explicitly lists professional certifications as covered, alongside undergraduate and graduate programs. The Pathstream partnership for branch-banker certificates flows through this same $7,500 benefit — proof that external non-degree certs DO get approved.',
      'Caveat: BofA published policy emphasizes "official grade or confirmation that credit was received." A pure completion certificate without a grade may face friction depending on individual EdAssist policy interpretation. Coach prospects to highlight Columbia accreditation and request the pre-pay voucher in the pre-approval application.',
    ],
    timeline: [
      'Pre-approval through EdAssist plus manager and 2nd-level manager: typically 2 to 4 weeks [industry standard]',
      'Pre-pay voucher option means no waiting for reimbursement after the fact',
      'Documentation: receipts, proof of payment, grade or completion confirmation, course syllabus (for job-relatedness review)',
      'Maintain GPA 2.5 or higher for graded coursework; one-year post-completion employment commitment after finishing a degree',
    ],
    managerPitch: [
      "BofA's tuition assistance program explicitly covers professional certifications. This is one. It's cobranded with Columbia Business School Executive Education, the accredited partner.",
      'The Pathstream certificates BofA covers for branch teams flow through this same benefit, so external-vendor certs are already a proven category here.',
      "I'd like to request the pre-pay voucher option so BofA pays the school directly.",
    ],
    gaps: [
      'No public BofA-specific SLA for approval turnaround.',
      'Whether senior leaders or executives have different caps.',
      'Treatment of completion-only certificates (no graded coursework) is the main qualification risk; recommend EdAssist pre-approval before enrollment.',
    ],
  },
  {
    id: 'visa',
    name: 'Visa',
    verdict: 'clear',
    verdictWord: 'Clear',
    verdictHeadline: 'Clear path — validated by historical enrollments',
    verdictSummary:
      'Three Visa employees already enrolled in the CBS AI cohorts with employer pay. The $5,250 IRS §127 education benefit maps almost exactly to the cert price; manager-approved and work-related.',
    recommendedPath:
      "Standard $5,250/year education benefit (IRS §127). Coach the prospect to get manager pre-approval, frame the cert as work-related to their current role, and submit through Visa's internal education-assistance / tuition benefit process.",
    atAGlance: [
      { label: 'Historical CBS AI enrollments', value: '3 employer-sponsored seats (Summer + Fall 2025 cohorts) — the path is validated in practice.' },
      { label: 'Annual cap', value: '$5,250/year (IRS §127 tax-free max); manager-approved, work-related. Maps almost exactly to the cert price.' },
      { label: 'Platform / admin', value: 'Internal Visa benefits / education-assistance process (manager approval + HR/benefits submission)' },
      { label: 'Pre-approval', value: 'Required; manager approval with work-related framing' },
      { label: 'Tax treatment', value: 'Fully tax-free — the $5,250 benefit sits at the IRS §127 ceiling' },
      { label: 'Internal AI context', value: 'Visa Decision Manager (98.8% of transactions auto-resolved by AI); GitHub Copilot + secure GPT-4 deployed internally. Visa has publicly flagged a financial-services AI talent gap.' },
    ],
    approvalSteps: [
      'Get manager pre-approval. Frame the cert as work-related to the current role (payments analytics, risk, treasury, corporate finance, strategy).',
      "Submit through Visa's internal education-assistance / tuition benefit for the $5,250/year benefit.",
      'Enroll per Visa\'s process; payment/reimbursement follows the benefit\'s structure (confirm direct-pay vs. reimburse with HR).',
    ],
    willCover: [
      'Green. The WSP enrollment data confirms 3 Visa employees already enrolled in the CBS AI cohorts (Summer + Fall 2025) with employer pay — the path is validated, not theoretical.',
      'The $5,250 IRS §127 education benefit maps almost exactly to the cert price, so a manager-approved, work-related request fits cleanly within policy with little or no co-pay.',
      'Visa has publicly stated a financial-services AI talent gap, which gives the manager pitch built-in justification.',
    ],
    timeline: [
      'Manager pre-approval + benefits processing: plan 2 to 4 weeks [industry standard; Visa-specific SLA not documented].',
      'Documentation: invoice from WSP, course syllabus (work-relatedness), manager approval, proof of payment.',
    ],
    managerPitch: [
      'Visa leads payments AI but has publicly flagged a finance-AI talent gap. Three Visa colleagues already enrolled in this program in 2025.',
      'The Columbia + Wall Street Prep certificate closes that gap with finance-specific AI training, delivered in 8 weeks. No coding required.',
      'It maps directly to my role in [payments analytics / risk / strategy / treasury] and fits inside the $5,250 education benefit.',
    ],
    gaps: [
      "Exact internal submission system / benefit name not documented publicly; confirm with the employee's HR.",
      'Whether the $5,250 is direct-pay or reimbursement-after-completion at Visa.',
      'Any tenure / eligibility waiting period.',
    ],
  },
  {
    id: 'mastercard',
    name: 'Mastercard',
    verdict: 'likely',
    verdictWord: 'Likely',
    verdictHeadline: 'Likely covered — clean policy fit, no historical signal yet',
    verdictSummary:
      "Theoretical near-twin to Visa: an up-to-$5,250 work-related benefit with manager pre-approval. No historical WSP enrollments yet, so confirm coverage with the employee's HR before promising it.",
    recommendedPath:
      'Standard up-to-$5,250/year education benefit (IRS §127), job-related, manager pre-approval — the same structure as Visa. Confirm the benefit with HR before assuming coverage, since there is no historical example yet.',
    atAGlance: [
      { label: 'Historical CBS AI enrollments', value: '0 — no Mastercard appearances in the WSP historical data. Coverage is policy-inferred, not yet confirmed in practice.' },
      { label: 'Annual cap', value: 'Up to $5,250/year (IRS §127); job-related, manager pre-approval' },
      { label: 'Platform / admin', value: 'Internal Mastercard benefits / education-assistance process (manager approval)' },
      { label: 'Pre-approval', value: 'Required; job-related framing with manager approval' },
      { label: 'Tax treatment', value: 'Tax-free up to the IRS $5,250/year ceiling' },
      { label: 'Internal AI context', value: 'Decision Intelligence + gen-AI fraud platform (2024); strong internal AI build. Structural twin to Visa on payments-tech profile and finance-role density.' },
    ],
    approvalSteps: [
      'Get manager pre-approval. Frame as job-related to the current role (payments analytics, risk, treasury, finance, strategy).',
      "Submit through Mastercard's internal education-assistance / tuition benefit for the up-to-$5,250 benefit.",
      'Confirm the benefit structure (direct-pay vs. reimbursement) with HR — there is no historical example to confirm the path yet.',
    ],
    willCover: [
      'Green on policy, untested on behavior. Mastercard\'s reimbursement structure (up to $5,250, job-related, manager pre-approval) looks like a clean fit, but there are no historical WSP enrollments to confirm the path in practice.',
      'Mastercard is the natural twin to Visa — same payments-tech profile, similar finance-role density, similar reimbursement structure. If Visa\'s path works, Mastercard\'s almost certainly generalizes.',
      'Coach prospects to confirm coverage with HR before assuming, and lead with the $5,250 work-related framing.',
    ],
    timeline: [
      'Manager pre-approval + benefits processing: plan 2 to 4 weeks [industry standard].',
      'Documentation: invoice from WSP, course syllabus (work-relatedness), manager approval, proof of payment.',
      'Note: recent layoffs may tighten manager discretionary spend.',
    ],
    managerPitch: [
      'Mastercard is shipping gen-AI fraud products. Finance teams who understand AI fluently will lead the next wave.',
      'The Columbia + Wall Street Prep certificate fits inside the $5,250 benefit and delivers finance-specific AI training in 8 weeks. No coding required.',
      'It applies directly to my work in [payments analytics / risk / strategy / treasury / finance].',
    ],
    gaps: [
      'No historical WSP enrollment signal; coverage is policy-inferred, not confirmed in practice — confirm with HR before promising it.',
      'Internal submission system / benefit name not documented; confirm with HR.',
      'Recent layoffs may tighten discretionary / manager-approved spend.',
    ],
  },
  {
    id: 'pepsico',
    name: 'PepsiCo',
    verdict: 'likely',
    verdictWord: 'Likely',
    verdictHeadline: 'Likely covered — uses BrightHorizons/EdAssist LOC process',
    verdictSummary:
      'PepsiCo processes employer-pay enrollments through Bright Horizons/EdAssist via Letter of Credit. Coverage terms and cap not yet fully documented — confirm with HR.',
    recommendedPath:
      'BrightHorizons/EdAssist Letter of Credit (LOC) path. Student submits through the employer benefit portal, secures a signed LOC, shares it with Enrollment, and WSP Finance sends the invoice to EdAssist. See Quick Reference → BrightHorizons / EdAssist LOC process for the full workflow.',
    atAGlance: [
      { label: 'Process', value: 'BrightHorizons/EdAssist Letter of Credit (LOC) — confirmed as LOC-using employer' },
      { label: 'Annual cap', value: 'Not confirmed — check with HR' },
      { label: 'Platform / admin', value: 'BrightHorizons/EdAssist employer benefit portal' },
      { label: 'Pre-approval', value: 'Required via BrightHorizons/EdAssist portal before enrollment' },
      { label: 'Invoice requirements', value: 'Must show Columbia Business School (not WSP), student name, LOC ID, course dates, itemized fees' },
      { label: 'Historical CBS AI enrollments', value: 'Confirmed as LOC-using employer; enrollment count not yet tracked' },
    ],
    approvalSteps: [
      'Student submits for course approval through the BrightHorizons/EdAssist employer benefit portal.',
      'Student enters: institution (Columbia Business School), course name, course dates, course code (NA), course credits (NA — not zero).',
      'Student receives a Letter of Credit, reviews and signs it.',
      'Student shares the signed LOC with WSP Enrollment.',
      'Enrollment works with Finance to send an invoice to EdAssist per the LOC instructions. Invoice must show Columbia Business School (not WSP), student name, LOC ID, course name, course dates, and itemized fee breakdown.',
      'Enrollment enrolls the student once the invoice is confirmed sent to EdAssist.',
      'Finance follows up on payment from EdAssist.',
    ],
    willCover: [
      'Likely yes — PepsiCo is confirmed as one of the employers that uses the BrightHorizons/EdAssist LOC process for employer-pay enrollments in this program.',
      'Specific coverage eligibility, cap amount, and any tenure requirements are not yet documented. Coach prospects to confirm through their HR or benefits portal before assuming coverage.',
    ],
    timeline: [
      'LOC issuance: typically 1 to 3 weeks after student submits through the benefit portal.',
      'Enrollment happens after the invoice is confirmed sent to EdAssist.',
      'Payment from EdAssist to WSP follows the LOC payment terms.',
    ],
    managerPitch: [
      "I'd like to enroll in the AI for Business & Finance Certificate cobranded with Columbia Business School Executive Education and process the payment through PepsiCo's Bright Horizons employee education benefit.",
      "It's directly job-related to my role in [function/team] because [specific application].",
      'No coding required — the program is designed for finance and business professionals.',
    ],
    gaps: [
      'Annual reimbursement cap not confirmed.',
      'Eligibility requirements (tenure, employment status) not documented.',
      'No historical CBS AI enrollment count on record.',
      'Whether all PepsiCo employees have access to this benefit (vs. select job families) not confirmed.',
    ],
  },
  {
    id: 'boeing',
    name: 'Boeing',
    verdict: 'likely',
    verdictWord: 'Likely',
    verdictHeadline: 'Possible LOC path — unconfirmed',
    verdictSummary:
      'Boeing may use the BrightHorizons/EdAssist LOC process, but this is unconfirmed. Treat as a possible path and coach the prospect to verify with their HR before proceeding.',
    recommendedPath:
      "Confirm with the student's HR whether Boeing's education benefit uses BrightHorizons/EdAssist. If yes, follow the standard BrightHorizons LOC workflow. If no, identify the correct reimbursement channel.",
    atAGlance: [
      { label: 'Process', value: 'Possibly BrightHorizons/EdAssist LOC — unconfirmed' },
      { label: 'Annual cap', value: 'Not documented' },
      { label: 'Platform / admin', value: 'Likely BrightHorizons/EdAssist if LOC path applies — confirm with HR' },
      { label: 'Pre-approval', value: 'Required; specific process not yet confirmed' },
      { label: 'Historical CBS AI enrollments', value: 'None documented — Boeing is unconfirmed as an active employer in this program' },
    ],
    approvalSteps: [
      "Confirm with the student's HR whether Boeing's education benefit uses BrightHorizons/EdAssist.",
      'If yes: follow the standard BrightHorizons LOC workflow (see Quick Reference → BrightHorizons / EdAssist LOC process).',
      'If no: confirm the correct reimbursement channel with HR before advising the student.',
    ],
    willCover: [
      "Unconfirmed. Boeing may use the BrightHorizons/EdAssist LOC process, but this has not been verified with actual enrollments. Treat as a possible path, not a guaranteed one.",
      "Coach the prospect to check with their HR or benefits portal and confirm whether the program qualifies under Boeing's education assistance benefit before assuming coverage.",
    ],
    timeline: [
      'Process and timeline not yet confirmed.',
      'If BrightHorizons LOC applies: typically 1 to 4 weeks for LOC issuance + enrollment.',
    ],
    managerPitch: [
      "I'd like to enroll in the AI for Business & Finance Certificate cobranded with Columbia Business School Executive Education and process it through Boeing's employee education benefit.",
      'It applies directly to my work in [role/team] because [specific application]. No coding required.',
    ],
    gaps: [
      'Unconfirmed whether Boeing uses BrightHorizons/EdAssist for education benefits — do not assume.',
      'Annual cap not documented.',
      'Eligibility criteria not documented.',
      'No historical CBS AI enrollments on record.',
      'Confirm the specific benefit structure and submission process with the prospect\'s HR before advising.',
    ],
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    verdict: 'difficult',
    verdictWord: 'Difficult',
    verdictHeadline: 'Formal tuition program excludes the cert — route to team training budget',
    verdictSummary:
      "Microsoft's formal Tuition Assistance Program explicitly excludes non-credit certificates. The only realistic path is a manager-approved team/group training budget — strongest for Finance, Corp Dev, Treasury, FP&A, IR, and Strategy roles.",
    recommendedPath:
      "Manager-approved team / group training budget. Microsoft's own benefits page states certificates/CEUs may be reimbursable through your group's training budget if your manager approves. Coach the prospect to position the cert as job-related L&D and get manager sign-off before assuming approval.",
    atAGlance: [
      { label: 'Formal tuition program', value: '$10K/year, but explicitly EXCLUDES non-credit certificates — the AI Cert does not qualify here.' },
      { label: 'Recommended path', value: 'Manager-approved team / group training budget (decentralized; varies by org and manager; no published per-employee allotment).' },
      { label: 'Best-fit roles', value: 'Finance, Corp Dev, Treasury, FP&A, Investor Relations, Strategy. Weaker fit for Engineering / Product unless framed as FinTech / Cloud Finance / AI Productivity.' },
      { label: 'Platform / admin', value: 'EdAssist at microsoft.edassist.com (formal program); team training budget via manager + org finance (recommended)' },
      { label: 'Pre-approval', value: 'Manager approval required for the team-budget path; test the waters before assuming approval' },
      { label: 'Tax treatment', value: 'Tax-free up to IRS $5,250/year; amounts above are taxable W-2 wages' },
    ],
    approvalSteps: [
      'Do NOT route to the formal Tuition Assistance Program / EdAssist — non-credit certs are explicitly excluded.',
      "Position the cert as manager-approved L&D funded from the team / group training budget. Microsoft's benefits page explicitly allows certificate reimbursement through a group's training budget with manager approval.",
      'Target: the prospect\'s line manager (and org finance / training-budget owner).',
      'Frame: "This is a finance-focused AI certificate, not a degree program. I\'d like to fund it from our team training budget — Microsoft\'s benefits page says this category is eligible with manager approval."',
      'Coach the prospect to test the waters with their manager before assuming approval; friction varies significantly by org.',
    ],
    willCover: [
      'Through the formal Tuition Assistance Program (EdAssist): no. Non-credit certificates are explicitly excluded by name in Microsoft policy.',
      'Through a manager-approved group training budget: yes, with the right pitch — most likely for Finance / Corp Dev / Treasury / Strategy roles where the finance angle maps directly to job function.',
      'For Engineering / Product / non-finance roles: the manager-pitch case is weaker because the finance focus doesn\'t map as cleanly. Still possible if the prospect frames AI-finance integration as relevant to their org (FinTech, Cloud Finance, AI Productivity).',
    ],
    timeline: [
      'Team training budget approval timeline is variable: 1 to 4 weeks depending on manager and quarterly budget cycle.',
      'Documentation: invoice from WSP, manager email approval, internal finance/PO process per org.',
    ],
    managerPitch: [
      "This is a finance-focused AI certificate, cobranded with Columbia Business School Executive Education. It's not eligible for the formal tuition program because it's non-credit Executive Education, but Microsoft's benefits page specifically says team training budgets can cover this category if the manager approves.",
      'The program is built for finance professionals; it covers Python for finance, predictive analytics, GenAI/LLMs, and AI automation. It applies directly to my work in [role] because [specific application].',
      '8 weeks, no coding required, $5,000-range investment, taught by practitioners.',
    ],
    gaps: [
      'No published dollar figure for typical team training budgets at Microsoft.',
      'Recent (2025-2026) approval rates for external certs through team budgets not documented publicly.',
      'Friction varies significantly by manager and org; coach prospects to test the waters with their manager before assuming approval.',
    ],
  },
];
