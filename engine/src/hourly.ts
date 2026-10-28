// Hourly research mode: reproduces fix.py on a 1 MW / 2 MWh battery.
// fix.py solves over the snapshot's file order (HB 1 of Oct 27 to HB 0 of Oct 28).
import { solveDp } from "./dp";
import type { DpResult } from "./dp";

export interface HourlyOpts {
  W: number;
  soc_min?: number;
  dis_cap?: number;
  P?: number;
  E?: number;
  soc0?: number;
  soc_end?: number;
  steps?: number;
  rte?: number;
  impact?: number[]; // per step, aligned to `price` (ff_price_impact); absent = price taker
}

export function dpHourly(price: number[], o: HourlyOpts): DpResult {
  const P = o.P ?? 1;
  const E = o.E ?? 2;
  const steps = o.steps ?? 40;
  const dz = E / steps;
  return solveDp({
    price,
    levels: steps,
    dz,
    eta: (o.rte ?? 0.88) ** 0.5,
    charge_max: price.map(() => P),
    discharge_max: price.map(() => o.dis_cap ?? 1),
    W: o.W,
    soc_min: o.soc_min ?? 0,
    start_level: Math.round((o.soc0 ?? 0.1) / dz),
    end_level: Math.round((o.soc_end ?? 0.1) / dz),
    to_mwh: 1,
    impact: o.impact,
  });
}

export function rotateLeft<T>(xs: T[], n: number): T[] {
  return [...xs.slice(n), ...xs.slice(0, n)];
}

// Snapshot index i is Mountain hour beginning (i + 1) % 24.
export const snapshotHour = (i: number) => (i + 1) % 24;

// fix.py crash rule: an hour fails unless min(SoC at start, SoC at end) >= 0.1 MWh and grid
// discharge < 1.0 MW. Returns step indexes.
export function hourlyUnanswerable(
  socs: number[],
  acts: number[],
  need = 0.1,
  P = 1,
): number[] {
  return acts.flatMap((a, i) =>
    Math.min(socs[i]!, socs[i + 1]!) >= need - 1e-9 && a < P - 1e-6 ? [] : [i],
  );
}

// Calls landing in Mountain hours `hours` when the heatmap's labels are read with `shift` hours of
// offset: Mountain hour h takes byHour[(h + shift) % 24] (0 = Mountain, 6 = UTC under MDT, 7 = UTC under MST).
export function callShare(hours: number[], byHour: number[], shift: number): number {
  return hours.reduce((a, h) => a + byHour[(h + shift) % 24]!, 0);
}
