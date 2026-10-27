import type { Bundle, StageNumber } from "@contracts/types";
import { describe, expect, it } from "vitest";
import { loadStageData, type StageData } from "./data";
import { DAY_LEVEL_KEYS, dayFromNumbers, dayLabel, resolveStageDay } from "./stageDay";

const real = loadStageData();
const fixture = real.bundles["2026-10-27"]?.bundle as Bundle;

const n = (key: string, day: string): StageNumber => ({
  key,
  value: 1,
  unit: "x",
  display: "1",
  prov: "DERIVED",
  source: "test",
  as_of_mt: day,
});

const withNumbers = (numbers: StageNumber[] | null): StageData => ({
  ...real,
  bundles: { "2026-10-27": { bundle: fixture, file: "contracts/fixtures/bundle_2026-10-27.json" } },
  numbers,
});

describe("stage day", () => {
  it("uses the bundle day until numbers.json exists", () => {
    const r = resolveStageDay(withNumbers(null), "");
    expect(r.state).toBe("ready");
    if (r.state === "ready") expect(r.day).toBe("2026-10-27");
  });

  it("every day-level key in numbers.json agrees on one day (skips while the file is absent)", () => {
    if (!real.numbers) {
      console.info("skipped: public/derived/numbers.json is not on this branch yet");
      return;
    }
    expect(dayFromNumbers(real.numbers).kind).toBe("day");
  });

  it("fails, naming both files, when the bundle and numbers.json describe different days", () => {
    const r = resolveStageDay(
      withNumbers(DAY_LEVEL_KEYS.map((k) => n(k, "2026-10-28"))),
      "",
    );
    expect(r.state).toBe("failed");
    if (r.state === "failed") expect(r.reason).toContain("numbers.json");
  });

  it("fails when day-level keys disagree", () => {
    const r = resolveStageDay(
      withNumbers([n("fixed_usd_mw_day", "2026-10-27"), n("fixed_70", "2026-10-28")]),
      "",
    );
    expect(r.state).toBe("failed");
  });

  it("lets ?day= override, and fails for a day with no bundle", () => {
    expect(resolveStageDay(withNumbers(null), "?day=2026-10-27").state).toBe("ready");
    const r = resolveStageDay(withNumbers(null), "?day=2026-10-01");
    expect(r.state).toBe("failed");
  });

  it("labels the day against the America/Denver date", () => {
    // 2026-10-27 20:00 MT is 2026-10-28 02:00Z: still Oct 27 in Utah.
    const evening = new Date("2026-10-28T02:00:00Z");
    expect(dayLabel("2026-10-27", evening)).toBe("today");
    expect(dayLabel("2026-10-28", evening)).toBe("tomorrow");
    expect(dayLabel("2026-10-20", evening)).toBe("cached");
  });
});
