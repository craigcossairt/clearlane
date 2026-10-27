import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Bundle } from "@contracts/types";

const bundle = JSON.parse(
  readFileSync(
    new URL("../contracts/fixtures/bundle_2026-10-27.json", import.meta.url),
    "utf-8",
  ),
) as Bundle;

describe("contracts fixture, Oct 27", () => {
  it("has 24 hours from 06:00Z", () => {
    expect(bundle.hours).toHaveLength(24);
    expect(bundle.hours[0]!.ts_utc).toBe("2026-10-27T06:00:00Z");
  });

  // CAISO OPR_DT 2026-10-26 HE 24, ELAP_PACE-APND: LMP 30.21857, MCC -0.71
  // (research/analysis/option2/oct/20260930_20261028_PRC_LMP_DAM_20261026_20_37_47_v12.csv)
  it("hour 0 price is the real Oct 27 row, not Oct 28's midnight", () => {
    const h0 = bundle.hours[0]!;
    expect(h0.lmp_usd_mwh).toBe(30.21857);
    expect(h0.mcc_usd_mwh).toBe(-0.71);
    expect(h0.prov.lmp).toBe("REAL");
  });

  it("hour 0 fields with no REAL source are ASSUMPTION", () => {
    const p = bundle.hours[0]!.prov;
    expect([p.load, p.solar, p.wind]).toEqual([
      "ASSUMPTION",
      "ASSUMPTION",
      "ASSUMPTION",
    ]);
    expect(bundle.hours[1]!.prov.load).toBe("REAL");
  });

  // #120: prices are raw OASIS DAM values as published, not the cent-rounded snapshot.
  it("prices are unrounded raw DAM values, and the notes name the file", () => {
    const cents = (x: number) => Math.round(x * 100) / 100 === x;
    expect(bundle.hours.filter((h) => !cents(h.lmp_usd_mwh)).length).toBeGreaterThan(12);
    expect(bundle.notes.join(" ")).toContain(
      "20260930_20261028_PRC_LMP_DAM_20261026_20_37_47_v12.csv",
    );
  });
});
