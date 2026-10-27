// The engine's public API. The UI imports only from here. Never rename an export; add a new one.
export { intervalStartsUtc, validateBundle } from "./bundle";
export { laneThresholds, lanes, systemCriticalHours } from "./lanes";
export type { LaneThresholds, SchMode, SystemCriticalHours } from "./lanes";
export { option2Shift, referenceRace, scaleUsdPerDay } from "./reference";
export type {
  Option2Opts,
  Option2Shift,
  RaceLeg,
  ReferenceRace,
} from "./reference";
export { mulberry32, poisson, weighted } from "./rng";
export type { Rng } from "./rng";
export {
  dayStartMs,
  hourWeights,
  mountainOffsetH,
  sampleCalls,
  weekdayIndex,
} from "./events";
export type { Reading, SampleOpts } from "./events";
