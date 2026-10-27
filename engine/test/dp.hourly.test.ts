import { describe, expect, it } from "vitest";
import {
  callShare,
  dpHourly,
  hourlyUnanswerable,
  rotateLeft,
  snapshotHour,
} from "@engine/hourly";
import { loadFixture } from "./helpers/fixture";
import { loadDam, snapshotPrices } from "./helpers/oasis";
import { RMP_HEATMAP_BY_HOUR } from "./helpers/torus";

const snap = snapshotPrices();
const hb = (idxs: number[]) => idxs.map(snapshotHour).sort((a, b) => a - b);
const active = (acts: number[]) =>
  hb(acts.flatMap((g, i) => (Math.abs(g) > 1e-6 ? [i] : [])));
const discharged = (acts: number[]) =>
  acts.filter((g) => g > 0).reduce((a, g) => a + g, 0);
const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;

describe("the fix.py vector", () => {
  it("is the fixture rotated left by one, apart from the borrowed hour 0", () => {
    const rot = rotateLeft(
      loadFixture().hours.map((h) => h.lmp_usd_mwh),
      1,
    );
    expect(snap).toHaveLength(24);
    expect(rot.slice(0, 23)).toEqual(snap.slice(0, 23));
    // the snapshot's last row is HB 0 of Oct 28 ($46.11); pins solve over the CSV, not the fixture (crosscheck item 1)
    expect(snap[23]).toBe(46.11);
  });
});

describe("dpHourly reproduces fix.py dp_wear", () => {
  it("W=0", () => {
    const r = dpHourly(snap, { W: 0 });
    expect(r.objective).toBeCloseTo(65.791609, 6);
    expect(r.gross).toBeCloseTo(65.791609, 6);
    expect(discharged(r.acts)).toBeCloseTo(3.846141, 6);
    expect(active(r.acts)).toEqual([0, 1, 3, 4, 5, 7, 8, 13, 14, 15, 18, 19]);
  });

  it("W=10", () => {
    const r = dpHourly(snap, { W: 10 });
    expect(r.gross).toBeCloseTo(57.537074, 6);
    expect(r.objective).toBeCloseTo(38.775411, 6);
    expect(discharged(r.acts)).toBeCloseTo(1.876166, 6);
    expect(active(r.acts)).toEqual([8, 13, 14, 15, 18, 19]);
  });

  it("W=15 gives the same plan as W=10", () => {
    expect(dpHourly(snap, { W: 15 }).acts).toEqual(
      dpHourly(snap, { W: 10 }).acts,
    );
  });

  it("reserve variant costs 3.4384%", () => {
    const g10 = dpHourly(snap, { W: 10 }).gross;
    const r = dpHourly(snap, { W: 10, soc_min: 0.1, dis_cap: 0.75 });
    expect(r.gross).toBeCloseTo(55.5587, 6);
    expect((((g10 - r.gross) / g10) * 100).toFixed(4)).toBe("3.4384");
  });
});

describe("fix.py crash rule", () => {
  const shares = (W: number) => {
    const r = dpHourly(snap, { W });
    const bad = hourlyUnanswerable(r.socs, r.acts).map(snapshotHour);
    return {
      bad: [...bad].sort((a, b) => a - b),
      n: [0, 6, 7].map((s) => callShare(bad, RMP_HEATMAP_BY_HOUR, s)),
    };
  };

  it("price only fails 15 hours: 77%, 52%, 43%", () => {
    const s = shares(0);
    expect(s.bad).toEqual([
      0, 1, 2, 3, 8, 9, 10, 11, 12, 13, 19, 20, 21, 22, 23,
    ]);
    expect(s.n).toEqual([276, 186, 156]);
    expect(s.n.map((x) => Math.round((x / 359) * 100))).toEqual([77, 52, 43]);
  });

  it("wear 10 fails HB 8-13: 40%, 18%, 14%", () => {
    const s = shares(10);
    expect(s.bad).toEqual([8, 9, 10, 11, 12, 13]);
    expect(s.n).toEqual([142, 65, 51]);
    expect(s.n.map((x) => Math.round((x / 359) * 100))).toEqual([40, 18, 14]);
  });

  it("the heatmap sums to 359", () => {
    expect(RMP_HEATMAP_BY_HOUR.reduce((a, x) => a + x, 0)).toBe(359);
  });
});

describe("multi-day means on research OASIS CSVs", () => {
  const jul = [...loadDam("research/data/oasis/dam_jul").values()];
  const oct = [...loadDam("research/data/oasis/dam_oct").values()];

  it("wear 10: July $48.52, Oct $39.71", () => {
    expect(mean(jul.map((p) => dpHourly(p, { W: 10 }).gross)).toFixed(2)).toBe(
      "48.52",
    );
    expect(mean(oct.map((p) => dpHourly(p, { W: 10 }).gross)).toFixed(2)).toBe(
      "39.71",
    );
  });

  it("price only: July $51.74, Oct $48.68", () => {
    expect(
      mean(jul.map((p) => dpHourly(p, { W: 0 }).objective)).toFixed(2),
    ).toBe("51.74");
    expect(
      mean(oct.map((p) => dpHourly(p, { W: 0 }).objective)).toFixed(2),
    ).toBe("48.68");
  });
});
