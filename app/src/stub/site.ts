/**
 * Stub host only: a SIMULATED weekday manufacturer's load and 15-minute ceiling, sized so the
 * stub's fixed timetables stay under the ceiling. The station itself (Spin and Pulse sizes,
 * C-rates, cycle budget, enrolled kW) comes from the engine's defaultSite through
 * engineClient.ts, so no Torus value is typed here.
 */
const HOST_SHAPE = [
  0.35, 0.32, 0.3, 0.3, 0.33, 0.45, 0.6, 0.75, 0.82, 0.88, 0.92, 0.96, 1, 1,
  0.98, 0.96, 0.9, 0.78, 0.68, 0.58, 0.5, 0.46, 0.42, 0.38,
];

const HOST_PEAK_KW = 480;

export const STUB_HOST_CEILING_KW = 700;

/** 96 quarter-hour host loads, kW (SIMULATED). */
export function stubHostLoadKw15m(): number[] {
  return HOST_SHAPE.flatMap((shape) => {
    const kw = Math.round(shape * HOST_PEAK_KW);
    return [kw, kw, kw, kw];
  });
}
