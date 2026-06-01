export type TestingPriority = 'first' | 'second' | 'third';

export type AdConcept = {
  id: number;
  name: string;
  image: string;
  format: string;
  angle: string;
  audience: string;
  testingPriority: TestingPriority;
  rationale: string[];
};

export type CreativeBatch = {
  id: string;
  label: string;
  date: string;
  program: string;
  summary: string;
  performanceContext: {
    metric: string;
    value: string;
    note?: string;
  }[];
  creativeGap: string;
  ads: AdConcept[];
};

export type CreativeProgram = {
  id: string;
  label: string;
  batches: CreativeBatch[];
};

export const CREATIVE_PROGRAMS: CreativeProgram[] = [
  {
    id: 'ai-for-business',
    label: 'AI for Business & Finance',
    batches: [
      {
        id: 'batch-1',
        label: 'Batch 1 — June 2026',
        date: '2026-06-01',
        program: 'AI for Business & Finance Certificate',
        summary:
          'Every existing ad uses campus photography and feature layouts — zero human faces, testimonials, urgency, or outcome messaging. CTR is stuck under 1.2% despite a $97 CPL winner. These 10 concepts break that creative rut by introducing 7 formats that have never appeared in WSP paid social: human eye macro, iOS native mockup, contrarian MBA comparison, before/after split, executive-specific track, testimonial quote card, and instructor portrait. No competitor is running AI + finance-specific ads — this is WSP\'s category to own, anchored by the Columbia CBS credential.',
        performanceContext: [
          { metric: 'Spend (90d)', value: '$9,581' },
          { metric: 'CTR', value: '0.82%', note: 'Below 1–2% benchmark' },
          { metric: 'CPL', value: '$180.77' },
          { metric: 'Best Performer CPL', value: '$97', note: '"AI Champion" checklist — 34 leads, 9 purchases' },
          { metric: 'Cost Per Purchase', value: '$737' },
        ],
        creativeGap:
          'After auditing 20+ current and paused creatives: zero ads feature a human face, testimonial, instructor, urgency hook, career outcome message, contrarian angle, or platform-native format.',
        ads: [
          {
            id: 1,
            name: 'Eye Macro — "Applications Now Open"',
            image: '/creative/ai-for-business/batch-1/wall-street-prep-static-4-5.png',
            format: 'Dramatic eye macro photography + urgency hook',
            angle: 'Scarcity / urgency — cohort filling',
            audience: 'All segments, broad prospecting',
            testingPriority: 'first',
            rationale: [
              'Directly replicates WSO\'s #1 scoring ad format (score 100) — proven in the same finance professional audience',
              'Human eye macro is WSO\'s most-used hero: 3 of their top 5 ads use it, none of WSP\'s current ads do',
              '100% of WSO\'s top performers use urgency/scarcity language — this is the first WSP AI ad to do the same',
              'Broad enough to work at top of funnel for prospecting while driving cohort deadline action',
            ],
          },
          {
            id: 2,
            name: 'iOS Notes Mockup — "2026 Goals"',
            image: '/creative/ai-for-business/batch-1/wall-street-prep-static-4-5-2.png',
            format: 'Platform-native mobile UI mockup, dark mode',
            angle: 'Aspirational goal-setting / self-identification',
            audience: 'Career Pivoters and Early-Career Builders',
            testingPriority: 'second',
            rationale: [
              'WSO\'s iOS Notes mockup scored 84 with 101,868 reach — proven format in this exact audience',
              'Feels like content, not an ad — native UI format bypasses ad fatigue and stops the scroll',
              'Zero competitors use this format for AI/finance content, making it ownable whitespace',
              'Goal-setting framing (2026 Goals) triggers self-identification: viewer sees their own aspiration reflected back',
            ],
          },
          {
            id: 3,
            name: 'MBA Alternative — Contrarian',
            image: '/creative/ai-for-business/batch-1/wall-street-prep-static-4-5-3.png',
            format: 'Bold text-only, deep navy, minimal',
            angle: 'Contrarian comparison — MBA cost vs. 8 weeks',
            audience: 'Career Pivoters who considered or rejected an MBA',
            testingPriority: 'first',
            rationale: [
              'NPS verbatim data: "I was initially looking at MBA programs but I\'m already a workaholic mother of a toddler" — this ad is their exact inner dialogue',
              'Brand new angle: zero competitors are running AI upskilling vs. MBA comparison ads',
              'Directly addresses the Career Pivoter archetype\'s core trade-off: credential value vs. time/cost',
              'Bold type-only format signals confidence and authority without relying on imagery',
              'Recommended body copy: "Finance professionals who understand AI aren\'t just keeping up — they\'re leading. 8 weeks. No coding required."',
            ],
          },
          {
            id: 4,
            name: 'Before/After Transformation',
            image: '/creative/ai-for-business/batch-1/wall-street-prep-static-4-5-4.png',
            format: 'Split-frame comparison',
            angle: '"Which side of AI are you on?" — professional identity fear',
            audience: 'All segments, FOMO-driven',
            testingPriority: 'third',
            rationale: [
              'NPS implication: "Lead with specific before/after scenarios" — no current WSP AI creative uses this structure',
              'Taps professional fear of being left behind by AI, the strongest motivator in this audience segment',
              'Split-frame format creates immediate visual contrast that works even with a 1-second glance',
              'Broad enough for all three archetypes while landing hardest on mid-career professionals',
            ],
          },
          {
            id: 5,
            name: 'Executive Track — "Lead. Don\'t Code."',
            image: '/creative/ai-for-business/batch-1/wall-street-prep-static-4-5-5.png',
            format: 'Bold type-first, executive premium aesthetic',
            angle: 'Non-technical executive messaging track',
            audience: 'CFOs, VPs, senior finance professionals',
            testingPriority: 'first',
            rationale: [
              'NPS data explicitly identifies a two-track messaging gap: current single-track messaging creates detractors from the executive segment',
              'Fills a complete blind spot — no existing WSP AI ad speaks directly to executives who need AI literacy without coding',
              'Recommended body copy: "You didn\'t get to where you are by doing the technical work yourself. You got there by understanding it well enough to lead it."',
              'Premium aesthetic signals the $4,800 price point appropriately to a senior audience',
              'Closes the audience gap that the NPS data called out by name',
            ],
          },
          {
            id: 6,
            name: 'Learner Quote Card',
            image: '/creative/ai-for-business/batch-1/wall-street-prep-static-4-5-6.png',
            format: 'Dark editorial quote card, testimonial',
            angle: 'Real learner voice — removes the "too technical" objection before the click',
            audience: 'Skeptics who fear the course is too coding-focused',
            testingPriority: 'third',
            rationale: [
              'First-ever testimonial-based ad in WSP AI paid social — 66% promoters are ready to advocate and have never been featured',
              'The quote chosen targets the #1 objection (too coding-focused) and neutralizes it before the click, improving post-click conversion quality',
              'Supports mid-funnel: works well for warm audiences who\'ve seen top-of-funnel ads but haven\'t converted',
              'Social proof is the highest-trust creative format — learner voice outperforms brand voice for skeptical prospects',
            ],
          },
          {
            id: 7,
            name: 'LinkedIn Certification — "Your LinkedIn, July 2026"',
            image: '/creative/ai-for-business/batch-1/wall-street-prep-static-4-5-7.png',
            format: 'Phone mockup showing LinkedIn profile with Columbia CBS certification',
            angle: 'Credential aspiration — second-person framing',
            audience: 'Early-Career Builders and International Professionals',
            testingPriority: 'third',
            rationale: [
              'The Columbia CBS certification asset has never appeared as a hero in any WSP paid social creative — massive untapped credential asset',
              'Second-person framing ("Your LinkedIn") creates personal identification: the viewer pictures their own profile',
              '"July 2026" creates a concrete, near-term aspirational moment — not abstract career transformation',
              'Columbia is globally recognized — particularly strong for the International Professional archetype',
            ],
          },
          {
            id: 8,
            name: 'Outcomes Checklist',
            image: '/creative/ai-for-business/batch-1/wall-street-prep-static-4-5-8.png',
            format: 'Clean checklist on white/light background',
            angle: 'What you\'ll DO (outcomes) vs. what you\'ll learn (topics)',
            audience: 'Analytical, ROI-focused professionals',
            testingPriority: 'second',
            rationale: [
              'Direct upgrade to the #1 performing creative (checklist format, $97 CPL) — same format, higher-value content',
              'NPS implication: "Specificity wins — \'Build a full LBO model\' converts better than \'learn financial modeling\'"',
              'Shifts from module names to concrete job-relevant outcomes, matching what promoters say they valued most',
              'Analytical audience responds to tangible deliverables over abstract skill claims',
            ],
          },
          {
            id: 9,
            name: 'Instructor Authority — Daniel Guetta',
            image: '/creative/ai-for-business/batch-1/wall-street-prep-static-4-5-9.png',
            format: 'Split portrait + credential card',
            angle: 'Learn from a named practitioner-professor',
            audience: 'All segments, authority-driven',
            testingPriority: 'second',
            rationale: [
              'Daniel Guetta is specifically named by promoters in NPS feedback — he\'s already a conversion driver, just never featured visually',
              'Learner intelligence: "Feature specific instructors in paid social. The human face converts better than the institutional brand."',
              'Zero current WSP creatives feature any human face — this closes the biggest format gap in the entire creative library',
              'Authority format (named expert + credential) builds immediate trust for a $4,800 purchase decision',
            ],
          },
          {
            id: 10,
            name: 'Columbia Certificate — "Earn This"',
            image: '/creative/ai-for-business/batch-1/wall-street-prep-static-4-5-10.png',
            format: 'Premium credential display on dark navy',
            angle: 'Tangible credential aspiration, premium positioning',
            audience: 'International Professionals and career credential-seekers',
            testingPriority: 'third',
            rationale: [
              'At $4,800 tuition, WSP competes in premium executive education — current creatives don\'t signal this price tier visually',
              'The certificate as hero object makes the outcome concrete: a physical artifact the viewer can picture on their wall or LinkedIn',
              'Columbia Business School brand carries global recognition that the WSP brand alone does not',
              'Best suited for retargeting warm audiences or international audiences where the Columbia credential is a primary driver',
            ],
          },
        ],
      },
    ],
  },
];
