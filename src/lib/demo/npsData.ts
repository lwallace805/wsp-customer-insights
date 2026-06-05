/**
 * Synthetic NPS + survey data for demo mode.
 *
 * Produces records in the exact AirtableRecord shape the API routes expect,
 * keyed by the routes' DEFAULT field names (e.g. 'Recommend Likelihood
 * (Number)', 'Survey Name'). Because the routes fall back to those defaults
 * when env vars are unset, the demo needs no field-name env vars.
 *
 * The real aggregation logic (NPS calc, theme extraction, trends) then runs on
 * this synthetic raw data, so every dashboard stays internally consistent.
 *
 * Directionally plausible, deterministic, and contains no real customer PII.
 */
import type { AirtableRecord } from "@/lib/airtable";
import { makeRng, hashSeed, int, float, pick, drawScore, type Rng } from "@/lib/demo/rng";

// Survey names chosen to match the patterns in certPrograms.ts
const PROGRAMS: { survey: string; quality: number }[] = [
  { survey: "Private Equity Certificate", quality: 0.78 },
  { survey: "Real Estate Certificate", quality: 0.74 },
  { survey: "Financial Planning & Analysis (FP&A) Certificate", quality: 0.8 },
  { survey: "Applied Value Investing Certificate", quality: 0.7 },
  { survey: "AI for Business & Finance Certificate", quality: 0.82 },
  { survey: "Hedge Fund Certificate", quality: 0.68 },
];

// Cohort → representative year/month (dateToCohort buckets by month).
// Mirrors COHORT_ORDER (Summer 2025 intentionally omitted).
const COHORTS: { label: string; year: number; month: number; base: number }[] = [
  { label: "Fall 2024", year: 2024, month: 10, base: 55 },
  { label: "Winter 2025", year: 2025, month: 1, base: 60 },
  { label: "Spring 2025", year: 2025, month: 4, base: 66 },
  { label: "Fall 2025", year: 2025, month: 10, base: 72 },
  { label: "Winter 2026", year: 2026, month: 1, base: 70 },
  { label: "Spring 2026", year: 2026, month: 4, base: 64 },
];

const REGIONS = ["North America", "North America", "North America", "EMEA", "APAC", "LATAM"] as const;
const CLIENT_TYPES = ["Individual", "Individual", "Corporate"] as const;

const FIRST = ["Alex","Jordan","Taylor","Morgan","Priya","Wei","Diego","Sana","Liam","Nina","Omar","Chloe","Marcus","Ava","Ravi","Elena","Noah","Maya","Caleb","Yuki","Sofia","Ethan","Aisha","Leo","Hana","Tomas","Grace","Ian","Zara","Felix"];
const LAST = ["Carter","Nguyen","Patel","Reyes","Okafor","Bauer","Romano","Kowalski","Haddad","Sato","Lindqvist","Mensah","Park","Delgado","Novak","Ibrahim","Fischer","Costa","Walsh","Tan","Andersson","Mwangi","Schneider","Rossi","Klein","Dubois","Becker","Singh","Moreau","Vega"];

const POSITIVE = [
  "The instructor explained complex topics clearly and kept every session engaging.",
  "Incredibly practical — I applied the financial model to a live deal the same week.",
  "Materials were excellent and the case studies felt real-world relevant.",
  "Great pacing and the workshop format made the technical content stick.",
  "The presenter was a practitioner, which made the valuation walkthroughs land.",
  "Best part was the hands-on Excel and LBO modeling — desk-ready skills.",
  "Genuinely useful. The DCF and forecasting sections were worth it on their own.",
  "Very well structured, and the support team responded fast on the forum.",
  "Loved how interactive it was. The platform and recordings were easy to access.",
  "The content was challenging in the right way and highly applicable to my role.",
  "Strong curriculum. The instructor's industry examples made everything concrete.",
  "Helpful and clear — I finally understand how to build a three-statement model.",
  "The case studies were the highlight; practical and relevant to what I do daily.",
  "Engaging sessions, excellent materials, and a responsive teaching assistant.",
  "Fantastic real-world relevance. I can apply the analysis immediately at work.",
];

const CONSTRUCTIVE = [
  "Solid content, but the pace felt rushed in the modeling weeks.",
  "Good materials, though I wanted more practice exercises on valuation.",
  "Useful overall, but a few sessions ran long and felt dense.",
  "The platform had some video buffering issues during live sessions.",
  "Helpful, but the difficulty jumped quickly — more beginner ramp would help.",
  "Decent, though I expected more support and feedback on assignments.",
  "Content was relevant but the slides could be more polished.",
  "Worthwhile, but scheduling across time zones was tricky for APAC.",
];

function commentFor(rng: Rng, score: number): string {
  if (score >= 9) return pick(rng, POSITIVE);
  if (score >= 7) return rng() < 0.5 ? pick(rng, POSITIVE) : pick(rng, CONSTRUCTIVE);
  return pick(rng, CONSTRUCTIVE);
}

function ratingFor(rng: Rng, score: number): number {
  // correlate ratings with NPS score, clamp to 2.5–5.0
  const base = 2.8 + (score / 10) * 2.0;
  return Math.min(5, Math.max(2.5, +(base + float(rng, -0.3, 0.3, 2)).toFixed(1)));
}

let npsCache: AirtableRecord[] | null = null;

export function generateNpsRecords(): AirtableRecord[] {
  if (npsCache) return npsCache;
  const records: AirtableRecord[] = [];
  let i = 0;

  for (const prog of PROGRAMS) {
    for (const cohort of COHORTS) {
      const rng = makeRng(hashSeed(`${prog.survey}|${cohort.label}`));
      const n = int(rng, 38, 88);
      for (let k = 0; k < n; k++) {
        const score = drawScore(rng, prog.quality);
        const day = int(rng, 1, 28);
        const date = `${cohort.year}-${String(cohort.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const hasComment = score >= 9 ? rng() < 0.55 : rng() < 0.75;
        records.push({
          id: `demo-nps-${i++}`,
          fields: {
            "Survey Name": prog.survey,
            "Recommend Likelihood (Number)": score,
            "Response Date": date,
            "Recommendation Reasoning": hasComment ? commentFor(rng, score) : "",
            "Name": `${pick(rng, FIRST)} ${pick(rng, LAST)}`,
            "Region": pick(rng, REGIONS),
            "Client Type": pick(rng, CLIENT_TYPES),
            "Course Rating": ratingFor(rng, score),
            "Presenter Rating": ratingFor(rng, score),
            "Relevance": ratingFor(rng, score),
            "Materials Rating": ratingFor(rng, score),
          },
        });
      }
    }
  }
  npsCache = records;
  return records;
}

let surveyCache: AirtableRecord[] | null = null;

export function generateSurveyRecords(): AirtableRecord[] {
  if (surveyCache) return surveyCache;
  const records: AirtableRecord[] = [];
  let i = 0;

  for (const prog of PROGRAMS) {
    for (const cohort of COHORTS) {
      const rng = makeRng(hashSeed(`survey|${prog.survey}|${cohort.label}`));
      const responses = int(rng, 60, 140);
      // NPS centered on cohort.base with program quality nudge
      const nps = Math.round(
        cohort.base + (prog.quality - 0.74) * 40 + float(rng, -6, 6, 1),
      );
      const promoterPct = Math.min(0.92, Math.max(0.4, 0.5 + nps / 200));
      const detractorPct = Math.max(0.03, promoterPct - nps / 100);
      const promoters = Math.round(responses * promoterPct);
      const detractors = Math.round(responses * detractorPct);
      records.push({
        id: `demo-survey-${i++}`,
        fields: {
          "Survey Name": prog.survey,
          "Date": `${cohort.year}-${String(cohort.month).padStart(2, "0")}-15`,
          "Survey Type": "Post-Course",
          "Region": "North America",
          "Client Type": rng() < 0.4 ? "Corporate" : "Individual",
          "NPS Score": nps,
          "Course Rating": float(rng, 4.1, 4.8, 1),
          "Presenter Rating": float(rng, 4.2, 4.9, 1),
          "Relevance Rating": float(rng, 4.0, 4.8, 1),
          "Materials Rating": float(rng, 4.0, 4.7, 1),
          "# Responses": responses,
          "Promoters": promoters,
          "Detractors": detractors,
          "Executive Summary": `${prog.survey} — ${cohort.label}: NPS ${nps} across ${responses} responses. Strongest themes were instructor quality and real-world relevance; pacing was the most common constructive note.`,
          "Survey URL": "#",
        },
      });
    }
  }
  surveyCache = records;
  return records;
}
