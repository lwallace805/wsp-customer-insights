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
        id: 'nasdaq-sign',
        label: 'Nasdaq Sign — June 2026',
        date: '2026-06-05',
        program: 'AI for Business & Finance Certificate',
        summary:
          "Ten OOH-style concepts that place the AI for Business & Finance Certificate on the Nasdaq tower in Times Square — built in the finance audience's own native visual language: tickers, IPOs, breaking-news banners, stock charts, and new-listing cards. The set spans broad-prospecting scroll-stoppers, conversion-focused objection handling, and a prestige play for senior leaders, plus a 9:16 vertical built for Stories/Reels.",
        performanceContext: [
          { metric: 'Status', value: 'Concept', note: 'Not yet live' },
          { metric: 'Concepts', value: '10' },
          { metric: 'Formats', value: '9× 4:5 · 1× 9:16' },
          { metric: 'Theme', value: 'Nasdaq market-native OOH' },
        ],
        creativeGap:
          "No WSP paid social has used market-native OOH metaphors — ticker, IPO, breaking-news, new-listing card. These translate the program into the exact visual language the finance audience reads all day, and stake the Nasdaq / Times Square association before any competitor does.",
        ads: [
          {
            id: 1,
            name: 'Ticker Takeover',
            image: '/creative/ai-for-business/nasdaq-sign/wall-street-prep-static-4-5.png',
            format: 'Nasdaq ticker takeover · live-data styling',
            angle: 'Native market-data format — information density',
            audience: 'Finance professionals, broad prospecting',
            testingPriority: 'first',
            rationale: [
              'Course details scroll across the Nasdaq ticker exactly like live market data. Dense information, zero friction for finance pros.',
              'Reads as native market data rather than an ad — earns attention from an audience that scans tickers all day.',
            ],
          },
          {
            id: 2,
            name: 'IPO Launch Announcement',
            image: '/creative/ai-for-business/nasdaq-sign/wall-street-prep-static-4-5-2.png',
            format: 'IPO announcement · confetti motif',
            angle: 'Milestone framing / emotional weight',
            audience: 'All segments — brand + prospecting',
            testingPriority: 'third',
            rationale: [
              'The program treated as a major Nasdaq IPO, complete with confetti graphics. Borrows the emotional weight of a market milestone.',
            ],
          },
          {
            id: 3,
            name: 'Markets Open — Your Edge Opens',
            image: '/creative/ai-for-business/nasdaq-sign/wall-street-prep-static-4-5-3.png',
            format: 'Golden-hour OOH · headline subversion',
            angle: 'Career edge / timing',
            audience: 'Career pivoters',
            testingPriority: 'second',
            rationale: [
              'Golden hour morning shot with the subverted phrase: "Markets open at 9:30. Your AI edge opens now." Direct appeal to the career pivoter archetype.',
            ],
          },
          {
            id: 4,
            name: 'Career Stock Chart',
            image: '/creative/ai-for-business/nasdaq-sign/wall-street-prep-static-4-5-4.png',
            format: 'Upward stock chart · inflection-point marker',
            angle: 'Before/after career trajectory',
            audience: 'Early-career builders & career pivoters',
            testingPriority: 'second',
            rationale: [
              'An upward-trending chart on the screen with the AI Certificate marked as the inflection point. The before/after concept in the finance audience’s native visual language.',
            ],
          },
          {
            id: 5,
            name: 'Breaking News',
            image: '/creative/ai-for-business/nasdaq-sign/wall-street-prep-static-4-5-5.png',
            format: 'Breaking-news banner (CNBC/Bloomberg style)',
            angle: 'Pattern interrupt / urgency',
            audience: 'All segments, broad prospecting',
            testingPriority: 'first',
            rationale: [
              'CNBC/Bloomberg-style "BREAKING" banner: "AI is reshaping finance. Are you ready?" Pattern interrupt using a media format they check daily.',
            ],
          },
          {
            id: 6,
            name: 'WSP New Listing Card',
            image: '/creative/ai-for-business/nasdaq-sign/wall-street-prep-static-4-5-6.png',
            format: 'New-listing spec card · ticker "WSP"',
            angle: 'Authority / specificity',
            audience: 'Consideration-stage prospects',
            testingPriority: 'second',
            rationale: [
              'The program formatted as a new Nasdaq listing: ticker symbol "WSP", duration, partner, prerequisites. Specificity delivered in the most authoritative format possible.',
            ],
          },
          {
            id: 7,
            name: 'Night Silhouette (9:16 vertical)',
            image: '/creative/ai-for-business/nasdaq-sign/wall-street-prep-static-9-16.png',
            format: '9:16 vertical · cinematic silhouette (Stories/Reels)',
            angle: 'Aspirational / brand',
            audience: 'Stories & Reels placements, broad',
            testingPriority: 'second',
            rationale: [
              'Cinematic silhouette of a professional looking up at the glowing screen. "The future of finance runs on AI. Do you?" Built for Stories/Reels full-screen.',
            ],
          },
          {
            id: 8,
            name: 'Python Meets the Ticker',
            image: '/creative/ai-for-business/nasdaq-sign/wall-street-prep-static-4-5-7.png',
            format: 'Split screen · Python terminal + ticker',
            angle: 'Tech-meets-finance / capability proof',
            audience: 'Technical & quant-curious finance pros',
            testingPriority: 'third',
            rationale: [
              'The screen split: terminal code on top, Nasdaq ticker below. Tech-meets-finance in a way no competitor is doing.',
            ],
          },
          {
            id: 9,
            name: 'Finance Pros — Learn AI in 8 Weeks',
            image: '/creative/ai-for-business/nasdaq-sign/wall-street-prep-static-4-5-8.png',
            format: 'Direct-address · checkmark objection handling',
            angle: 'Objection handling / conversion',
            audience: 'Finance professionals, mid-funnel',
            testingPriority: 'first',
            rationale: [
              'Direct audience address with checkmark objection-handling. "No coding required" as the first bullet addresses the #1 enrollment barrier from the learner data.',
            ],
          },
          {
            id: 10,
            name: 'Columbia x Nasdaq Prestige',
            image: '/creative/ai-for-business/nasdaq-sign/wall-street-prep-static-4-5-9.png',
            format: 'Minimal editorial · Columbia seal',
            angle: 'Prestige / brand credibility',
            audience: 'CFO / VP / senior finance leaders',
            testingPriority: 'third',
            rationale: [
              'Minimal, editorial. Columbia seal dominant, elegant typography. Targets the CFO/VP segment who respond to luxury-brand aesthetics, not loud sales ads.',
            ],
          },
        ],
      },
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
