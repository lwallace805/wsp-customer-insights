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
  lastUpdated: 'May 31, 2026',
  status:
    'Living document. Public-source research compiled to v1; gaps flagged in each section and will fill in as we hear back from employer ambassadors and HR contacts.',
  cohortClose: 'July 13, 2026',
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
    platform: 'GS HR/benefits portal',
    recommendedPath: 'Standard tuition reimbursement; confirm with HR',
  },
  {
    employer: 'JPMorganChase',
    verdict: 'clear',
    verdictWord: 'Clear',
    cap: '$7,500/yr out-of-catalog',
    platform: 'Guild Education',
    recommendedPath: 'Out-of-catalog Guild path; pre-approve, pay upfront, reimburse',
  },
  {
    employer: 'Citi',
    verdict: 'difficult',
    verdictWord: 'Difficult',
    cap: 'Tuition program likely excludes',
    platform: 'EdAssist (tuition); BU L&D (alt)',
    recommendedPath: 'Department training budget; bypass tuition program',
  },
  {
    employer: 'Bank of America',
    verdict: 'clear',
    verdictWord: 'Clear',
    cap: '$7,500/yr + $1K stipend',
    platform: 'EdAssist (trp.edassist.com)',
    recommendedPath: 'Tuition program; request pre-pay voucher',
  },
  {
    employer: 'Microsoft',
    verdict: 'difficult',
    verdictWord: 'Difficult',
    cap: 'Tuition program excludes; team budget varies',
    platform: 'EdAssist (formal); team budget (alt)',
    recommendedPath: 'Team training budget with manager approval',
  },
];

export const CROSS_EMPLOYER_NOTE =
  "Two of the five employers in this campaign (Citi and Microsoft) have tuition programs that likely won't cover a non-credit Executive Education certificate. For those prospects, the advisor's job is to redirect to the right internal channel (department training budget at Citi; team training budget with manager approval at Microsoft). For the other three (BofA, JPMC, GS), there is a clear or likely tuition-program path.";

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
      'For employers with caps above $5,250 (BofA $7,500; JPMC $7,500 out-of-catalog; MSFT $10K formal; GS ~$10K [likely]), the difference is reported on W-2.',
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
      "Citi: $7,500/year graduate (but cert likely doesn't qualify)",
      "Microsoft: $10K/year formal program (but cert doesn't qualify); team budget caps vary",
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
      'If the employer still excludes professional certs from the tuition program (Citi, Microsoft case), redirect to team or department training budget. "That\'s a tuition-program rule. The team training budget channel is different and is the right channel for this kind of program."',
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
      'Counter (Citi or MSFT team budget path): "Team budget approval is faster: usually 1 to 3 weeks because it doesn\'t go through a benefits platform."',
    ],
  },
];

export interface SourceGroup {
  employer: string;
  links: { label: string; url: string }[];
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
      { label: 'Platform / admin', value: 'GS internal HR/benefits portal (not Guild, not EdAssist per available public sources)' },
      { label: 'Pre-approval', value: 'Required before enrollment [likely; standard banking-sector practice]' },
      { label: 'Tax treatment', value: 'Tax-free up to IRS $5,250/year; amounts above are taxable W-2 wages' },
    ],
    approvalSteps: [
      'Standard path is HR/benefits portal submission plus manager sign-off, with pre-approval before enrollment.',
      'Goldman also runs a selective MBA sponsorship track for high-performing associates/VPs (typically 2 to 6 years tenure) with manager nomination and committee approval. That track is separate from standard tuition reimbursement.',
      'Reimbursement is paid after course completion with proof of passing grade.',
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
      { label: 'Platform / admin', value: 'Guild Education at jpmc.guildeducation.com' },
      { label: 'Pre-approval', value: 'Required for out-of-catalog programs; employee pays upfront, submits receipts plus proof of completion for reimbursement' },
      { label: 'Tax treatment', value: 'Tax-free up to $5,250; amounts above (in the $7,500 cert track) are taxable W-2 wages' },
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
    ],
  },
  {
    id: 'citi',
    name: 'Citi',
    verdict: 'difficult',
    verdictWord: 'Difficult',
    verdictHeadline: 'Difficult path',
    verdictSummary:
      "Citi's standard tuition program likely does NOT cover this. Route through department/business-unit training budget instead.",
    recommendedPath:
      'Business-unit / department training budget. Coach the prospect to position the cert as manager-approved L&D / training, not tuition reimbursement — the same channel Citi uses for CFA/CPA candidates.',
    atAGlance: [
      { label: 'Annual cap', value: '$5,250 undergrad / $7,500 grad through standard Citi Tuition Program. But the cert likely does not qualify (see below).' },
      { label: 'Tenure requirement', value: '90 days at Citi' },
      { label: 'Platform / admin', value: 'Bright Horizons EdAssist at citi.edassist.com' },
      { label: 'Pre-approval', value: 'Required for tuition program; application submitted before course start date' },
      { label: 'Coverage gap', value: 'Citi explicitly excludes CFA, CFP, CPA, PHR, Six Sigma, and similar standalone professional certs from the tuition program. Non-credit Executive Education certificates fall in the same gray-to-excluded zone.' },
    ],
    approvalSteps: [
      'Coach the prospect to position the cert as manager-approved L&D / training, not tuition reimbursement.',
      'Target: line manager + L&D lead for their business unit (ICG / Markets / Banking / Consumer).',
      'Frame: "This is a focused training investment, not a degree program. I\'d like to fund it from my team\'s training budget, similar to how CFA prep gets funded."',
      'Confirm: ask the prospect to check with their manager and HR business partner; the same path that Citi uses for CFA/CPA candidates is the right channel here.',
    ],
    willCover: [
      'Through standard Tuition Program / EdAssist: unlikely. (Verdict: medium confidence based on published exclusion list and program scope.) Citi\'s published Tuition Program Guidelines (last updated Jan 2024) limit eligibility to courses at accredited U.S. colleges and universities, and explicitly exclude standalone professional certifications.',
      'Through department training budget / manager-approved L&D: yes, with the right pitch. This is the standard channel for non-degree professional certs at Citi.',
      'If the prospect insists on EdAssist path: have them call EdAssist coaching first to get a yes/no read before enrolling. Free 1:1 coaching is included.',
    ],
    timeline: [
      'Department training budget approval timeline is highly variable: 1 to 4 weeks depending on manager and budget cycle.',
      'Documentation usually simpler than EdAssist: invoice from WSP, manager email approval, finance/PO process per business unit.',
    ],
    managerPitch: [
      'I\'d like to fund this through team training budget, similar to how we fund CFA prep or other professional development. The Citi tuition program excludes standalone certs, so this is the right channel.',
      "It's a focused 8-week AI + finance certificate, cobranded with Columbia Business School Executive Education, taught by practitioners.",
      'It applies directly to my work in [role/team] because [specific application].',
    ],
    gaps: [
      'No public list of approved non-credit Exec Ed programs through Citi EdAssist.',
      'Department training budget specifics vary by business unit; no public guidance.',
      'Processing timeline for EdAssist reimbursement not publicly documented (industry standard 4 to 6 weeks).',
    ],
  },
  {
    id: 'bank-of-america',
    name: 'Bank of America',
    verdict: 'clear',
    verdictWord: 'Clear',
    verdictHeadline: 'Strongest path of the five employers',
    verdictSummary:
      'Covers professional certifications; pre-pay voucher option eliminates upfront cost.',
    recommendedPath:
      'Tuition program through EdAssist (trp.edassist.com). Submit for pre-approval and request the pre-pay voucher so BofA pays the school directly — no out-of-pocket front.',
    atAGlance: [
      { label: 'Annual cap', value: '$7,500/year plus $1,000 books/supplies stipend; resets annually, no lifetime maximum' },
      { label: 'Tenure requirement', value: '6 months at BofA' },
      { label: 'Eligibility', value: 'Full-time AND part-time US employees (includes branch staff, not just corporate)' },
      { label: 'Platform / admin', value: 'Bright Horizons EdAssist at trp.edassist.com; support 855-825-0120' },
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
    id: 'microsoft',
    name: 'Microsoft',
    verdict: 'difficult',
    verdictWord: 'Difficult',
    verdictHeadline: 'Standard tuition program does NOT cover this',
    verdictSummary:
      'Realistic path is manager-approved team training budget.',
    recommendedPath:
      "Manager-approved team / group training budget. Microsoft's benefits page explicitly says certificates/CEUs can be reimbursed through your group's training budget if your manager approves — this is the only realistic path for the AI Cert.",
    atAGlance: [
      { label: 'Annual cap (formal program)', value: '$10,000/year corporate (grad or combined); $5,250/year for undergrad-only; $5,250/year for retail' },
      { label: 'Tenure requirement', value: 'Benefits-eligible (no published waiting period beyond benefits eligibility)' },
      { label: 'Platform / admin', value: 'EdAssist by Bright Horizons at microsoft.edassist.com' },
      { label: 'Pre-approval', value: 'Required; manager written approval (email) required before each application' },
      { label: 'Coverage gap', value: 'Microsoft\'s official policy EXPLICITLY excludes "continuing education courses (CEU), professional certificates, seminars, conferences, or courses that do not assign college-level credits." The WSP cert is non-credit Executive Education, so it falls into the excluded category.' },
    ],
    approvalSteps: [
      'Microsoft\'s benefits page explicitly states: "you may be able to get reimbursement for these [certificates/CEUs/conferences] through your group\'s training budget, if your manager approves." This is the only realistic path for the AI Cert at Microsoft.',
      'Team training budgets are decentralized and vary by org/manager. No published per-employee allotment.',
      'Approval probability is materially higher for Microsoft Finance, Corporate Development, Treasury, FP&A, Investor Relations, and Strategy employees than for Engineering or Product, because the finance angle maps directly to job function.',
    ],
    willCover: [
      'Through formal Tuition Assistance Program (EdAssist): no. Explicitly excluded. Microsoft\'s published program covers accredited institutions recognized for college-level credit; the WSP cert is non-credit, which is excluded by name in policy.',
      'Through manager-approved group training budget: yes, with the right pitch: most likely for Finance / Corp Dev / Treasury / Strategy roles.',
      'For Engineering / Product / non-finance roles: the manager-pitch case is weaker because the finance focus doesn\'t map as cleanly to job function. Still possible if the prospect can frame AI-finance integration as relevant to their org (FinTech, Cloud Finance, AI Productivity, etc.).',
    ],
    timeline: [
      'Team training budget approval timeline is variable: 1 to 4 weeks depending on manager and quarterly budget cycle.',
      'Documentation: invoice from WSP, manager email approval, internal finance/PO process per org.',
    ],
    managerPitch: [
      'This is a finance-focused AI certificate, cobranded with Columbia Business School Executive Education. It\'s not eligible for the formal tuition program because it\'s non-credit Executive Education, but Microsoft\'s benefits page specifically says team training budgets can cover this category if the manager approves.',
      'The program is built for finance professionals; it covers Python for finance, predictive analytics, GenAI/LLMs, and AI automation. It applies directly to my work in [role] because [specific application].',
      '8 weeks, no coding required, $5,000-range investment, taught by practitioners.',
    ],
    gaps: [
      'No published dollar figure for typical team training budgets at Microsoft.',
      'Recent (2025-2026) employee approval rates for external certs through team budgets are not documented publicly.',
      'Friction will vary significantly by manager and org; coach prospects to test the waters with their manager before assuming approval.',
    ],
  },
];
