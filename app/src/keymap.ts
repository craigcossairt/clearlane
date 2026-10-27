/**
 * One table drives the key handler and the ? overlay. Integration mirrors it into
 * demo/keymap.md. A key bound twice in the same context is a UI bug (keymap.test.ts).
 */

export type Action =
  | "next"
  | "prev"
  | "beat"
  | "play"
  | "call"
  | "envelope"
  | "backtest"
  | "fleetUp"
  | "fleetDown"
  | "fleetMin"
  | "fleetMax"
  | "reset"
  | "help"
  | "close";

/** "all" applies on every beat; a beat context applies only there. */
export type KeyContext = "all" | "beat2" | "beat3" | "beat5" | "beat6";

export interface Binding {
  /** KeyboardEvent.key values. Letters are matched case-insensitively. */
  keys: string[];
  action: Action;
  contexts: KeyContext[];
  /** Overlay text: the key names as shown, then what they do. */
  keyLabel: string;
  label: string;
}

export const KEYMAP: Binding[] = [
  { keys: ["ArrowRight", "PageDown"], action: "next", contexts: ["all"], keyLabel: "Right, PageDown", label: "Next step" },
  { keys: ["ArrowLeft", "PageUp"], action: "prev", contexts: ["all"], keyLabel: "Left, PageUp", label: "Previous step" },
  { keys: ["1", "2", "3", "4", "5", "6"], action: "beat", contexts: ["all"], keyLabel: "1 to 6", label: "Jump to that beat" },
  { keys: [" "], action: "play", contexts: ["beat2"], keyLabel: "Space", label: "Play or pause the day" },
  { keys: ["c"], action: "call", contexts: ["beat2", "beat3"], keyLabel: "C", label: "Call at 6:40pm, again during the refill" },
  { keys: ["e"], action: "envelope", contexts: ["beat5"], keyLabel: "E", label: "Envelope" },
  { keys: ["b"], action: "backtest", contexts: ["beat5"], keyLabel: "B", label: "Backtest card" },
  { keys: ["+", "="], action: "fleetUp", contexts: ["beat6"], keyLabel: "+", label: "Fleet slider up" },
  { keys: ["-"], action: "fleetDown", contexts: ["beat6"], keyLabel: "-", label: "Fleet slider down" },
  { keys: ["Home"], action: "fleetMin", contexts: ["beat6"], keyLabel: "Home", label: "Fleet at the MOU size" },
  { keys: ["End"], action: "fleetMax", contexts: ["beat6"], keyLabel: "End", label: "Fleet at the MOU ceiling" },
  { keys: ["r"], action: "reset", contexts: ["all"], keyLabel: "R", label: "Reset to beat 1" },
  { keys: ["?"], action: "help", contexts: ["all"], keyLabel: "?", label: "Show or hide this key map" },
  { keys: ["Escape"], action: "close", contexts: ["all"], keyLabel: "Esc", label: "Close any overlay" },
];

/** Reserved for stretch items; never bound in core. */
export const RESERVED_KEYS = ["t", "d", "p", "f", "i"] as const;

const norm = (key: string) => (key.length === 1 ? key.toLowerCase() : key);

export function contextsFor(beat: number): KeyContext[] {
  const ctx: KeyContext[] = ["all"];
  if (beat === 2) ctx.push("beat2");
  if (beat === 3) ctx.push("beat3");
  if (beat === 5) ctx.push("beat5");
  if (beat === 6) ctx.push("beat6");
  return ctx;
}

/** The binding for a key on a beat, or null. */
export function lookup(key: string, beat: number): Binding | null {
  const k = norm(key);
  const ctx = contextsFor(beat);
  return (
    KEYMAP.find(
      (b) => b.keys.some((x) => norm(x) === k) && b.contexts.some((c) => ctx.includes(c)),
    ) ?? null
  );
}

/** Keys bound twice in one context (an "all" binding counts in every context). */
export function duplicateBindings(map: Binding[] = KEYMAP): string[] {
  const contexts: KeyContext[] = ["all", "beat2", "beat3", "beat5", "beat6"];
  const dupes: string[] = [];
  for (const ctx of contexts) {
    const seen = new Map<string, Action>();
    for (const b of map) {
      if (!b.contexts.includes(ctx) && !(ctx !== "all" && b.contexts.includes("all"))) continue;
      for (const key of b.keys) {
        const k = norm(key);
        if (seen.has(k)) dupes.push(`${ctx}:${k}`);
        else seen.set(k, b.action);
      }
    }
  }
  return dupes;
}

/** True when the event target is a text input, where only Esc is handled. */
export function typedIntoInput(target: EventTarget | null): boolean {
  if (!target || !(target as HTMLElement).tagName) return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.tagName === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return type !== "range" && type !== "button" && type !== "checkbox";
  }
  return false;
}
