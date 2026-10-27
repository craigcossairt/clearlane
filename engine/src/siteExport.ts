// public/derived/site_default.json: the simulated site and its DP limits, so Science can
// cross-check the engine against the same host load (crosscheck item 16).
import { DP_FLOOR_LEVEL, PULSE_LEVELS, reachLevels } from "./limits";
import { defaultSite } from "./site";

export function siteDefaultExport() {
  const site = defaultSite();
  const [up, down] = reachLevels(site);
  return {
    schema: "clearlane.site/v1",
    prov: "SIMULATED",
    source: "engine/src/site.ts",
    site,
    dp: {
      pulse_levels: PULSE_LEVELS,
      level_kwh: site.station.pulse_kwh / PULSE_LEVELS,
      start_and_end_level: DP_FLOOR_LEVEL,
      reach_levels_up: up,
      reach_levels_down: down,
      eta_one_way: site.station.rte.value ** 0.5,
    },
  };
}
