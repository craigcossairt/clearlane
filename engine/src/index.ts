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
export { solveDp } from "./dp";
export type { DpInput, DpResult } from "./dp";
export { callShare, dpHourly, hourlyUnanswerable, rotateLeft, snapshotHour } from "./hourly";
export type { HourlyOpts } from "./hourly";
export { defaultSite, SITE_DEFAULT_ID } from "./site";
export {
  DP_FLOOR_LEVEL,
  PULSE_LEVELS,
  hold4,
  reachLevels,
  schCapKw,
  solveSiteDP,
  spinAvailKw,
  stepLimits,
} from "./limits";
export type { LimitOpts, SiteDpOpts, StepLimits } from "./limits";
export { DEFAULT_WEAR_USD_MWH, POLICY_LABEL, solve } from "./policies";
export type { SolveOpts } from "./policies";
export { checkPlan } from "./checkPlan";
export { buildPlan, schFlags } from "./plan";
export type { Schedule } from "./plan";
export { SECOND_CALL_OFFSET_S, scriptedCalls, simulateCall } from "./crash";
export type { CallResult } from "./crash";
export { crash, replanFrom, stateAfterCalls } from "./replan";
export type { CrashOutcome, Replan, ReplanState } from "./replan";
export { SCH_RULE, buildEnvelope, validateEnvelope } from "./envelope";
export type { EnvelopeOpts } from "./envelope";
export { mulberry32, poisson, weighted } from "./rng";
export type { Rng } from "./rng";
export {
  dayStartMs,
  hourWeights,
  mountainOffsetH,
  READINGS,
  sampleCalls,
  weekdayIndex,
} from "./events";
export type { Reading, SampleOpts } from "./events";
export {
  BACKTEST_WINDOW,
  DEFAULT_SEED,
  POLICIES,
  clearlaneCyclesPerYr,
  histBundle,
  runBacktest,
  validateBacktest,
  windowDays,
} from "./backtest";
export type {
  BacktestDayRow,
  BacktestOpts,
  BacktestOutput,
  BacktestRun,
  PolicyStatsOut,
} from "./backtest";
export { mean, pctl, percentile } from "./stats";
export { calibrateWear } from "./wear";
export type { WearCalibration, WearOpts } from "./wear";
export {
  FIXPY_AS_OF,
  SUFFIXES,
  baseKey,
  buildNumbers,
  factsRegistry,
  largestStep,
  registryWithNewKeys,
  snapshotPricesFromCsv,
  stepHourDays,
  validateNumbers,
} from "./numbers";
export type { NumberInputs } from "./numbers";
export { NEW_KEYS } from "./newKeys";
