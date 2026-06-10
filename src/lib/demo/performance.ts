// Demo-mode synthetic data for the Performance Dashboards — scales the real
// snapshot by a deterministic seeded factor so demo numbers are stable across
// rebuilds but clearly not real.

import { CURRENT_SNAPSHOT } from '@/data/performance/currentSnapshot';
import type { CurrentSnapshot } from '@/data/performance/types';
import { makeRng, hashSeed, float } from './rng';

export function getDemoSnapshot(): CurrentSnapshot {
  const programs = CURRENT_SNAPSHOT.programs.map(p => {
    const rng = makeRng(hashSeed(`perf-${p.program}`));
    const f = float(rng, 0.82, 1.18, 2);
    const scale = (n: number) => Math.round(n * f);
    return {
      ...p,
      enrolls: {
        realTime: scale(p.enrolls.realTime),
        forecast: scale(p.enrolls.forecast),
        finalTarget: scale(p.enrolls.finalTarget),
      },
      leads: {
        realTime: scale(p.leads.realTime),
        forecast: scale(p.leads.forecast),
        finalTarget: scale(p.leads.finalTarget),
      },
    };
  });
  return { ...CURRENT_SNAPSHOT, programs };
}
