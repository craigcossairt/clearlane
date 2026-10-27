import type {
  Bundle,
  CrashEvent,
  CrashResult,
  Envelope,
  Lane,
  Plan,
  Policy,
  Site,
  TorusPublished,
} from "@contracts/types";
import { simulateCrash } from "./crash";
import { buildEnvelope } from "./envelope";
import { hoursByMt } from "./hours";
import { buildPlan, type PlanValue } from "./plan";
import { requireTorus } from "./published";

/**
 * The engine stub. It stands in for the engine's solve, crash and envelope until those exports
 * reach main, and it builds no StageNumber: every scalar on stage comes from numbers.json. Its
 * results render only as live values with the "Engine stub: not engine output" banner on.
 * Only app/src/engineClient.ts imports this module.
 */

/** Seconds after the first call starts when the stub's second press lands (inside the refill). */
export const STUB_SECOND_CALL_OFFSET_S = 360;

export function stubSolve(
  bundle: Bundle,
  site: Site,
  policy: Policy,
  value: PlanValue | null,
  critical: boolean[],
): Plan {
  const built = buildPlan(hoursByMt(bundle), site, policy, value);
  built.plan.operating_day_mt = bundle.operating_day_mt;
  built.plan.intervals = built.plan.intervals.map((row) => ({
    ...row,
    system_critical: critical[Math.floor(row.i / 4)] ?? false,
  }));
  return built.plan;
}

/** The scripted call: hour 18 of the bundle plus 40 minutes, from hours[].ts_utc. */
export function stubScriptedCall(
  bundle: Bundle,
  site: Site,
  durationS: number,
): CrashEvent {
  const hour18 = hoursByMt(bundle)[18];
  if (!hour18) throw new Error("failed: the bundle has no 6pm hour");
  return {
    id: "scripted-1840",
    start_utc: new Date(Date.parse(hour18.ts_utc) + 40 * 60 * 1000)
      .toISOString()
      .replace(".000Z", "Z"),
    duration_s: durationS,
    requested_kw: site.station.enrolled_kw,
    prov: "SIMULATED",
  };
}

export function stubSecondCall(first: CrashEvent): CrashEvent {
  return {
    ...first,
    id: `${first.id}-second`,
    start_utc: new Date(
      Date.parse(first.start_utc) + STUB_SECOND_CALL_OFFSET_S * 1000,
    )
      .toISOString()
      .replace(".000Z", "Z"),
  };
}

/** One call, or (with `first`) a second call that lands while the first one's Spin refills. */
export function stubCrash(
  plan: Plan,
  site: Site,
  event: CrashEvent,
  first: CrashEvent | undefined,
  torus: TorusPublished | null,
): CrashResult {
  const t = requireTorus(torus);
  const offset = first
    ? (Date.parse(event.start_utc) - Date.parse(first.start_utc)) / 1000
    : undefined;
  return simulateCrash(plan, site, first ?? event, {
    rampS: t.ramp_s.value,
    secondAtS: offset,
  });
}

export function stubEnvelope(
  bundle: Bundle,
  lanes: Lane[],
  critical: boolean[],
  plan: Plan,
  fleetKw: number,
  site: Site,
): Envelope {
  return buildEnvelope(
    hoursByMt(bundle),
    lanes,
    critical,
    plan,
    fleetKw,
    site.station.pulse_kw,
    bundle.operating_day_mt,
  );
}
