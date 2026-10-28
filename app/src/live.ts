import type { Policy } from "@contracts/types";
import type { CallState, Live } from "./beats/types";
import { stageWearUsdMwh } from "./data";
import {
  crash,
  dayLanes,
  defaultSite,
  scriptedCalls,
  solve,
  STUB_ACTIVE,
} from "./engineClient";

/*
 * The live stage day, shared by the six-beat stage (App.tsx) and presenter mode (#216). A leaf
 * module: it imports the engine seam and data, never App or a beat component.
 */

/** Solve the stage day once: the three plans, the lanes and the scripted calls. */
export function buildLive(
  bundle: Live["bundle"],
  bundleFile: string,
  torus: Live["torus"],
): Live {
  const site = defaultSite();
  const policies: Policy[] = ["fixed_overnight", "price_only", "clearlane"];
  const wear_usd_mwh = stageWearUsdMwh();
  const plans = Object.fromEntries(
    policies.map((p) => [p, solve(bundle, site, p, { wear_usd_mwh })]),
  ) as Live["plans"];
  return {
    bundle,
    bundleFile,
    day: dayLanes(bundle),
    site,
    plans,
    torus,
    calls: scriptedCalls(bundle, site),
    stub: STUB_ACTIVE,
  };
}

/** Hours from the bundle's first interval to the scripted call start (time arithmetic only). */
export function callHour(live: Live): number {
  const h0 = live.bundle.hours[0]?.ts_utc;
  if (!h0) return 0;
  return (Date.parse(live.calls.first.start_utc) - Date.parse(h0)) / 3_600_000;
}

export function runCalls(live: Live, withSecond: boolean): CallState {
  const first = crash(
    live.plans.clearlane,
    live.site,
    live.calls.first,
    live.torus,
  );
  const ghost = crash(
    live.plans.price_only,
    live.site,
    live.calls.first,
    live.torus,
  );
  const second = withSecond
    ? crash(
        live.plans.clearlane,
        live.site,
        live.calls.second,
        live.torus,
        live.calls.first,
      )
    : null;
  return { first, ghost, second };
}
