import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { HistDay, TorusPublished } from "@contracts/types";
import { runBacktest, usableDay, windowDays } from "@engine/backtest";
import { mountainOffsetH } from "@engine/events";
import { stableJson } from "@engine/json";
import {
  LEDGER_READINGS,
  SHORTFALL_TOL_KWH,
  buildLedger,
  ledgerCalls,
} from "@engine/ledger";
import type { CallLedger, LedgerRow } from "@engine/ledger";
import { defaultSite } from "@engine/site";
import { repoPath } from "./helpers/fixture";
import { torusFixture } from "./helpers/torus";

const read = (p: string) => readFileSync(repoPath(p), "utf8");
const HIST = "public/data/hist_2026-05-01_2026-10-27.json";
const TORUS = "public/data/torus_published.json";
const LEDGER = "public/derived/call_ledger.json";
const hist = JSON.parse(read(HIST)) as HistDay[];
const torus = JSON.parse(read(TORUS)) as TorusPublished;
const backtest = JSON.parse(read("public/derived/backtest.json")) as {
  wear_usd_mwh: number;
  seed: number;
};
const site = defaultSite();
const byHour = torus.events_2025_by_hour.value;
const byWeekday = torus.events_2025_by_weekday.value;
const byDay = new Map(hist.map((d) => [d.operating_day_mt, d]));
const days = windowDays("2026-05-01", "2026-10-27").filter((d) =>
  usableDay(byDay.get(d)),
);
const opts = (seed: number) => ({
  seed,
  wear_usd_mwh: backtest.wear_usd_mwh,
  by_hour: byHour,
  by_weekday: byWeekday,
  sources: { hist: HIST, torus: TORUS },
});

// The heatmap label of an instant, recomputed here without the ledger's code: hour and weekday
// (Mon = 0) on the reading's clock. The whole window is MDT, so Mountain time is UTC less 6 hours.
function label(startUtc: string, reading: string): [number, number] {
  const shiftH = reading === "mt" ? 6 : 0;
  const t = new Date(Date.parse(startUtc) - shiftH * 3_600_000);
  return [t.getUTCHours(), (t.getUTCDay() + 6) % 7];
}

const tally = (xs: number[], n: number) => {
  const out = new Array<number>(n).fill(0);
  for (const x of xs) out[x]!++;
  return out;
};

const ledger = buildLedger(hist, site, opts(backtest.seed));
const rowsOf = (l: CallLedger, reading: string, policy?: string) =>
  l.rows.filter(
    (r) =>
      r.reading === reading && (policy === undefined || r.policy === policy),
  );

describe("ledgerCalls places the published counts exactly", () => {
  for (const reading of LEDGER_READINGS)
    for (const seed of [1, 2, backtest.seed])
      it(`${reading}, seed ${seed}: 359 calls, by-hour and by-weekday equal the heatmap arrays`, () => {
        const calls = ledgerCalls(days, reading, {
          seed,
          by_hour: byHour,
          by_weekday: byWeekday,
          requested_kw: site.station.enrolled_kw,
        });
        expect(calls).toHaveLength(359);
        const labels = calls.map((c) => label(c.start_utc, reading));
        expect(
          tally(
            labels.map((l) => l[0]),
            24,
          ),
        ).toEqual(byHour);
        expect(
          tally(
            labels.map((l) => l[1]),
            7,
          ),
        ).toEqual(byWeekday);
        // the stored labels agree with the recomputed ones
        expect(calls.map((c) => [c.heatmap_hour, c.heatmap_weekday])).toEqual(
          labels,
        );
        // every call starts inside a usable Mountain day of the window, in time order
        for (const c of calls) {
          expect(days).toContain(c.operating_day_mt);
          const off = mountainOffsetH(c.operating_day_mt);
          expect(off).toBe(6); // the label helper above assumes MDT
          const dayStart =
            Date.parse(`${c.operating_day_mt}T00:00:00Z`) + off * 3_600_000;
          const s = Date.parse(c.start_utc);
          expect(s).toBeGreaterThanOrEqual(dayStart);
          expect(s).toBeLessThan(dayStart + 24 * 3_600_000);
          expect(c.prov).toBe("SIMULATED");
        }
        const starts = calls.map((c) => Date.parse(c.start_utc));
        expect(starts).toEqual([...starts].sort((a, b) => a - b));
      });

  it("works on the test fixture's arrays too", () => {
    const t = torusFixture();
    const calls = ledgerCalls(days, "utc", {
      seed: 9,
      by_hour: t.events_2025_by_hour.value,
      by_weekday: t.events_2025_by_weekday.value,
      requested_kw: 250,
    });
    expect(calls).toHaveLength(t.events_2025_total.value);
  });

  it("refuses arrays whose totals differ", () => {
    expect(() =>
      ledgerCalls(days, "mt", {
        seed: 1,
        by_hour: byHour,
        by_weekday: [...byWeekday.slice(0, 6), byWeekday[6]! + 1],
        requested_kw: 250,
      }),
    ).toThrow(/totals/);
  });
});

describe("the call ledger", () => {
  it("has 359 calls per reading and one row per call and policy", () => {
    expect(ledger.schema).toBe("clearlane.call_ledger/v1");
    expect(ledger.flag).toBe("ff_call_ledger");
    expect(ledger.prov).toBe("SIMULATED");
    for (const reading of LEDGER_READINGS) {
      const rows = rowsOf(ledger, reading);
      expect(rows).toHaveLength(3 * 359);
      expect(new Set(rows.map((r) => r.call_id)).size).toBe(359);
      for (const p of ["fixed_overnight", "price_only", "clearlane"])
        expect(rowsOf(ledger, reading, p)).toHaveLength(359);
    }
  });

  it("rows carry the issue's fields with sane values", () => {
    const keys = [
      "call_id",
      "reading",
      "operating_day_mt",
      "heatmap_hour",
      "heatmap_weekday",
      "start_utc",
      "requested_kw",
      "ramp_s",
      "policy",
      "delivered_pct",
      "spin_kwh",
      "pulse_kwh",
      "shortfall_kwh",
      "refill_source",
      "prov",
    ];
    for (const r of ledger.rows) {
      expect(Object.keys(r)).toEqual(keys);
      expect(r.ramp_s).toBe(19);
      expect(r.requested_kw).toBe(site.station.enrolled_kw);
      expect(r.refill_source).toBe("grid");
      expect(r.prov).toBe("SIMULATED");
      expect(r.delivered_pct).toBeGreaterThanOrEqual(0);
      expect(r.delivered_pct).toBeLessThanOrEqual(100 + 1e-9);
      expect(r.shortfall_kwh).toBeGreaterThan(-1e-9);
      // only the station has Spin
      if (r.policy !== "clearlane") expect(r.spin_kwh).toBe(0);
    }
  });

  it("the summary is recomputed from the rows", () => {
    expect(ledger.summary).toHaveLength(2 * 3);
    for (const s of ledger.summary) {
      const rows = rowsOf(ledger, s.reading, s.policy);
      const ok = rows.filter((r: LedgerRow) => r.delivered_pct >= 90).length;
      expect(s.calls).toBe(359);
      expect(s.delivered_at_or_above_90_pct_share).toBeCloseTo(
        (100 * ok) / 359,
        12,
      );
      expect(s.unanswerable_calls).toBe(359 - ok);
      expect(s.shortfall_calls).toBe(
        rows.filter((r) => r.shortfall_kwh > SHORTFALL_TOL_KWH).length,
      );
    }
  });

  it("the station answers more calls than either baseline under both readings", () => {
    for (const reading of LEDGER_READINGS) {
      const share = (p: string) =>
        ledger.summary.find((s) => s.reading === reading && s.policy === p)!
          .delivered_at_or_above_90_pct_share;
      expect(share("clearlane")).toBeGreaterThan(share("fixed_overnight"));
      expect(share("clearlane")).toBeGreaterThan(share("price_only"));
    }
  });

  it("states the replay density: about twice the 2025 daily rate", () => {
    const d = ledger.replay_density;
    expect(d.calls_per_reading).toBe(359);
    expect(d.backtest_days).toBe(days.length);
    expect(d.ratio_to_2025_rate).toBeGreaterThan(1.9);
    expect(d.ratio_to_2025_rate).toBeLessThan(2.1);
    expect(d.statement).toContain(`359 calls on ${days.length} backtest days`);
    expect(d.statement).toContain("roughly twice the 2025 daily rate");
    expect(d.statement).toContain("stress replay");
  });

  it("counts calls that land inside an earlier call's refill window", () => {
    for (const reading of LEDGER_READINGS) {
      const o = ledger.per_reading.find((x) => x.reading === reading)!;
      expect(o.calls).toBe(359);
      expect(o.calls_inside_prior_refill_window).toBeGreaterThanOrEqual(0);
      expect(o.calls_inside_prior_refill_window).toBeLessThan(359);
    }
  });

  it("has no em dash or en dash anywhere", () => {
    const text = stableJson(ledger);
    expect(text).not.toContain(String.fromCharCode(0x2014));
    expect(text).not.toContain(String.fromCharCode(0x2013));
  });
});

describe("determinism", () => {
  it("the same seed gives a byte-identical file; another seed places other calls", () => {
    expect(stableJson(buildLedger(hist, site, opts(backtest.seed)))).toBe(
      stableJson(ledger),
    );
    const calls = (seed: number) =>
      ledgerCalls(days, "mt", {
        seed,
        by_hour: byHour,
        by_weekday: byWeekday,
        requested_kw: 250,
      }).map((c) => c.start_utc);
    expect(calls(1)).toEqual(calls(1));
    expect(calls(2)).not.toEqual(calls(1));
  }, 60_000);

  it("public/derived/call_ledger.json equals the CLI output for its seed", () => {
    const committed = read(LEDGER);
    expect((JSON.parse(committed) as CallLedger).seed).toBe(backtest.seed);
    expect(committed).toBe(stableJson(ledger));
  });
});

describe("flag off (ff_call_ledger): core outputs are byte-identical", () => {
  it("after the ledger runs, the backtest still reproduces backtest.json and backtest_days.json", () => {
    // the module-level ledger above has already run in this process
    expect(ledger.rows.length).toBeGreaterThan(0);
    const run = runBacktest(hist, site, {
      wear_usd_mwh: backtest.wear_usd_mwh,
      seed: backtest.seed,
      by_hour: byHour,
      by_weekday: byWeekday,
    });
    expect(stableJson(run.result)).toBe(read("public/derived/backtest.json"));
    expect(stableJson(run.days)).toBe(
      read("public/derived/backtest_days.json"),
    );
  }, 60_000);

  it("no core module or core CLI imports the ledger", () => {
    const core = [
      ...readdirSync(repoPath("engine/src"))
        .filter((f) => f !== "ledger.ts")
        .map((f) => `engine/src/${f}`),
      ...readdirSync(repoPath("engine/cli"))
        .filter((f) => f !== "ledger.ts")
        .map((f) => `engine/cli/${f}`),
    ];
    for (const f of core) expect(read(f)).not.toMatch(/ledger/);
  });

  it("the ledger never writes into numbers.json", () => {
    const n = JSON.parse(read("public/derived/numbers.json")) as {
      key: string;
    }[];
    expect(n.some((x) => /ledger/.test(x.key))).toBe(false);
  });
});
