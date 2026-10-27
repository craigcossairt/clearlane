// An RMP call at 1-second resolution. Spin serves first; Pulse covers any remainder from spare
// power; after the call Spin refills under the host ceiling. All calls are SIMULATED.
import type {
  Bundle,
  CrashEvent,
  CrashResult,
  CrashTracePoint,
  Plan,
  Site,
} from "@contracts/types";
import { INTERVAL_S, INTERVALS, addSeconds } from "./bundle";
import { CALL_DURATION_S, RAMP_S } from "./inputs";
import { eta } from "./limits";
import { startSocKwh } from "./policies";

export const SECOND_CALL_OFFSET_S = 180; // second press, inside Spin's refill window (SIMULATED)
const FIRST_CALL_OFFSET_S = 18 * 3600 + 40 * 60; // 6:40pm MT from the day's first ts_utc

export function scriptedCalls(b: Bundle, site: Site): [CrashEvent, CrashEvent] {
  const start = addSeconds(b.hours[0]!.ts_utc, FIRST_CALL_OFFSET_S);
  const first: CrashEvent = {
    id: `${b.operating_day_mt}-call-1`,
    start_utc: start,
    duration_s: CALL_DURATION_S,
    requested_kw: site.station.enrolled_kw,
    prov: "SIMULATED",
  };
  const second: CrashEvent = {
    ...first,
    id: `${b.operating_day_mt}-call-2`,
    start_utc: addSeconds(start, CALL_DURATION_S + SECOND_CALL_OFFSET_S),
  };
  return [first, second];
}

export type CallResult = Omit<CrashResult, "replan">;

const hasSpin = (plan: Plan) => plan.policy === "clearlane";

// Planned Pulse SoC at `sec` seconds after the day's first interval start, linear inside an interval.
function plannedSocAt(plan: Plan, site: Site, sec: number): number {
  const i = Math.min(INTERVALS - 1, Math.floor(sec / INTERVAL_S));
  const before =
    i === 0
      ? startSocKwh(site, plan.policy)
      : plan.intervals[i - 1]!.pulse_soc_kwh;
  const after = plan.intervals[i]!.pulse_soc_kwh;
  return before + ((after - before) * (sec - i * INTERVAL_S)) / INTERVAL_S;
}

// Extra stored Pulse energy a prior call drew (kWh), and Spin SoC from its trace at `atS` after its start.
function priorState(
  prior: CallResult | undefined,
  site: Site,
  offsetS: number,
) {
  if (!prior) return { spin: site.station.spin_kwh, pulseDrawnKwh: 0 };
  const pt = prior.trace.find((p) => p.t_s === offsetS);
  return {
    spin: pt ? pt.spin_soc_kwh : site.station.spin_kwh,
    pulseDrawnKwh: prior.pulse_kwh / eta(site),
  };
}

export function simulateCall(
  plan: Plan,
  site: Site,
  event: CrashEvent,
  prior?: CallResult,
): CallResult {
  const st = site.station;
  const e = eta(site);
  const exp = site.export_limit_kw.value;
  const dayStart = Date.parse(plan.intervals[0]!.ts_utc);
  const s0 = (Date.parse(event.start_utc) - dayStart) / 1000;
  const spinCap = hasSpin(plan) ? st.spin_kwh : 0;
  const ps = priorState(prior, site, prior ? (Date.parse(event.start_utc) - Date.parse(startOf(prior))) / 1000 : 0);
  let spinSoc = hasSpin(plan) ? Math.min(spinCap, ps.spin) : 0;
  let pulseSoc = plannedSocAt(plan, site, s0) - ps.pulseDrawnKwh;
  let servedKwh = 0;
  let targetKwh = 0;
  let spinKwh = 0;
  let pulseKwh = 0;
  let refillPeak = -Infinity;
  const trace: CrashTracePoint[] = [];
  const end = INTERVALS * INTERVAL_S - s0;
  let t = 0;
  for (; t < end; t++) {
    const inCall = t < event.duration_s;
    if (!inCall && spinSoc >= spinCap - 1e-9) break;
    const i = Math.floor((s0 + t) / INTERVAL_S);
    const iv = plan.intervals[i]!;
    const host = site.host_load_kw_15m[i]!;
    const planned = iv.pulse_kw;
    const plannedDelta =
      (iv.pulse_soc_kwh -
        (i === 0
          ? startSocKwh(site, plan.policy)
          : plan.intervals[i - 1]!.pulse_soc_kwh)) /
      INTERVAL_S;
    pulseSoc += plannedDelta;
    let target = 0;
    let spinKw = 0;
    let pulseCall = 0;
    if (inCall) {
      target = event.requested_kw * Math.min(1, t / RAMP_S);
      let spinServe = Math.min(target, st.spin_kw, spinSoc * 3600);
      let pulseServe = Math.min(
        target - spinServe,
        st.pulse_kw - Math.abs(planned),
        Math.max(0, pulseSoc) * e * 3600,
      );
      pulseServe = Math.max(0, pulseServe);
      // keep the meter at or above minus the export limit: trim Pulse first, then Spin
      const room = host + planned + exp;
      const over = spinServe + pulseServe - room;
      if (over > 0) {
        const cut = Math.min(over, pulseServe);
        pulseServe -= cut;
        spinServe = Math.max(0, spinServe - (over - cut));
      }
      spinSoc -= spinServe / 3600;
      pulseSoc -= pulseServe / e / 3600;
      spinKw = -spinServe;
      pulseCall = pulseServe;
      targetKwh += target / 3600;
      servedKwh += (spinServe + pulseServe) / 3600;
      spinKwh += spinServe / 3600;
      pulseKwh += pulseServe / 3600;
    } else {
      // refill under the host ceiling, never below 0
      const room = site.host_ceiling_kw - host - Math.max(0, planned);
      const refill = Math.max(
        0,
        Math.min(st.spin_kw, room, (spinCap - spinSoc) * 3600),
      );
      spinSoc += refill / 3600;
      spinKw = refill;
      refillPeak = Math.max(refillPeak, host + planned + refill);
    }
    const pulseKw = planned - pulseCall;
    trace.push({
      t_s: t,
      requested_kw: target,
      spin_kw: spinKw,
      pulse_kw: pulseKw,
      spin_soc_kwh: spinSoc,
      meter_kw: host + pulseKw + spinKw,
    });
  }
  return {
    event_id: event.id,
    policy: plan.policy,
    delivered_pct: targetKwh > 0 ? (servedKwh / targetKwh) * 100 : 100,
    ramp_s: RAMP_S,
    spin_kwh: spinKwh,
    pulse_kwh: pulseKwh,
    shortfall_kwh: targetKwh - servedKwh,
    spin_full_again_utc: addSeconds(event.start_utc, t),
    meter_peak_during_refill_kw:
      refillPeak === -Infinity
        ? (trace[trace.length - 1]?.meter_kw ?? 0)
        : refillPeak,
    trace,
  };
}

// A call's start time, recovered from its trace length and end.
function startOf(r: CallResult): string {
  return addSeconds(r.spin_full_again_utc, -r.trace.length);
}
