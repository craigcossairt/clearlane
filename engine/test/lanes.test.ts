import { describe, expect, it } from "vitest";
import { intervalStartsUtc, validateBundle } from "@engine/bundle";
import { laneThresholds, lanes, systemCriticalHours } from "@engine/lanes";
import * as api from "@engine/index";
import { loadFixture, redated } from "./helpers/fixture";

const b = loadFixture();
const hoursWhere = (ls: string[], lane: string) =>
  ls.flatMap((l, h) => (l === lane ? [h] : []));
const range = (a: number, z: number) =>
  Array.from({ length: z - a + 1 }, (_, i) => a + i);

describe("bundle", () => {
  it("builds 96 interval starts from ts_utc", () => {
    const ts = intervalStartsUtc(b);
    expect(ts).toHaveLength(96);
    expect(ts[0]).toBe("2026-10-27T06:00:00Z");
    expect(ts[1]).toBe("2026-10-27T06:15:00Z");
    expect(ts[74]).toBe("2026-10-28T00:30:00Z");
    expect(ts[95]).toBe("2026-10-28T05:45:00Z");
  });

  it("accepts the fixture and rejects bad bundles", () => {
    expect(validateBundle(b)).toEqual([]);
    expect(
      validateBundle({ ...b, hours: b.hours.slice(1) }).length,
    ).toBeGreaterThan(0);
    const gap = b.hours.map((h, i) =>
      i === 5 ? { ...h, ts_utc: "2026-10-27T12:00:00Z" } : h,
    );
    expect(validateBundle({ ...b, hours: gap }).join(" ")).toMatch(
      /consecutive/,
    );
    const nan = b.hours.map((h, i) =>
      i === 3 ? { ...h, lmp_usd_mwh: Number.NaN } : h,
    );
    expect(validateBundle({ ...b, hours: nan }).join(" ")).toMatch(/finite/);
  });
});

describe("lanes on the Oct 27 fixture", () => {
  it("pins the thresholds to the cent", () => {
    const t = laneThresholds(b.hours.map((h) => h.lmp_usd_mwh));
    expect(t.clear_max_usd.toFixed(2)).toBe("29.98");
    expect(t.jam_min_usd.toFixed(2)).toBe("47.18");
  });

  it("pins the lanes", () => {
    const ls = lanes(b);
    expect(ls).toHaveLength(24);
    expect(hoursWhere(ls, "clear")).toEqual(range(9, 16));
    expect(hoursWhere(ls, "jam")).toEqual(range(18, 23));
    expect(hoursWhere(ls, "shoulder")).toEqual([...range(0, 8), 17]);
  });

  it("pins System Critical Hours: top 4 net load plus every jam hour", () => {
    const sch = systemCriticalHours(b, "net_load");
    expect(sch.top4).toEqual([19, 20, 21, 22]);
    expect(sch.hours).toEqual(range(18, 23));
    expect(sch.proxy).toBe(false);
  });

  it("labels the price proxy and uses the 4 highest prices", () => {
    const sch = systemCriticalHours(b, "price_proxy");
    expect(sch.proxy).toBe(true);
    expect(sch.top4).toEqual([18, 19, 20, 21]);
    expect(sch.label).toMatch(/proxy/);
  });

  it("breaks net-load ties toward the earlier hour", () => {
    const tie = {
      ...b,
      hours: b.hours.map((h) => ({ ...h, net_load_mw: 100 })),
    };
    expect(systemCriticalHours(tie, "net_load").top4).toEqual([0, 1, 2, 3]);
  });
});

describe("a second day", () => {
  it("gets lanes from its own prices and never mentions Oct 27", () => {
    const p = b.hours.map((h) => h.lmp_usd_mwh);
    const permuted = [...p.slice(12), ...p.slice(0, 12)];
    const d2 = redated(b, 1, permuted);
    expect(validateBundle(d2)).toEqual([]);
    const ls = lanes(d2);
    expect(hoursWhere(ls, "jam")).toEqual([...range(6, 11)]);
    expect(hoursWhere(ls, "clear")).toEqual([...range(0, 4), 21, 22, 23]);
    const out = JSON.stringify([
      ls,
      intervalStartsUtc(d2),
      systemCriticalHours(d2, "price_proxy"),
    ]);
    expect(out).not.toContain("2026-10-27");
  });
});

describe("public API", () => {
  it("re-exports the lane functions", () => {
    expect(typeof api.lanes).toBe("function");
    expect(typeof api.laneThresholds).toBe("function");
    expect(typeof api.systemCriticalHours).toBe("function");
  });
});

describe("review fixes", () => {
  it("rejects ts_utc without the Z suffix", () => {
    const off = b.hours.map((h, i) =>
      i === 2 ? { ...h, ts_utc: "2026-10-27T08:00:00+00:00" } : h,
    );
    expect(validateBundle({ ...b, hours: off }).join(" ")).toMatch(/Z/);
  });

  it("falls back to the labeled price proxy when net load is missing or not finite", () => {
    const gap = {
      ...b,
      hours: b.hours.map((h, i) =>
        i === 7 ? { ...h, net_load_mw: Number.NaN } : h,
      ),
    };
    const sch = systemCriticalHours(gap, "net_load");
    expect(sch.proxy).toBe(true);
    expect(sch.top4).toEqual(systemCriticalHours(b, "price_proxy").top4);
  });
});
