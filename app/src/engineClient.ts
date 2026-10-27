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
  defaultSite as engineDefaultSite,
  laneThresholds as engineLaneThresholds,
  lanes as engineLanes,
  option2Shift as engineOption2Shift,
  referenceRace,
  rotateLeft,
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
 * Real engine today: lanes, lane thresholds, System Critical Hours, the reference race values a
 * stub plan carries, fleet scaling, the Option 2 shift and the heatmap rotation.
 * Stub today (STUB_ACTIVE): solve, crash, the ghost and the envelope, because those engine
 * exports are not on main yet. While the stub is active the header shows
 * "Engine stub: not engine output".
 */
export const STUB_ACTIVE = true;

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
  return {
    ...engineDefaultSite(),
    host_load_kw_15m: stubHostLoadKw15m(),
    host_ceiling_kw: STUB_HOST_CEILING_KW,
  };
}

export function solve(bundle: Bundle, site: Site, policy: Policy): Plan {
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
  return stubCrash(plan, site, event, first, torus);
}

export function envelope(
  bundle: Bundle,
  plan: Plan,
  site: Site,
  fleetKw: number,
): Envelope {
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
 * Torus's 2025 heatmap states no time zone, so both readings are shown. Index i of each result
 * is Mountain hour beginning i. Read as UTC under daylight time, chart hour h is Mountain hour
 * h - 6, so Mountain hour i reads chart hour i + 6.
 */
export function heatmapReadings(byHour: number[]): {
  mountain: number[];
  utc: number[];
} {
  return { mountain: [...byHour], utc: rotateLeft(byHour, 6) };
}
