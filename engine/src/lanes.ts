// Lanes (clear, shoulder, jam) and System Critical Hours (our proposal).
import type { Bundle, Lane } from "@contracts/types";
import { prices } from "./bundle";

export interface LaneThresholds {
  clear_max_usd: number;
  jam_min_usd: number;
}

// Clear is the bottom quarter of the day's price range, jam the top quarter.
export function laneThresholds(p: number[]): LaneThresholds {
  const min = Math.min(...p);
  const max = Math.max(...p);
  const q = 0.25 * (max - min);
  return { clear_max_usd: min + q, jam_min_usd: max - q };
}

export function lanesFromPrices(p: number[]): Lane[] {
  const t = laneThresholds(p);
  return p.map((x) =>
    x <= t.clear_max_usd ? "clear" : x >= t.jam_min_usd ? "jam" : "shoulder",
  );
}

export function lanes(b: Bundle): Lane[] {
  return lanesFromPrices(prices(b));
}

export type SchMode = "net_load" | "price_proxy";

export interface SystemCriticalHours {
  hours: number[]; // Mountain hours beginning, ascending
  top4: number[];
  proxy: boolean;
  label: string;
}

// The 4 highest values; ties go to the earlier hour. Returned ascending.
function top4(values: number[]): number[] {
  return values
    .map((v, h) => ({ v, h }))
    .sort((a, b) => b.v - a.v || a.h - b.h)
    .slice(0, 4)
    .map((x) => x.h)
    .sort((a, b) => a - b);
}

export function schFromPrices(
  p: number[],
  netLoad: number[] | null,
): SystemCriticalHours {
  // an incomplete or non-finite net-load series counts as unavailable
  const usable =
    netLoad !== null &&
    netLoad.length === p.length &&
    netLoad.every(Number.isFinite);
  const proxy = !usable;
  const t = top4(usable ? netLoad : p);
  const jam = lanesFromPrices(p).flatMap((l, h) => (l === "jam" ? [h] : []));
  return {
    hours: [...new Set([...t, ...jam])].sort((a, b) => a - b),
    top4: t,
    proxy,
    label: proxy
      ? "System Critical Hours (our proposal), price proxy: the 4 highest-price hours plus every jam hour"
      : "System Critical Hours (our proposal): the 4 highest net-load hours plus every jam hour",
  };
}

export function systemCriticalHours(
  b: Bundle,
  mode: SchMode = "net_load",
): SystemCriticalHours {
  return schFromPrices(
    prices(b),
    mode === "net_load" ? b.hours.map((h) => h.net_load_mw) : null,
  );
}
