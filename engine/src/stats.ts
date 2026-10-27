// Summary statistics for the backtest. Percentiles interpolate linearly, like numpy's default.
import type { Pctl } from "@contracts/types";

export function percentile(xs: number[], q: number): number {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

export const mean = (xs: number[]) =>
  xs.length === 0 ? Number.NaN : xs.reduce((a, x) => a + x, 0) / xs.length;

export function pctl(xs: number[]): Pctl {
  return {
    p10: percentile(xs, 0.1),
    p50: percentile(xs, 0.5),
    p90: percentile(xs, 0.9),
    mean: mean(xs),
  };
}
