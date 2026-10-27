import type {
  Bundle,
  CrashEvent,
  CrashResult,
  Policy,
  Provenance,
  StageNumber,
} from "@contracts/types";
import bundleJson from "@contracts/fixtures/bundle_2026-10-27.json";
import { grouped, ratio1, usdDay, usdPerMw } from "../format";
import { simulateCrash } from "./crash";
import { buildEnvelope } from "./envelope";
import { hoursByMt } from "./hours";
import { lanesFor, systemCritical } from "./lanes";
import { buildPlan } from "./plan";
import { heatmapAsMountain, published, pulseCyclesPerYear } from "./published";
import {
  campusShiftUsd,
  referenceRace,
  DISCHARGE_HOURS,
  FIXED_CHARGE_HOURS,
  TIMETABLE_CHARGE_HOURS,
} from "./reference";
import { simulatedSite } from "./site";

export const fixtureBundle = bundleJson as Bundle;

export interface StageModel {
  bundle: Bundle;
  numbers: StageNumber[];
  number: (key: string) => StageNumber;
  lanes: ReturnType<typeof lanesFor>;
  critical: boolean[];
  plans: Record<Policy, ReturnType<typeof buildPlan>["plan"]>;
  site: ReturnType<typeof simulatedSite>;
  heatmapMt: number[];
  heatmapUtc: number[];
  scriptedCall: CrashEvent;
  crash: (policy: Policy, second: boolean) => CrashResult;
  envelopeKw: (fleetKw: number) => ReturnType<typeof buildEnvelope>;
}

function num(
  key: string,
  value: number,
  unit: string,
  display: string,
  prov: Provenance,
  source: string,
  asOf: string,
): StageNumber {
  return { key, value, unit, display, prov, source, as_of_mt: asOf };
}

export function loadStageModel(): StageModel {
  const bundle = fixtureBundle;
  if (bundle.schema !== "clearlane.bundle/v1" || bundle.hours.length !== 24) {
    throw new Error("Oct 27 fixture is not a 24-hour bundle");
  }
  const hours = hoursByMt(bundle);
  const asOf = bundle.operating_day_mt;
  const lanes = lanesFor(hours);
  const critical = systemCritical(hours, lanes);
  const site = simulatedSite();
  const fixed = buildPlan(hours, site, "fixed_overnight");
  const clearlane = buildPlan(hours, site, "clearlane");
  const priceOnly = buildPlan(hours, site, "price_only");
  for (const built of [fixed, clearlane, priceOnly]) {
    built.plan.operating_day_mt = asOf;
    built.plan.intervals = built.plan.intervals.map((row) => ({
      ...row,
      system_critical: critical[Math.floor(row.i / 4)] ?? false,
    }));
  }

  const fixedRace = referenceRace(hours, FIXED_CHARGE_HOURS, DISCHARGE_HOURS);
  const clearRace = referenceRace(
    hours,
    TIMETABLE_CHARGE_HOURS,
    DISCHARGE_HOURS,
  );
  const mou = published.mouMw.value;
  const climb = (hours[18]?.net_load_mw ?? 0) - (hours[15]?.net_load_mw ?? 0);
  const ratio = (hours[18]?.lmp_usd_mwh ?? 0) / (hours[15]?.lmp_usd_mwh ?? 1);
  const priceSource = "contracts/fixtures/bundle_2026-10-27.json";
  const raceSource = "research/analysis/demo-story/habit.py";

  const numbers: StageNumber[] = [
    num(
      "net_load_climb_mw",
      climb,
      "MW",
      grouped(climb, 1),
      "DERIVED",
      priceSource,
      asOf,
    ),
    num(
      "peak_over_trough",
      ratio,
      "x",
      ratio1(ratio),
      "DERIVED",
      priceSource,
      asOf,
    ),
    num(
      "solar_4pm_mw",
      hours[16]?.solar_fcst_mw ?? 0,
      "MW",
      grouped(hours[16]?.solar_fcst_mw ?? 0, 0),
      "REAL",
      priceSource,
      asOf,
    ),
    num(
      "solar_6pm_mw",
      hours[18]?.solar_fcst_mw ?? 0,
      "MW",
      grouped(hours[18]?.solar_fcst_mw ?? 0, 0),
      "REAL",
      priceSource,
      asOf,
    ),
    num(
      "price_min",
      hours[15]?.lmp_usd_mwh ?? 0,
      "$/MWh",
      usdPerMw(hours[15]?.lmp_usd_mwh ?? 0),
      "REAL",
      priceSource,
      asOf,
    ),
    num(
      "price_peak",
      hours[18]?.lmp_usd_mwh ?? 0,
      "$/MWh",
      usdPerMw(hours[18]?.lmp_usd_mwh ?? 0),
      "REAL",
      priceSource,
      asOf,
    ),
    num(
      "fixed_usd_mw_day",
      fixedRace.usdPerMwDay,
      "$/MW-day",
      usdPerMw(fixedRace.usdPerMwDay),
      "DERIVED",
      raceSource,
      asOf,
    ),
    num(
      "clearlane_usd_mw_day",
      clearRace.usdPerMwDay,
      "$/MW-day",
      usdPerMw(clearRace.usdPerMwDay),
      "DERIVED",
      raceSource,
      asOf,
    ),
    num(
      "fixed_70",
      fixedRace.usdPerMwDay * mou,
      "$/day",
      usdDay(fixedRace.usdPerMwDay * mou),
      "DERIVED",
      raceSource,
      asOf,
    ),
    num(
      "clearlane_70",
      clearRace.usdPerMwDay * mou,
      "$/day",
      usdDay(clearRace.usdPerMwDay * mou),
      "DERIVED",
      raceSource,
      asOf,
    ),
    num(
      "co2_fixed_t_mw",
      fixedRace.co2TPerMwDay,
      "t/MW-day",
      grouped(fixedRace.co2TPerMwDay, 3),
      "DERIVED",
      raceSource,
      asOf,
    ),
    num(
      "co2_clear_t_mw",
      clearRace.co2TPerMwDay,
      "t/MW-day",
      grouped(clearRace.co2TPerMwDay, 3),
      "DERIVED",
      raceSource,
      asOf,
    ),
    num(
      "co2_added_70",
      Math.abs(fixedRace.co2TPerMwDay * mou),
      "t/day",
      grouped(Math.abs(fixedRace.co2TPerMwDay * mou), 1),
      "DERIVED",
      raceSource,
      asOf,
    ),
    num(
      "co2_avoided_70",
      clearRace.co2TPerMwDay * mou,
      "t/day",
      grouped(clearRace.co2TPerMwDay * mou, 1),
      "DERIVED",
      raceSource,
      asOf,
    ),
    num(
      "campus_usd",
      campusShiftUsd(hours),
      "$/day",
      usdDay(campusShiftUsd(hours)),
      "SIMULATED",
      "app/src/stub/reference.ts",
      asOf,
    ),
    num(
      "campus_mwh",
      75,
      "MWh",
      grouped(75, 0),
      "SIMULATED",
      "app/src/stub/reference.ts",
      asOf,
    ),
    num(
      "mou_mw",
      published.mouMw.value,
      "MW",
      grouped(published.mouMw.value, 0),
      "TORUS_PUBLISHED",
      published.mouMw.source_id,
      asOf,
    ),
    num(
      "mou_ceiling_mw",
      published.mouCeilingMw.value,
      "MW",
      grouped(published.mouCeilingMw.value, 0),
      "TORUS_PUBLISHED",
      published.mouCeilingMw.source_id,
      asOf,
    ),
    num(
      "events_2025",
      published.events2025.value,
      "events",
      grouped(published.events2025.value, 0),
      "TORUS_PUBLISHED",
      published.events2025.source_id,
      asOf,
    ),
    num(
      "ramp_s",
      published.rampS.value,
      "s",
      grouped(published.rampS.value, 0),
      "TORUS_PUBLISHED",
      published.rampS.source_id,
      asOf,
    ),
    num(
      "ramp_target_s",
      published.rampTargetS.value,
      "s",
      grouped(published.rampTargetS.value, 0),
      "TORUS_PUBLISHED",
      published.rampTargetS.source_id,
      asOf,
    ),
    num(
      "delivered_pct",
      published.deliveredPct.value,
      "%",
      grouped(published.deliveredPct.value, 0),
      "TORUS_PUBLISHED",
      published.deliveredPct.source_id,
      asOf,
    ),
    num(
      "delivered_band_lo",
      published.deliveredBand.value[0],
      "%",
      grouped(published.deliveredBand.value[0], 0),
      "TORUS_PUBLISHED",
      published.deliveredBand.source_id,
      asOf,
    ),
    num(
      "delivered_band_hi",
      published.deliveredBand.value[1],
      "%",
      grouped(published.deliveredBand.value[1], 0),
      "TORUS_PUBLISHED",
      published.deliveredBand.source_id,
      asOf,
    ),
    num(
      "cycle_budget_yr",
      pulseCyclesPerYear,
      "cycles/yr",
      grouped(pulseCyclesPerYear, 0),
      "DERIVED",
      published.pulseCycleLife.source_id,
      asOf,
    ),
    num(
      "cycle_budget_day",
      pulseCyclesPerYear / 365,
      "cycles/day",
      grouped(pulseCyclesPerYear / 365, 2),
      "DERIVED",
      published.pulseCycleLife.source_id,
      asOf,
    ),
    num(
      "cycles_today",
      1,
      "cycles",
      grouped(1, 2),
      "DERIVED",
      raceSource,
      asOf,
    ),
    num(
      "enrolled_kw",
      site.station.enrolled_kw,
      "kW",
      grouped(site.station.enrolled_kw, 0),
      "SIMULATED",
      "app/src/stub/site.ts",
      asOf,
    ),
    num(
      "solve_ms",
      clearlane.solveMs,
      "ms",
      grouped(clearlane.solveMs, 1),
      "MEASURED",
      "performance.now",
      asOf,
    ),
  ];

  const byKey = new Map(numbers.map((row) => [row.key, row]));
  const number = (key: string) => {
    const found = byKey.get(key);
    if (!found) throw new Error(`missing stage number ${key}`);
    return found;
  };

  const hour18 = hours[18];
  if (!hour18) throw new Error("missing 6pm hour");
  const scriptedCall: CrashEvent = {
    id: "scripted-1840",
    start_utc: new Date(Date.parse(hour18.ts_utc) + 40 * 60 * 1000)
      .toISOString()
      .replace(".000Z", "Z"),
    duration_s: 330,
    requested_kw: site.station.enrolled_kw,
    prov: "SIMULATED",
  };

  const plans = {
    fixed_overnight: fixed.plan,
    price_only: priceOnly.plan,
    clearlane: clearlane.plan,
  };

  return {
    bundle,
    numbers,
    number,
    lanes,
    critical,
    plans,
    site,
    heatmapMt: published.heatmapByHour.value,
    heatmapUtc: heatmapAsMountain(published.heatmapByHour.value, -6),
    scriptedCall,
    crash(policy, second) {
      return simulateCrash(plans[policy], site, scriptedCall, {
        rampS: published.rampS.value,
        secondAtS: second ? scriptedCall.duration_s + 30 : undefined,
      });
    },
    envelopeKw(fleetKw) {
      return buildEnvelope(
        hours,
        lanes,
        critical,
        plans.clearlane,
        fleetKw,
        site.station.pulse_kw,
        asOf,
      );
    },
  };
}

export function scaleDay(perMw: StageNumber, mw: number): StageNumber {
  const value = perMw.value * mw;
  return {
    ...perMw,
    key: `${perMw.key}_x${mw}`,
    value,
    unit: "$/day",
    display: usdDay(value),
    prov: "DERIVED",
  };
}
