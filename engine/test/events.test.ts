import { describe, expect, it } from "vitest";
import {
  dayStartMs,
  mountainOffsetH,
  sampleCalls,
  weekdayIndex,
} from "@engine/index";
import { torusFixture } from "./helpers/torus";

const t = torusFixture();
const by_hour = t.events_2025_by_hour.value;
const by_weekday = t.events_2025_by_weekday.value;
const base = { seed: 42, by_hour, by_weekday, requested_kw: 250 };

function days(n: number, from = "2026-05-01"): string[] {
  const start = Date.parse(`${from}T12:00:00Z`);
  return Array.from({ length: n }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10),
  );
}
const mtHour = (iso: string) => (new Date(iso).getUTCHours() + 24 - 6) % 24;

describe("fixture", () => {
  it("heatmap arrays sum to 359", () => {
    expect(by_hour.reduce((a, x) => a + x, 0)).toBe(359);
    expect(by_weekday.reduce((a, x) => a + x, 0)).toBe(359);
  });
});

describe("calendar helpers", () => {
  it("Mountain days start at 06:00Z under MDT and 07:00Z under MST", () => {
    expect(mountainOffsetH("2026-10-27")).toBe(6);
    expect(mountainOffsetH("2026-11-02")).toBe(7);
    expect(new Date(dayStartMs("2026-10-27")).toISOString()).toBe(
      "2026-10-27T06:00:00.000Z",
    );
    expect(weekdayIndex("2026-10-27")).toBe(1); // Tuesday
  });
});

describe("sampleCalls", () => {
  const d = days(180);

  it("same seed, same events; SIMULATED with the requested kW", () => {
    const a = sampleCalls(d, { ...base, reading: "mt" });
    expect(sampleCalls(d, { ...base, reading: "mt" })).toEqual(a);
    expect(a.length).toBeGreaterThan(100);
    for (const e of a) {
      expect(e.prov).toBe("SIMULATED");
      expect(e.requested_kw).toBe(250);
      expect(e.duration_s).toBe(330);
    }
    const ms = a.map((e) => Date.parse(e.start_utc));
    expect(ms).toEqual([...ms].sort((x, y) => x - y));
  });

  it("mt and utc readings give different hours from the same seed", () => {
    const mt = sampleCalls(d, { ...base, reading: "mt" }).map((e) =>
      mtHour(e.start_utc),
    );
    const utc = sampleCalls(d, { ...base, reading: "utc" }).map((e) =>
      mtHour(e.start_utc),
    );
    expect(mt).not.toEqual(utc);
  });

  it("matches the weights over 100,000 days", () => {
    const big = days(100_000, "2000-01-01").filter(
      (x) => mountainOffsetH(x) === 6,
    );
    for (const reading of ["mt", "utc"] as const) {
      const ev = sampleCalls(big, { ...base, reading });
      expect(Math.abs(ev.length / big.length / (359 / 365) - 1)).toBeLessThan(
        0.01,
      );
      const counts = Array<number>(24).fill(0);
      for (const e of ev) counts[mtHour(e.start_utc)]!++;
      counts.forEach((c, h) => {
        const want = by_hour[reading === "mt" ? h : (h + 6) % 24]! / 359;
        expect(Math.abs(c / ev.length - want)).toBeLessThan(0.01);
      });
    }
  });
});
