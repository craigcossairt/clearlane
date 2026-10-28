// Presenter mode (#216, ff_presenter): the eight screens and the click-through walk. State is a
// pure function of (screen, actions run on that screen), so a clicker alone walks the talk and a
// deep link lands on exactly the state Next would reach.

export type ScreenKey =
  | "title"
  | "traffic"
  | "race"
  | "call"
  | "replan"
  | "envelope"
  | "scale"
  | "close";

export type ActionKey =
  "replay" | "callNow" | "callAgain" | "resume" | "backtest" | "fleetMax";

export interface ScreenDef {
  /** 1-based, as in `?screen=N` and body[data-screen]. */
  n: number;
  key: ScreenKey;
  /** The progress-bar label. */
  label: string;
  /** Actions in Next order. */
  actions: readonly ActionKey[];
}

export const SCREENS: readonly ScreenDef[] = [
  { n: 1, key: "title", label: "Title", actions: [] },
  { n: 2, key: "traffic", label: "Traffic report", actions: [] },
  { n: 3, key: "race", label: "Race", actions: ["replay"] },
  { n: 4, key: "call", label: "Call", actions: ["callNow", "callAgain"] },
  { n: 5, key: "replan", label: "Re-plan", actions: ["resume"] },
  { n: 6, key: "envelope", label: "Envelope", actions: ["backtest"] },
  { n: 7, key: "scale", label: "Scale", actions: ["fleetMax"] },
  { n: 8, key: "close", label: "Close", actions: [] },
];

export const LAST_SCREEN = SCREENS.length;

export interface PresenterState {
  screen: number;
  /** How many of the screen's actions have run, 0 to actions.length. */
  actions: number;
}

export type StepName = "start" | "partial" | "end";

export function screenDef(n: number): ScreenDef {
  return SCREENS[clampScreen(n) - 1]!;
}

export function clampScreen(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(LAST_SCREEN, Math.round(n)));
}

/** A screen at its start state (Next and progress-bar clicks land here). */
export function atStart(n: number): PresenterState {
  return { screen: clampScreen(n), actions: 0 };
}

/** A screen at its end state (Back lands here, the way a deck shows the finished slide). */
export function atEnd(n: number): PresenterState {
  const s = clampScreen(n);
  return { screen: s, actions: screenDef(s).actions.length };
}

/** Next: run the screen's next unrun action, else move to the next screen at its start. */
export function nextState(s: PresenterState): PresenterState {
  const def = screenDef(s.screen);
  if (s.actions < def.actions.length)
    return { screen: s.screen, actions: s.actions + 1 };
  if (s.screen >= LAST_SCREEN) return atEnd(LAST_SCREEN);
  return atStart(s.screen + 1);
}

/** Back: the previous screen at its end state. Title stays on Title. */
export function backState(s: PresenterState): PresenterState {
  if (s.screen <= 1) return atStart(1);
  return atEnd(s.screen - 1);
}

export function stepName(s: PresenterState): StepName {
  const total = screenDef(s.screen).actions.length;
  if (total === 0 || s.actions >= total) return "end";
  return s.actions === 0 ? "start" : "partial";
}

/** Has this screen's action run? Earlier screens count as finished. */
export function ran(s: PresenterState, action: ActionKey): boolean {
  const def = screenDef(s.screen);
  const i = def.actions.indexOf(action);
  if (i >= 0) return s.actions > i;
  // An action of an earlier screen has run; one of a later screen has not.
  const owner = SCREENS.find((d) => d.actions.includes(action));
  return owner ? owner.n < s.screen : false;
}

/** The state a deep link asks for: `?screen=N&step=end`. */
export function fromQuery(params: URLSearchParams): PresenterState {
  const n = clampScreen(Number(params.get("screen") ?? "1"));
  return params.get("step") === "end" ? atEnd(n) : atStart(n);
}
