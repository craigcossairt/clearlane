import { describe, expect, it } from "vitest";
import {
  eiaHours,
  oasisLmp,
  parseCsv,
  peakDemandMw,
  whereVsWhen,
} from "@engine/research";

const OASIS_HEAD = "INTERVALSTARTTIME_GMT,NODE,LMP_TYPE,MW";
const oasis = (rows: [string, string, string, number][]) =>
  parseCsv([OASIS_HEAD, ...rows.map((r) => r.join(","))].join("\n"));
const FUELS = [
  "Coal",
  "Natural Gas",
  "Hydropower Excluding Pumped Storage",
  "Solar without Integrated Battery Storage",
  "Wind without Integrated Battery Storage",
  "Geothermal",
  "Other Fuel Sources",
].map((f) => `"Net Generation (MW) from ${f} (Adjusted)"`);
const eia = (rows: string[][]) =>
  parseCsv(
    [
      `﻿"Local Time at End of Hour","Demand (MW) (Adjusted)","Demand (MW)",${FUELS.join(",")}`,
      ...rows.map((r) => r.join(",")),
    ].join("\n"),
  );

describe("parsing", () => {
  it("strips a BOM and header quotes", () => {
    expect(parseCsv('﻿"a","b"\n1,2').head).toEqual(["a", "b"]);
  });

  it("shifts OASIS GMT starts to MDT and keeps LMP rows only", () => {
    const m = oasisLmp(
      oasis([
        ["2026-10-01T06:00:00-00:00", "A", "LMP", 10],
        ["2026-10-01T06:00:00-00:00", "A", "MCC", 99],
      ]),
    );
    expect([...m.keys()]).toEqual([Date.UTC(2026, 9, 1, 0)]);
    expect(m.get(Date.UTC(2026, 9, 1, 0))!.get("A")).toBe(10);
  });

  it("reads EIA 12am and 12pm hour ends as hour beginnings", () => {
    const h = eiaHours(
      eia([
        [
          "10/02/2026 12:00:00 AM",
          "100",
          "",
          "1",
          "1",
          "0",
          "0",
          "0",
          "0",
          "0",
        ],
        [
          "10/02/2026 12:00:00 PM",
          "",
          "200",
          "1",
          "0",
          "-5",
          "1",
          "0",
          "0",
          "0",
        ],
      ]),
    );
    expect(h.get(Date.UTC(2026, 9, 1, 23))).toEqual({ demand: 100, fossil: 1 });
    // demand falls back to the raw column; negative generation counts as 0
    expect(h.get(Date.UTC(2026, 9, 2, 11))).toEqual({
      demand: 200,
      fossil: 0.5,
    });
  });

  it("takes the largest demand across files", () => {
    const row = (d: string) => [
      "10/02/2026 1:00:00 AM",
      d,
      "",
      "1",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
    ];
    expect(peakDemandMw([eia([row("5")]), eia([row("7")])])).toBe(7);
  });
});

describe("where vs when", () => {
  it("gives a tie for cheapest node to the first node listed", () => {
    const rows: [string, string, string, number][] = [];
    for (let h = 0; h < 24; h++) {
      const t = `2026-10-02T${String(h).padStart(2, "0")}:00:00-00:00`;
      rows.push([t, "P", "LMP", 5], [t, "Q", "LMP", 5]);
    }
    const r = whereVsWhen(oasisLmp(oasis(rows)), ["P", "Q"], "P");
    expect(r.cheapest_share_pct).toEqual({ P: 100, Q: 0 });
  });
});
