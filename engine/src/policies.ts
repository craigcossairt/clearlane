// The three policies on a site, solved live. solve_ms is measured, never typed.
import type { Bundle, Plan, Policy, Site } from "@contracts/types";
import { INTERVAL_S, INTERVALS, prices } from "./bundle";
import type { SchMode } from "./lanes";
import {
  DP_FLOOR_LEVEL,
  eta,
  hold4,
  pulseDz,
  solveSiteDP,
  spinAvailKw,
  stepLimits,
} from "./limits";
import { buildPlan, schFlags } from "./plan";
import type { Schedule } from "./plan";

const STEP_H = INTERVAL_S / 3600;
export const DEFAULT_WEAR_USD_MWH = 10; // research start (ASSUMPTION) until the calibrated value lands

export interface SolveOpts {
  wear_usd_mwh?: number;
  sch_mode?: SchMode;
}

export const POLICY_LABEL: Record<Policy, string> = {
  fixed_overnight: "Battery on the off-peak rule",
  price_only: "Battery-only plan",
  clearlane: "Simulated Torus-style station on Clearlane",
};

const zeros = () => Array<number>(INTERVALS).fill(0);

// Our baseline, never Torus practice: from empty, charge evenly over HB 1-4 to full, discharge
// evenly over HB 18-19 to empty. No DP and no Spin.
export function fixedOvernightSchedule(site: Site): Schedule {
  const E = site.station.pulse_kwh;
  const e = eta(site);
  const chg = Array.from({ length: 16 }, (_, k) => 4 + k);
  const dis = Array.from({ length: 8 }, (_, k) => 72 + k);
  const pulse = zeros();
  const soc = zeros();
  const inPerStep = E / chg.length;
  const outPerStep = E / dis.length;
  for (const t of chg) pulse[t] = inPerStep / e / STEP_H;
  for (const t of dis) pulse[t] = (-outPerStep * e) / STEP_H;
  let s = 0;
  for (let t = 0; t < INTERVALS; t++) {
    if (chg.includes(t)) s = inPerStep * (t - 3);
    else if (dis.includes(t)) s = E - outPerStep * (t - 71);
    soc[t] = s;
  }
  return {
    pulse_kw: pulse,
    pulse_soc_kwh: soc,
    spin_kw: zeros(),
    spin_soc_kwh: zeros(),
    spin_start_kwh: 0,
  };
}

export function dpSchedule(
  b: Bundle,
  site: Site,
  policy: "price_only" | "clearlane",
  W: number,
  schMode: SchMode = "net_load",
): Schedule {
  const clear = policy === "clearlane";
  const spinSoc = clear ? site.station.spin_kwh : 0;
  const limits = stepLimits(site, {
    ceiling: clear,
    sch: clear ? schFlags(b, schMode) : null,
    spin_avail_kw: Array<number>(INTERVALS).fill(spinAvailKw(site, spinSoc)),
    other_load_kw: zeros(),
  });
  const r = solveSiteDP(hold4(prices(b)), site, { W, limits });
  return {
    pulse_kw: r.acts.map((g) => -g / STEP_H),
    pulse_soc_kwh: r.socs.slice(1),
    spin_kw: zeros(),
    spin_soc_kwh: Array<number>(INTERVALS).fill(spinSoc),
    spin_start_kwh: spinSoc,
  };
}

export function solve(
  b: Bundle,
  site: Site,
  policy: Policy,
  opts: SolveOpts = {},
): Plan {
  const t0 = performance.now();
  const W =
    policy === "clearlane" ? (opts.wear_usd_mwh ?? DEFAULT_WEAR_USD_MWH) : 0;
  const s =
    policy === "fixed_overnight"
      ? fixedOvernightSchedule(site)
      : dpSchedule(b, site, policy, W, opts.sch_mode);
  const solveMs = performance.now() - t0;
  return buildPlan(b, site, s, {
    policy,
    wear_usd_mwh: W,
    solve_ms: solveMs,
    sch_mode: opts.sch_mode,
  });
}

// Start SoC of a policy's plan, for terminal checks.
export const startSocKwh = (site: Site, policy: Policy) =>
  policy === "fixed_overnight"
    ? 0
    : DP_FLOOR_LEVEL * pulseDz(site);
