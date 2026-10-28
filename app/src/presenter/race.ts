import type { StageNumber } from "@contracts/types";
import type { ReferenceRace } from "@engine";
import { grouped } from "../format";

/**
 * The race screen's arithmetic (#216). Formatting only: every value is the engine's
 * referenceRace leg or a numbers.json key. MWh show three decimals, prices show cents (their
 * keys' own display), and subtotals show whole dollars, so each row reproduces by hand as
 * displayed: MWh x price rounds to the subtotal, and sell - buy is the keep.
 */
export interface ArithRow {
  /** MWh per MW, three decimals ("2.132 MWh"). */
  mwh: string;
  mwhValue: number;
  /** The price key's display ("$39.53"), or null when the key is not computed. */
  price: string | null;
  priceKey: string;
  /** Whole dollars per MW per day ("$84"). */
  subtotal: string;
  subtotalValue: number;
}

export interface RaceCard {
  policy: "fixed_overnight" | "clearlane";
  buy: ArithRow;
  sell: ArithRow;
  keep: {
    /** Whole dollars, so sell minus buy reads exactly ("$20"). */
    subtotal: string;
    subtotalValue: number;
    /** The key the large Keeps figure reads ("$20.06" through Num). */
    key: string;
    /** That key's display, or null when not computed. */
    big: string | null;
  };
  buyHours: number[];
  sellHours: number[];
}

const dollars = (n: number) => `$${grouped(Math.round(n), 0)}`;
const mwh3 = (n: number) => `${grouped(n, 3)} MWh`;

export function raceCards(
  race: ReferenceRace,
  lookup: (key: string) => StageNumber | undefined,
): [RaceCard, RaceCard] {
  const card = (
    policy: RaceCard["policy"],
    leg: ReferenceRace["fixed"],
    buyKey: string,
    keepKey: string,
  ): RaceCard => ({
    policy,
    buy: {
      mwh: mwh3(leg.charge_mwh),
      mwhValue: leg.charge_mwh,
      price: lookup(buyKey)?.display ?? null,
      priceKey: buyKey,
      subtotal: dollars(leg.buy_usd_per_mw_day),
      subtotalValue: leg.buy_usd_per_mw_day,
    },
    sell: {
      mwh: mwh3(leg.discharge_mwh),
      mwhValue: leg.discharge_mwh,
      price: lookup("race_discharge_usd_mwh")?.display ?? null,
      priceKey: "race_discharge_usd_mwh",
      subtotal: dollars(leg.sell_usd_per_mw_day),
      subtotalValue: leg.sell_usd_per_mw_day,
    },
    keep: {
      subtotal: dollars(leg.usd_per_mw_day),
      subtotalValue: leg.usd_per_mw_day,
      key: keepKey,
      big: lookup(keepKey)?.display ?? null,
    },
    buyHours: [...leg.charge_hb],
    sellHours: [...leg.discharge_hb],
  });
  return [
    card(
      "fixed_overnight",
      race.fixed,
      "fixed_rule_charge_usd_mwh",
      "fixed_usd_mw_day",
    ),
    card(
      "clearlane",
      race.timetable,
      "timetable_charge_usd_mwh",
      "clearlane_usd_mw_day",
    ),
  ];
}
