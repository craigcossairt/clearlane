import type {
  Bundle,
  CrashResult,
  Plan,
  Policy,
  Site,
  TorusPublished,
} from "@contracts/types";
import type { DayLanes, ScriptedCalls } from "../engineClient";

/** Live engine (or stub) results for the stage day, solved before any beat is shown. */
export interface Live {
  bundle: Bundle;
  bundleFile: string;
  day: DayLanes;
  site: Site;
  plans: Record<Policy, Plan>;
  torus: TorusPublished | null;
  calls: ScriptedCalls;
  stub: boolean;
}

export interface CallState {
  first: CrashResult | null;
  ghost: CrashResult | null;
  second: CrashResult | null;
}

export interface BeatProps {
  live: Live;
  hour: number;
  call: CallState;
  backtest: boolean;
  fleetMw: number | null;
  onFleet: (mw: number) => void;
  /** The beat's step; beat 6 shows the close card at "end". Optional so tests can omit it. */
  step?: "start" | "end";
}
