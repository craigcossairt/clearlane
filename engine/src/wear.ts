// Wear price: the smallest W (to the cent) at which clearlane's day-ahead plans stay inside the Pulse
// cycle budget over the backtest (7,500 cycles over a 25-year life = 300 a year; the divisor is ours).
import type { HistDay, Site } from "@contracts/types";
import { BACKTEST_WINDOW, clearlaneCyclesPerYr } from "./backtest";

export interface WearOpts {
  lo?: number; // $/MWh
  hi?: number;
  tol?: number; // must be 0.01: W is searched in whole cents
  scan_step?: number;
  window?: { start_mt: string; end_mt: string };
}

export interface WearCalibration {
  wear_usd_mwh: number;
  cycles_per_yr: number; // clearlane at the result
  cycles_at_10: number; // clearlane at the research start, W = 10
  budget: number;
  monotone: boolean; // cycles never rise along the scan
  feasible: boolean; // false when even `hi` uses more than the budget; the result is then `hi`
  evaluations: number;
}

export function calibrateWear(
  hist: HistDay[],
  site: Site,
  o: WearOpts = {},
): WearCalibration {
  const lo = Math.round((o.lo ?? 0) * 100);
  const hi = Math.round((o.hi ?? 60) * 100);
  const step = Math.round((o.scan_step ?? 0.5) * 100);
  if ((o.tol ?? 0.01) !== 0.01) throw new Error("tol must be 0.01");
  const budget = site.station.pulse_cycles_per_yr_budget;
  const memo = new Map<number, number>();
  const cycles = (cents: number) => {
    if (!memo.has(cents))
      memo.set(
        cents,
        clearlaneCyclesPerYr(
          hist,
          site,
          cents / 100,
          o.window ?? BACKTEST_WINDOW,
        ),
      );
    return memo.get(cents)!;
  };
  const ok = (cents: number) => cycles(cents) <= budget;

  const at10 = cycles(1000);
  const scan: number[] = [];
  for (let c = lo; c < hi; c += step) scan.push(c);
  scan.push(hi);
  const monotone = scan.every(
    (c, i) => i === 0 || cycles(c) <= cycles(scan[i - 1]!) + 1e-9,
  );
  const k = scan.findIndex(ok);
  const done = (cents: number, feasible: boolean): WearCalibration => ({
    wear_usd_mwh: cents / 100,
    cycles_per_yr: cycles(cents),
    cycles_at_10: at10,
    budget,
    monotone,
    feasible,
    evaluations: memo.size,
  });
  if (k === -1) return done(hi, false);
  if (k === 0) return done(scan[0]!, true);
  // bisect inside the first feasible scan step: `a` over budget, `b` within it
  let a = scan[k - 1]!;
  let b = scan[k]!;
  while (b - a > 1) {
    const m = Math.floor((a + b) / 2);
    if (ok(m)) b = m;
    else a = m;
  }
  return done(b, true);
}
