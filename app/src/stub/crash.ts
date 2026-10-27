import type {
  CrashEvent,
  CrashResult,
  CrashTracePoint,
  Plan,
  Site,
} from "@contracts/types";

export interface CrashOpts {
  rampS: number;
  /** Seconds after the first call starts when a second call begins. Omit for one call. */
  secondAtS?: number;
}

function intervalAt(plan: Plan, startMs: number, tSec: number) {
  const ms = startMs + tSec * 1000;
  let found = plan.intervals[0];
  for (const row of plan.intervals) {
    if (Date.parse(row.ts_utc) <= ms) found = row;
  }
  if (!found) throw new Error("plan has no intervals");
  return found;
}

function requestedKw(
  tSec: number,
  callStart: number,
  durationS: number,
  kw: number,
  rampS: number,
): number {
  const t = tSec - callStart;
  if (t < 0 || t >= durationS) return 0;
  if (t < rampS) return (kw * t) / rampS;
  return kw;
}

export function simulateCrash(
  plan: Plan,
  site: Site,
  event: CrashEvent,
  opts: CrashOpts,
): CrashResult {
  const started = performance.now();
  const startMs = Date.parse(event.start_utc);
  const rampS = opts.rampS;
  const atCall = intervalAt(plan, startMs, 0);
  const spinHeld = atCall.spin_soc_kwh > 0;
  let spinSoc = spinHeld ? atCall.spin_soc_kwh : 0;
  let pulseSoc = atCall.pulse_soc_kwh;
  const spinCap = site.station.spin_kwh;
  const trace: CrashTracePoint[] = [];
  let requestedKwh = 0;
  let spinKwh = 0;
  let pulseKwh = 0;
  let meterPeak = 0;
  let refillStarted = false;
  let spinFullAgainS = 0;

  const horizon =
    event.duration_s +
    site.station.spin_recharge_min * 60 +
    (opts.secondAtS ?? 0) +
    120;
  for (let t = 0; t <= horizon; t += 1) {
    const row = intervalAt(plan, startMs, t);
    const asked =
      requestedKw(t, 0, event.duration_s, event.requested_kw, rampS) +
      (opts.secondAtS === undefined
        ? 0
        : requestedKw(
            t,
            opts.secondAtS,
            event.duration_s,
            event.requested_kw,
            rampS,
          ));
    requestedKwh += asked / 3600;

    const spinRoomKw = spinSoc * 3600;
    const fromSpin = Math.min(asked, site.station.spin_kw, spinRoomKw);
    spinSoc -= fromSpin / 3600;
    spinKwh += fromSpin / 3600;
    const remain = asked - fromSpin;
    const spare = Math.max(0, site.station.pulse_kw - Math.abs(row.pulse_kw));
    const fromPulse = Math.min(remain, spare, pulseSoc * 3600);
    pulseSoc -= fromPulse / 3600;
    pulseKwh += fromPulse / 3600;

    let spinKw = -fromSpin;
    if (spinHeld && asked === 0 && spinSoc < spinCap - 1e-9) {
      const room = site.host_ceiling_kw - row.meter_kw + row.spin_kw;
      const recharge = Math.min(
        site.station.spin_kw,
        Math.max(0, room),
        (spinCap - spinSoc) * 3600,
      );
      spinSoc += recharge / 3600;
      spinKw = recharge;
      if (!refillStarted) refillStarted = true;
    }
    if (spinSoc >= spinCap - 1e-6 && refillStarted && spinFullAgainS === 0)
      spinFullAgainS = t;

    const meter = row.meter_kw - row.spin_kw + spinKw - fromPulse;
    if (refillStarted && spinFullAgainS === 0)
      meterPeak = Math.max(meterPeak, meter);
    trace.push({
      t_s: t,
      requested_kw: asked,
      spin_kw: spinKw,
      pulse_kw: row.pulse_kw - fromPulse,
      spin_soc_kwh: spinSoc,
      meter_kw: meter,
    });
    if (spinFullAgainS > 0 && t > spinFullAgainS + 5 && asked === 0) break;
    if (
      !refillStarted &&
      t > event.duration_s + (opts.secondAtS ?? 0) + event.duration_s &&
      spinSoc >= spinCap - 1e-6
    ) {
      break;
    }
  }

  const shortfall = Math.max(0, requestedKwh - spinKwh - pulseKwh);
  const solveMs = performance.now() - started;
  const replan: Plan = {
    ...plan,
    solve_ms: solveMs,
    intervals: plan.intervals.map((row) => ({
      ...row,
      pulse_soc_kwh: Math.min(row.pulse_soc_kwh, pulseSoc),
    })),
  };
  return {
    event_id: event.id,
    policy: plan.policy,
    delivered_pct:
      requestedKwh === 0 ? 0 : ((spinKwh + pulseKwh) / requestedKwh) * 100,
    ramp_s: rampS,
    spin_kwh: spinKwh,
    pulse_kwh: pulseKwh,
    shortfall_kwh: shortfall,
    spin_full_again_utc: new Date(
      startMs + Math.max(spinFullAgainS, event.duration_s) * 1000,
    )
      .toISOString()
      .replace(".000Z", "Z"),
    meter_peak_during_refill_kw: meterPeak,
    trace,
    replan,
  };
}
