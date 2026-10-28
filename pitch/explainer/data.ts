// Scene data for the explainer video, taken from the engine and the committed files only.
// Run: npx tsx pitch/explainer/data.ts <out.json>
// Every number a scene draws comes from here or from public/derived/numbers.json. The race
// arithmetic (MWh bought and sold, buy and sell subtotals) is the engine's reference race, the
// same leg values the presenter race screen prints: 1 MW / 2 MWh, RTE 0.88 (FACTS ref_station).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Bundle, Envelope } from "../../contracts/types";
import {
  crash,
  dayStartMs,
  defaultSite,
  lanes,
  laneThresholds,
  referenceRace,
  scriptedCalls,
  solve,
  systemCriticalHours,
} from "../../engine/src/index";
import { num, usd } from "../../engine/src/format";
import { REF_E_MWH, REF_RTE } from "../../engine/src/reference";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = <T>(rel: string): T =>
  JSON.parse(readFileSync(join(root, rel), "utf8")) as T;

interface NumberRow {
  key: string;
  display: string;
  prov: string;
  value: number;
  as_of_mt?: string;
}

export function buildSceneData() {
  const numbers = readJson<NumberRow[]>("public/derived/numbers.json");
  const day = numbers.find((r) => r.key === "clearlane_usd_mw_day")?.as_of_mt;
  if (!day)
    throw new Error("numbers.json has no as_of_mt on clearlane_usd_mw_day");
  const bundle = readJson<Bundle>(`public/data/bundle_${day}.json`);
  const envelope = readJson<Envelope>(`public/derived/envelope_${day}.json`);
  const backtest = readJson<{ wear_usd_mwh: number }>(
    "public/derived/backtest.json",
  );

  const lane = lanes(bundle);
  const sch = systemCriticalHours(bundle);
  const thresholds = laneThresholds(bundle.hours.map((h) => h.lmp_usd_mwh));

  // Reference race: Cg MWh bought at the mean charge-hour price, Dg MWh sold at the mean
  // discharge-hour price (engine/src/reference.ts leg()).
  const race = referenceRace(bundle);
  const buyMwh = REF_E_MWH / REF_RTE ** 0.5;
  const sellMwh = REF_E_MWH * REF_RTE ** 0.5;
  const leg = (l: typeof race.fixed) => ({
    charge_hb: l.charge_hb,
    discharge_hb: l.discharge_hb,
    buy_usd: buyMwh * l.charge_mean_usd_mwh,
    sell_usd: sellMwh * l.discharge_mean_usd_mwh,
    keep_usd: l.usd_per_mw_day,
  });
  const fixed = leg(race.fixed);
  const clearlane = leg(race.timetable);

  // The stage's call and re-plan: the Clearlane plan at the backtest's calibrated wear, the
  // scripted 6:40pm call, and the rest of the day re-solved from the state it left.
  const site = defaultSite();
  const plan = solve(bundle, site, "clearlane", {
    wear_usd_mwh: backtest.wear_usd_mwh,
  });
  const [first] = scriptedCalls(bundle, site);
  const outcome = crash(plan, site, bundle, first);
  const pulseKwh = site.station.pulse_kwh;
  // Call start as a Mountain clock time ("6:40pm"), from the day's Mountain midnight.
  const callMin = Math.round((Date.parse(first.start_utc) - dayStartMs(bundle.operating_day_mt)) / 60_000);
  const callH = Math.floor(callMin / 60);
  const callTime = `${callH % 12 === 0 ? 12 : callH % 12}:${String(callMin % 60).padStart(2, "0")}${callH < 12 ? "am" : "pm"}`;
  const callIndex = outcome.replan_start_index;
  const spinTrace = outcome.trace
    .filter((_, i) => i % 5 === 0)
    .map((p) => ({
      t_s: p.t_s,
      spin_kw: p.spin_kw,
      pulse_kw: p.pulse_kw,
      spin_soc: p.spin_soc_kwh / site.station.spin_kwh,
      meter_kw: p.meter_kw,
    }));

  // Explainer-only keys: engine values the narration may name, with the provenance the
  // presenter race screen gives them. Subtotals are whole dollars so sell minus buy reads exactly.
  const engineKeys: Record<
    string,
    { display: string; prov: string; value: number }
  > = {
    call_time_mt: { display: callTime, prov: "SIMULATED", value: callMin },
    race_buy_mwh: {
      display: `${num(buyMwh, 3)} MWh`,
      prov: "ASSUMPTION",
      value: buyMwh,
    },
    race_sell_mwh: {
      display: `${num(sellMwh, 3)} MWh`,
      prov: "ASSUMPTION",
      value: sellMwh,
    },
    race_fixed_buy_usd: {
      display: usd(fixed.buy_usd, 0),
      prov: "DERIVED",
      value: fixed.buy_usd,
    },
    race_clearlane_buy_usd: {
      display: usd(clearlane.buy_usd, 0),
      prov: "DERIVED",
      value: clearlane.buy_usd,
    },
    race_sell_usd: {
      display: usd(fixed.sell_usd, 0),
      prov: "DERIVED",
      value: fixed.sell_usd,
    },
    race_fixed_net_usd: {
      display: usd(fixed.keep_usd, 0),
      prov: "DERIVED",
      value: fixed.keep_usd,
    },
    race_clearlane_net_usd: {
      display: usd(clearlane.keep_usd, 0),
      prov: "DERIVED",
      value: clearlane.keep_usd,
    },
  };

  return {
    operating_day_mt: bundle.operating_day_mt,
    node: bundle.node,
    hours: bundle.hours.map((h, i) => ({
      h: h.hour_mt,
      price: h.lmp_usd_mwh,
      lane: lane[i],
      solar_mw: h.solar_fcst_mw,
      net_load_mw: h.net_load_mw,
      sch: sch.hours.includes(h.hour_mt),
    })),
    thresholds,
    sch_hours: sch.hours,
    race: {
      buy_mwh: buyMwh,
      sell_mwh: sellMwh,
      fixed,
      clearlane,
      ratio: race.ratio,
    },
    envelope: {
      schema: envelope.schema,
      fleet_kw: envelope.fleet_kw,
      hours: envelope.hours.map((h) => ({
        system_critical: h.system_critical,
        reserve_kw: h.reserve_kw,
        max_charge_kw: h.max_charge_kw,
        max_discharge_kw: h.max_discharge_kw,
        planned_kw: h.planned_kw,
        reason: h.reason,
      })),
    },
    call: {
      start_utc: first.start_utc,
      start_min_mt: callMin,
      duration_s: first.duration_s,
      requested_kw: first.requested_kw,
      host_ceiling_kw: site.host_ceiling_kw,
      trace: spinTrace,
    },
    replan: {
      call_index: callIndex,
      morning_soc: plan.intervals.map((iv) => iv.pulse_soc_kwh / pulseKwh),
      replan_soc: outcome.replan.intervals.map(
        (iv) => iv.pulse_soc_kwh / pulseKwh,
      ),
    },
    engine_keys: engineKeys,
  };
}

export type SceneData = ReturnType<typeof buildSceneData>;

const out = process.argv[2];
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(buildSceneData(), null, 1));
  console.log(`scene data: ${out}`);
}
