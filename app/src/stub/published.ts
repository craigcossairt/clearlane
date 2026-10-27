import type { Tagged } from "@contracts/types";

const tag = <T>(
  value: T,
  prov: Tagged<T>["prov"],
  source_id: string,
): Tagged<T> => ({
  value,
  prov,
  source_id,
});

const CASE_STUDY =
  "https://www.torus.co/case-studies/case-studies-rocky-mountain-power";
const NOVA = "https://www.torus.co/torus-nova";
const PULSE = "https://www.torus.co/torus-nova-pulse";
const HEATMAP =
  "https://www.datocms-assets.com/93357/1778881001-vpp-events-rmp.jpg";
const TRACE =
  "https://www.datocms-assets.com/93357/1778882593-unplanned-ffr-rmp-1.jpg";
const MOU_70 =
  "https://www.businesswire.com/news/home/20250127668054/en/Rocky-Mountain-Power-and-Torus-Announce-Strategic-Partnership";
const MOU_500 =
  "https://www.torus.co/news/torus-raises-200-million-from-magnetar-deployment-of-modular-power-plants";

/** Torus-published inputs. Heatmap hour 0 is 12am. Both rows of the source sum to the event total. */
export const published = {
  events2025: tag(359, "TORUS_PUBLISHED", CASE_STUDY),
  rampS: tag(19, "TORUS_PUBLISHED", TRACE),
  rampTargetS: tag(30, "TORUS_PUBLISHED", TRACE),
  deliveredPct: tag(102, "TORUS_PUBLISHED", TRACE),
  deliveredBand: tag([90, 100] as [number, number], "TORUS_PUBLISHED", TRACE),
  spinC: tag(10, "TORUS_PUBLISHED", NOVA),
  pulseC: tag(0.5, "TORUS_PUBLISHED", PULSE),
  pulseCycleLife: tag(7500, "TORUS_PUBLISHED", PULSE),
  spinCycleLife: tag(25000, "TORUS_PUBLISHED", NOVA),
  lifespanYr: tag(25, "TORUS_PUBLISHED", NOVA),
  mouMw: tag(70, "TORUS_PUBLISHED", MOU_70),
  mouCeilingMw: tag(500, "TORUS_PUBLISHED", MOU_500),
  heatmapByHour: tag(
    [
      9, 41, 5, 4, 1, 3, 4, 14, 23, 26, 25, 20, 15, 33, 19, 14, 14, 8, 6, 4, 5,
      34, 24, 8,
    ],
    "TORUS_PUBLISHED",
    HEATMAP,
  ),
};

export const pulseCyclesPerYear =
  published.pulseCycleLife.value / published.lifespanYr.value;

/** Place chart hour h on a Mountain axis. shiftHours is -6 when the chart is read as UTC under MDT. */
export function heatmapAsMountain(
  counts: number[],
  shiftHours: number,
): number[] {
  const out = new Array<number>(24).fill(0);
  counts.forEach((count, chartHour) => {
    const mt = (chartHour + shiftHours + 24) % 24;
    out[mt] = (out[mt] ?? 0) + count;
  });
  return out;
}
