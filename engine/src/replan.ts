// After a call: the rest of the day re-solved from the actual state, timed.
import type {
  Bundle,
  CrashEvent,
  CrashResult,
  Plan,
  Site,
} from "@contracts/types";
import { INTERVAL_S, INTERVALS, prices } from "./bundle";
import { simulateCall } from "./crash";
import type { CallResult } from "./crash";
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
import { startSocKwh } from "./policies";

export interface ReplanState {
  start_index: number; // first re-planned interval
  executed: Schedule; // intervals before start_index as executed (later entries ignored)
  pulse_soc_kwh: number; // actual Pulse SoC at the start boundary
  spin_soc_start_kwh: number[]; // 96, Spin SoC at each interval start
  spin_refill_kw: number[]; // 96, mean Spin refill power per interval (other load)
}

export interface Replan {
  plan: Plan;
  terminal_deficit_kwh: number; // 0 unless the original start level was out of reach
}

const hasSpin = (plan: Plan) => plan.policy === "clearlane";

// Re-solve intervals start_index..95 for the plan's policy from the given state.
export function replanFrom(
  plan: Plan,
  site: Site,
  b: Bundle,
  s: ReplanState,
  schMode: SchMode = "net_load",
): Replan {
  const r = s.start_index;
  const dz = pulseDz(site);
  const e = eta(site);
  const sched: Schedule = {
    pulse_kw: s.executed.pulse_kw.slice(0, r),
    pulse_soc_kwh: s.executed.pulse_soc_kwh.slice(0, r),
    spin_kw: s.executed.spin_kw.slice(0, r),
    spin_soc_kwh: s.executed.spin_soc_kwh.slice(0, r),
    spin_start_kwh: s.executed.spin_start_kwh,
  };
  const spinFull = hasSpin(plan) ? site.station.spin_kwh : 0;
  const spinEnd = (t: number) =>
    t + 1 < INTERVALS ? s.spin_soc_start_kwh[t + 1]! : spinFull;
  const t0 = performance.now();
  let deficit = 0;
  if (r < INTERVALS) {
    if (plan.policy === "fixed_overnight") {
      // the baseline keeps its day-ahead schedule, trimmed so Pulse never goes below empty
      let soc = s.pulse_soc_kwh;
      for (let t = r; t < INTERVALS; t++) {
        let kw = plan.intervals[t]!.pulse_kw;
        const stored =
          kw >= 0
            ? ((kw * INTERVAL_S) / 3600) * e
            : (kw * INTERVAL_S) / 3600 / e;
        if (soc + stored < 0) kw = (-soc * e * 3600) / INTERVAL_S;
        soc = Math.max(0, soc + stored);
        sched.pulse_kw.push(kw);
        sched.pulse_soc_kwh.push(soc);
      }
      deficit = Math.max(0, startSocKwh(site, plan.policy) - soc);
    } else {
      const clear = plan.policy === "clearlane";
      const limits = stepLimits(site, {
        ceiling: clear,
        sch: clear ? schFlags(b, schMode) : null,
        spin_avail_kw: s.spin_soc_start_kwh.map((kwh) =>
          spinAvailKw(site, kwh),
        ),
        other_load_kw: s.spin_refill_kw,
      });
      const slice = {
        charge_kw: limits.charge_kw.slice(r),
        discharge_kw: limits.discharge_kw.slice(r),
        sch_cap_kw: limits.sch_cap_kw.slice(r),
      };
      const startLevel = Math.floor(s.pulse_soc_kwh / dz + 1e-9);
      const p = hold4(prices(b)).slice(r);
      let res = solveSiteDP(p, site, {
        W: plan.wear_usd_mwh,
        limits: slice,
        start_level: startLevel,
        end_level: DP_FLOOR_LEVEL,
      });
      for (let end = DP_FLOOR_LEVEL - 1; !res.feasible && end >= 0; end--) {
        res = solveSiteDP(p, site, {
          W: plan.wear_usd_mwh,
          limits: slice,
          start_level: startLevel,
          end_level: end,
        });
        deficit = (DP_FLOOR_LEVEL - end) * dz;
      }
      const stepH = INTERVAL_S / 3600;
      res.acts.forEach((g) => sched.pulse_kw.push(-g / stepH));
      res.socs.slice(1).forEach((x) => sched.pulse_soc_kwh.push(x));
    }
    for (let t = r; t < INTERVALS; t++) {
      sched.spin_kw.push(s.spin_refill_kw[t]!);
      sched.spin_soc_kwh.push(spinEnd(t));
    }
  } else {
    // the calls ran to the end of the day: nothing left to re-plan, so report what is missing
    deficit = Math.max(0, startSocKwh(site, plan.policy) - s.pulse_soc_kwh);
  }
  const solveMs = performance.now() - t0;
  return {
    plan: buildPlan(b, site, sched, {
      policy: plan.policy,
      wear_usd_mwh: plan.wear_usd_mwh,
      solve_ms: solveMs,
      sch_mode: schMode,
    }),
    terminal_deficit_kwh: deficit,
  };
}

// The executed day up to the re-plan boundary, from the call traces laid over the plan.
export function stateAfterCalls(
  plan: Plan,
  site: Site,
  calls: { event: CrashEvent; result: CallResult }[],
): ReplanState {
  const e = eta(site);
  const dayStart = Date.parse(plan.intervals[0]!.ts_utc);
  const spinFull = hasSpin(plan) ? site.station.spin_kwh : 0;
  // per-second overlay: later calls override earlier ones from their start
  const pulseAt = new Map<number, number>();
  const spinKwAt = new Map<number, number>();
  const spinSocAt = new Map<number, number>();
  let lastEnd = 0;
  let traceEnd = 0;
  for (const { event, result } of calls) {
    const s0 = (Date.parse(event.start_utc) - dayStart) / 1000;
    for (const k of [...spinSocAt.keys()]) {
      if (k >= s0) {
        pulseAt.delete(k);
        spinKwAt.delete(k);
        spinSocAt.delete(k);
      }
    }
    for (const p of result.trace) {
      pulseAt.set(s0 + p.t_s, p.pulse_kw);
      spinKwAt.set(s0 + p.t_s, p.spin_kw);
      spinSocAt.set(s0 + p.t_s, p.spin_soc_kwh);
    }
    lastEnd = s0 + event.duration_s;
    traceEnd = s0 + result.trace.length;
  }
  const r = Math.min(INTERVALS, Math.ceil(lastEnd / INTERVAL_S));
  const spinSocBefore = (sec: number) => {
    // Spin SoC at the start of second `sec`
    if (spinSocAt.has(sec - 1)) return spinSocAt.get(sec - 1)!;
    return spinFull; // before the first call or after Spin is full again
  };
  const executed: Schedule = {
    pulse_kw: [],
    pulse_soc_kwh: [],
    spin_kw: [],
    spin_soc_kwh: [],
    spin_start_kwh: spinFull,
  };
  const spin_soc_start_kwh: number[] = [];
  const spin_refill_kw: number[] = [];
  let drawn = 0; // extra stored Pulse kWh drawn by calls so far
  for (let t = 0; t < INTERVALS; t++) {
    const iv = plan.intervals[t]!;
    let pulseSum = 0;
    let spinSum = 0;
    let refillSum = 0;
    let touched = false;
    for (let k = 0; k < INTERVAL_S; k++) {
      const sec = t * INTERVAL_S + k;
      const traced = pulseAt.has(sec);
      touched ||= traced;
      const pk = traced ? pulseAt.get(sec)! : iv.pulse_kw;
      pulseSum += pk;
      drawn += (iv.pulse_kw - pk) / e / 3600;
      const sk = spinKwAt.get(sec) ?? 0;
      spinSum += sk;
      if (sk > 0) refillSum += sk;
    }
    spin_soc_start_kwh.push(spinSocBefore(t * INTERVAL_S));
    spin_refill_kw.push(
      t * INTERVAL_S >= traceEnd ? 0 : refillSum / INTERVAL_S,
    );
    // untouched intervals are copied exactly, so the morning stays byte-identical
    executed.pulse_kw.push(touched ? pulseSum / INTERVAL_S : iv.pulse_kw);
    executed.pulse_soc_kwh.push(
      drawn === 0 ? iv.pulse_soc_kwh : iv.pulse_soc_kwh - drawn,
    );
    executed.spin_kw.push(touched ? spinSum / INTERVAL_S : iv.spin_kw);
    executed.spin_soc_kwh.push(spinSocBefore((t + 1) * INTERVAL_S));
  }
  const pulseSoc =
    r === 0 ? startSocKwh(site, plan.policy) : executed.pulse_soc_kwh[r - 1]!;
  return {
    start_index: r,
    executed,
    pulse_soc_kwh: pulseSoc,
    spin_soc_start_kwh,
    spin_refill_kw,
  };
}

export type CrashOutcome = CrashResult & {
  terminal_deficit_kwh: number;
  replan_start_index: number; // intervals before it are as executed
};

// The UI's entry point for beats 3 and 4. For the second press, pass the first result as `prior`.
// Pass the price_only plan for the battery-only ghost.
export function crash(
  plan: Plan,
  site: Site,
  b: Bundle,
  event: CrashEvent,
  prior?: CrashResult,
  opts: { sch_mode?: SchMode } = {},
): CrashOutcome {
  const call = simulateCall(plan, site, event, prior);
  const calls = prior
    ? [
        { event: priorEvent(prior), result: prior },
        { event, result: call },
      ]
    : [{ event, result: call }];
  const state = stateAfterCalls(plan, site, calls);
  const rp = replanFrom(plan, site, b, state, opts.sch_mode);
  return {
    ...call,
    replan: rp.plan,
    terminal_deficit_kwh: rp.terminal_deficit_kwh,
    replan_start_index: state.start_index,
  };
}

// A prior call's event, recovered from its result (start from trace length; 330 s calls by default).
function priorEvent(r: CallResult): CrashEvent {
  const callS = r.trace.filter((p) => p.requested_kw > 0 || p.t_s === 0).length;
  const start = Date.parse(r.spin_full_again_utc) - r.trace.length * 1000;
  return {
    id: r.event_id,
    start_utc: new Date(start).toISOString().replace(".000Z", "Z"),
    duration_s: callS,
    requested_kw: Math.max(...r.trace.map((p) => p.requested_kw)),
    prov: "SIMULATED",
  };
}
