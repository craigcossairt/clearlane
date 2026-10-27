/**
 * Judge-facing strings live here so Pitch reviews one file. No em dashes, American English,
 * plain words. Numbers never appear in copy: they come from numbers.json or the engine.
 */
export const COPY = {
  title: "Clearlane",
  node: "ELAP_PACE-APND",
  dayToday: "Today",
  dayTomorrow: "Tomorrow (day-ahead)",
  dayCached: "Cached, from",
  snapshotFetched: "Snapshot, fetched",
  mt: "MT",
  stubBanner: "Engine stub: not engine output",
  chipLegend:
    "REAL: measured market data. DERIVED: computed from it. SIMULATED: our model, not a real site. TORUS PUBLISHED: from Torus's own pages. ASSUMPTION: a stated input. MEASURED: timed live on this laptop.",
  failedTitle: "This day cannot be shown",
  notComputed: "not computed",
  unavailable: "unavailable",
  failed: "failed",
  loading: "loading",

  fixedLabel: "Battery on the off-peak rule",
  clearlaneLabel: "Simulated Torus-style station on Clearlane",
  priceOnlyLabel: "Battery-only plan",
  valueToSystem: "value to RMP's system at day-ahead prices",
  co2Caveat:
    "Average-emissions estimate (EIA hourly); marginal emissions can differ.",
  mouCeiling: "MOU ceiling, not installed capacity",
  priceTaker: "Assumes the fleet does not move prices",
  schLabel: "System Critical Hours (our proposal)",
  closeLine1: "In Utah, compute should follow the sun in time, not in space.",
  closeLine2:
    "Clearlane: fill up when the road is clear, and keep Spin ready for the crash.",

  axisCaption: "hour beginning, Mountain time",
  heatmapMountain: "if Mountain time",
  heatmapUtc: "if UTC",
  heatmapNote:
    "Torus's heatmap of its published events states no time zone, so both readings are shown.",
  simulated: "Simulated.",
  emptyNotZero: "Empty, not zero.",
} as const;
