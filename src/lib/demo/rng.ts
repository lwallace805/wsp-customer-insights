/**
 * Deterministic seeded PRNG (mulberry32) so the demo data is identical across
 * rebuilds — numbers never shuffle between deploys. Avoids Math.random().
 */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable string hash → seed. */
export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Rng = ReturnType<typeof makeRng>;

/** Integer in [min, max] inclusive. */
export function int(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Float in [min, max] rounded to `decimals`. */
export function float(rng: Rng, min: number, max: number, decimals = 1): number {
  const v = rng() * (max - min) + min;
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

/** Pick a random element. */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Draw an NPS score (0–10) from a promoter-skewed distribution.
 * `quality` 0..1 nudges toward more promoters. Yields realistic NPS bands.
 */
export function drawScore(rng: Rng, quality = 0.72): number {
  const r = rng();
  // promoter band (9-10), passive (7-8), detractor (0-6)
  const promoterCut = 0.55 + quality * 0.2; // ~0.55–0.75 chance promoter
  const passiveCut = promoterCut + 0.18;
  if (r < promoterCut) return rng() < 0.6 ? 10 : 9;
  if (r < passiveCut) return rng() < 0.5 ? 8 : 7;
  // detractor: skew toward 5-6 with a long tail down
  const d = rng();
  if (d < 0.5) return 6;
  if (d < 0.78) return 5;
  if (d < 0.9) return 4;
  if (d < 0.97) return 3;
  return int(rng, 0, 2);
}
