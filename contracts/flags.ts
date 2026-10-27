// contracts/flags.ts
// Stage feature flags (docs/STRETCH.md "Feature flags"). Every flag defaults to off.
// The app reads `default` through one helper; `?ff=name,name` turns flags on for rehearsal and the judge URL.
// At Train 6 Craig picks the stage set, and Integration bakes it into `v1-stage` by flipping those defaults to true.
// Only Integration edits this file. tools/contracts.test.ts checks the names against docs/STRETCH.md.

export interface FlagDef {
  default: boolean;
  lanes: readonly string[];
  description: string;
}

export const FLAGS = {
  ff_any_day: {
    default: false,
    lanes: ["ui"],
    description:
      "Pick any day: re-solve the race for any day from May 1 to Oct 27 in the browser",
  },
  ff_call_ledger: {
    default: false,
    lanes: ["engine"],
    description:
      "Call ledger: 359 calls replayed from the published counts, logged the way Lasso logs dispatches",
  },
  ff_compute_drag: {
    default: false,
    lanes: ["ui"],
    description:
      "Drag the compute block: move a simulated AI training block into the clear lane",
  },
  ff_crash_anywhere: {
    default: false,
    lanes: ["engine", "ui"],
    description: "Crash anywhere: one RMP call swept across all 96 intervals",
  },
  ff_export_2030_5: {
    default: false,
    lanes: ["data"],
    description: "IEEE 2030.5-shaped export of the hourly envelope",
  },
  ff_fleet: {
    default: false,
    lanes: ["engine"],
    description:
      "Fleet rollup: simulated Wattsmart-size sites, one DP each, summed into one validated fleet envelope",
  },
  ff_fleet_board: {
    default: false,
    lanes: ["ui"],
    description:
      "Fleet board: site tiles, the fleet envelope strip, and a fleet call landing live",
  },
  ff_fleet_call: {
    default: false,
    lanes: ["engine"],
    description:
      "Fleet call allocator: one RMP call routed across sites by spare kW, skipping sites mid-refill",
  },
  ff_freeway: {
    default: false,
    lanes: ["ui"],
    description:
      "Freeway ribbon: net load drawn as traffic, with the station as one marked vehicle",
  },
  ff_host_frontier: {
    default: false,
    lanes: ["engine"],
    description:
      "Host frontier: how much evening block a host can give RMP before its monthly peak moves",
  },
  ff_lineage: {
    default: false,
    lanes: ["ui"],
    description:
      "Number lineage: every provenance chip opens to its source, date, class and cross-check",
  },
  ff_price_impact: {
    default: false,
    lanes: ["engine"],
    description: "Price-impact correction for the 70 to 500 MW scale slider",
  },
  ff_projector: {
    default: false,
    lanes: ["ui"],
    description:
      "Every screen: projector theme, lane patterns, three resolutions, phone touch bar",
  },
  ff_proof_drawer: {
    default: false,
    lanes: ["ui"],
    description: "Proof drawer: Q&A cards for the stretch analyses",
  },
  ff_public_url: {
    default: false,
    lanes: ["integration"],
    description:
      "Judge URL: the stage build as a static site, with a QR code on the close card",
  },
  ff_rt_replay: {
    default: false,
    lanes: ["engine"],
    description: "Day-ahead vs real-time replay with hourly rolling re-plans",
  },
  ff_sensitivity: {
    default: false,
    lanes: ["engine"],
    description: "Sensitivity tornado, breakevens and per-day backtest rows",
  },
  ff_spin_refill_source: {
    default: false,
    lanes: ["engine"],
    description:
      "Spin refill source: from the grid under the host ceiling, or from Pulse",
  },
  ff_territories: {
    default: false,
    lanes: ["data"],
    description:
      "Same engine on Torus's other territories: PACW and PGE day-ahead nodes",
  },
  ff_wear_rainflow: {
    default: false,
    lanes: ["engine"],
    description:
      "Rainflow cycle counting, depth stress and full-battery dwell for Pulse",
  },
} as const satisfies Record<string, FlagDef>;

export type FlagName = keyof typeof FLAGS;
