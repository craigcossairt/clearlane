import { describe, expect, it } from "vitest";
import { loadStageData } from "../data";
import { referenceRaceFor } from "../engineClient";
import { raceCards } from "./race";

const data = loadStageData();
const bundle = data.bundles["2026-10-27"]!.bundle;
const byKey = new Map((data.numbers ?? []).map((n) => [n.key, n]));
const cards = raceCards(referenceRaceFor(bundle), (k) => byKey.get(k));

const usd = (s: string) => Number(s.replace(/[$,]/g, ""));

describe("race arithmetic on the Oct 27 bundle (#216)", () => {
  it("shows the rows in the spec, MWh at three decimals and subtotals in whole dollars", () => {
    const rows = cards.map((c) => [
      c.policy,
      c.buy.mwh,
      c.buy.price,
      c.buy.subtotal,
      c.sell.mwh,
      c.sell.price,
      c.sell.subtotal,
      c.keep.subtotal,
      c.keep.big,
    ]);
    expect(rows).toEqual([
      [
        "fixed_overnight",
        "2.132 MWh",
        "$39.53",
        "$84",
        "1.876 MWh",
        "$55.62",
        "$104",
        "$20",
        "$20.06",
      ],
      [
        "clearlane",
        "2.132 MWh",
        "$21.55",
        "$46",
        "1.876 MWh",
        "$55.62",
        "$104",
        "$58",
        "$58.41",
      ],
    ]);
  });

  it("reproduces by hand as displayed: MWh times price rounds to each subtotal", () => {
    for (const c of cards) {
      for (const row of [c.buy, c.sell]) {
        const mwh = Number(row.mwh.replace(" MWh", ""));
        expect(
          Math.round(mwh * usd(row.price!)),
          `${c.policy} ${row.mwh} x ${row.price}`,
        ).toBe(usd(row.subtotal));
      }
    }
  });

  it("the displayed sell minus the displayed buy equals the displayed keep", () => {
    for (const c of cards) {
      expect(usd(c.sell.subtotal) - usd(c.buy.subtotal), c.policy).toBe(
        usd(c.keep.subtotal),
      );
    }
  });

  it("each displayed subtotal is the engine value rounded to the dollar", () => {
    const race = referenceRaceFor(bundle);
    const legs = { fixed_overnight: race.fixed, clearlane: race.timetable };
    for (const c of cards) {
      const leg = legs[c.policy];
      expect(usd(c.buy.subtotal)).toBe(Math.round(leg.buy_usd_per_mw_day));
      expect(usd(c.sell.subtotal)).toBe(Math.round(leg.sell_usd_per_mw_day));
      expect(usd(c.keep.subtotal)).toBe(Math.round(leg.usd_per_mw_day));
    }
  });

  it("prices and the big Keeps figure are the numbers.json keys", () => {
    const [fixed, clear] = cards;
    expect(fixed!.buy.priceKey).toBe("fixed_rule_charge_usd_mwh");
    expect(clear!.buy.priceKey).toBe("timetable_charge_usd_mwh");
    expect(fixed!.sell.priceKey).toBe("race_discharge_usd_mwh");
    expect(fixed!.keep.key).toBe("fixed_usd_mw_day");
    expect(clear!.keep.key).toBe("clearlane_usd_mw_day");
  });

  it("marks buy and sell hours from referenceRace", () => {
    expect(cards[0]!.buyHours).toEqual([1, 2, 3, 4]);
    expect(cards[1]!.buyHours).toEqual([13, 14, 15]);
    expect(cards[0]!.sellHours).toEqual([18, 19]);
    expect(cards[1]!.sellHours).toEqual([18, 19]);
  });
});
