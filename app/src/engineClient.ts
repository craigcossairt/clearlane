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
import {
  buildEnvelope,
  crash as engineCrash,
  defaultSite as engineDefaultSite,
  scriptedCalls as engineScriptedCalls,
  solve as engineSolve,
  laneThresholds as engineLaneThresholds,
  lanes as engineLanes,
  option2Shift as engineOption2Shift,
  referenceRace,
  scaleUsdPerDay as engineScaleUsdPerDay,
  systemCriticalHours,
} from "@engine";
import type { LaneThresholds, Option2Shift } from "@engine";
import { CALL_DURATION_S } from "@engine/inputs";
import { STUB_HOST_CEILING_KW, stubHostLoadKw15m } from "./stub/site";
import {
  stubCrash,
  stubEnvelope,
  stubScriptedCall,
  stubSecondCall,
  stubSolve,
} from "./stub/stage";

/**
 * The only module that imports @engine or app/src/stub. Swapping the stub for the real engine
 * (core 10) changes this file and nothing else.
 *
 * Real engine (engine cores 4 to 12 on main): lanes, lane thresholds, System Critical Hours, the
 * default site, solve, the scripted calls, crash with its re-plan, the ghost, the envelope, fleet
 * scaling, the Option 2 shift and the heatmap rotation.
 * The stub stays as the fallback behind STUB_ACTIVE: set it to true to run solve, crash, the
 * ghost and the envelope on the labeled stub again. While the stub is active the header shows
 * "Engine stub: not engine output".
 */
export const STUB_ACTIVE: boolean = false;

/** The bundle each live plan was solved on, so crash() can re-plan without a wider signature. */
const planBundle = new WeakMap<Plan, Bundle>();

export type { LaneThresholds, Option2Shift };

export interface DayLanes {
  lanes: Lane[];
  thresholds: LaneThresholds;
  critical: boolean[];
  schLabel: string;
}

export function dayLanes(bundle: Bundle): DayLanes {
  const sch = systemCriticalHours(bundle);
  const critical = Array.from({ length: 24 }, (_, h) => sch.hours.includes(h));
  return {
    lanes: engineLanes(bundle),
    thresholds: engineLaneThresholds(bundle.hours.map((h) => h.lmp_usd_mwh)),
    critical,
    schLabel: sch.label,
  };
}

/**
 * The simulated site (SIMULATED, not a metered site): the engine's station, on the stub's host
 * load and ceiling, which the stub's fixed timetables respect.
 */
export function defaultSite(): Site {
  if (!STUB_ACTIVE) return engineDefaultSite();
  return {
    ...engineDefaultSite(),
    host_load_kw_15m: stubHostLoadKw15m(),
    host_ceiling_kw: STUB_HOST_CEILING_KW,
  };
}

export function solve(bundle: Bundle, site: Site, policy: Policy): Plan {
  if (!STUB_ACTIVE) {
    const plan = engineSolve(bundle, site, policy);
    planBundle.set(plan, bundle);
    return plan;
  }
  const race = referenceRace(bundle);
  const leg =
    policy === "fixed_overnight"
      ? race.fixed
      : policy === "clearlane"
        ? race.timetable
        : null;
  const value = leg
    ? { usdPerMwDay: leg.usd_per_mw_day, co2TPerMwDay: leg.co2_t_per_mw_day }
    : null;
  return stubSolve(bundle, site, policy, value, dayLanes(bundle).critical);
}

export interface ScriptedCalls {
  first: CrashEvent;
  second: CrashEvent;
}

/** The 6:40pm MT call and the second press inside its refill window (both SIMULATED). */
export function scriptedCalls(bundle: Bundle, site: Site): ScriptedCalls {
  if (!STUB_ACTIVE) {
    const [first, second] = engineScriptedCalls(bundle, site);
    return { first, second };
  }
  const first = stubScriptedCall(bundle, site, CALL_DURATION_S);
  return { first, second: stubSecondCall(first) };
}

/**
 * One call against a plan. Pass `first` (the first call's event) to make this the second
 * press. For the ghost, pass the price_only plan.
 */
export function crash(
  plan: Plan,
  site: Site,
  event: CrashEvent,
  torus: TorusPublished | null,
  first?: CrashEvent,
): CrashResult {
  if (!STUB_ACTIVE) {
    const bundle = planBundle.get(plan);
    if (!bundle) throw new Error("crash: plan was not solved through engineClient.solve");
    // The engine takes the first call's result as the prior; recompute it from its event.
    const prior = first ? engineCrash(plan, site, bundle, first) : undefined;
    return engineCrash(plan, site, bundle, event, prior);
  }
  return stubCrash(plan, site, event, first, torus);
}

export function envelope(
  bundle: Bundle,
  plan: Plan,
  site: Site,
  fleetKw: number,
): Envelope {
  if (!STUB_ACTIVE)
    return buildEnvelope(plan, site, bundle, {
      fleet_kw: fleetKw,
      generated_utc: bundle.fetched_utc,
    });
  const day = dayLanes(bundle);
  return stubEnvelope(bundle, day.lanes, day.critical, plan, fleetKw, site);
}

/** Beat 6 slider: linear under the price-taker assumption (engine). */
export function scaleUsdPerDay(usdPerMwDay: number, fleetMw: number): number {
  return engineScaleUsdPerDay(usdPerMwDay, fleetMw);
}

export function option2Shift(bundle: Bundle): Option2Shift {
  return engineOption2Shift(bundle);
}

/**
 * Torus's 2025 heatmap is in Mountain time (Torus, message to Craig Cossairt, Oct 27 2026), so
 * index i is Mountain hour beginning i and the counts are shown as published. The UTC readings
 * survive only as a sensitivity check in docs/FACTS.md and never reach the stage.
 */
export function heatmapMountain(byHour: number[]): number[] {
  return [...byHour];
}
