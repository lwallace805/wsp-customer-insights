export type NPSCategory = 'promoter' | 'passive' | 'detractor';

export function categorize(score: number): NPSCategory {
  if (score >= 9) return 'promoter';
  if (score >= 7) return 'passive';
  return 'detractor';
}

export type NPSSummary = {
  score: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
  promoterCount: number;
  passiveCount: number;
  detractorCount: number;
  totalResponses: number;
};

export function calculateNPS(scores: number[]): NPSSummary {
  const total = scores.length;
  if (total === 0) {
    return { score: 0, promoterPct: 0, passivePct: 0, detractorPct: 0, promoterCount: 0, passiveCount: 0, detractorCount: 0, totalResponses: 0 };
  }

  const promoters = scores.filter(s => s >= 9).length;
  const passives = scores.filter(s => s >= 7 && s < 9).length;
  const detractors = scores.filter(s => s < 7).length;

  const promoterPct = Math.round((promoters / total) * 100);
  const passivePct = Math.round((passives / total) * 100);
  const detractorPct = Math.round((detractors / total) * 100);

  return {
    score: promoterPct - detractorPct,
    promoterPct,
    passivePct,
    detractorPct,
    promoterCount: promoters,
    passiveCount: passives,
    detractorCount: detractors,
    totalResponses: total,
  };
}

export function groupByPeriod(
  records: { date: string; score: number }[],
  period: 'month' | 'quarter' = 'month'
): { period: string; score: number; responses: number }[] {
  const groups: Record<string, number[]> = {};

  records.forEach(({ date, score }) => {
    const d = new Date(date);
    const key =
      period === 'month'
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : `${d.getFullYear()} Q${Math.ceil((d.getMonth() + 1) / 3)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(score);
  });

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([p, scores]) => ({
      period: p,
      score: calculateNPS(scores).score,
      responses: scores.length,
    }));
}
