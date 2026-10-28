import { describe, expect, it } from "vitest";
import {
  atEnd,
  atStart,
  backState,
  fromQuery,
  nextState,
  ran,
  SCREENS,
  stepName,
  type PresenterState,
} from "./model";

const label = (s: PresenterState) => {
  const def = SCREENS[s.screen - 1]!;
  return s.actions === 0 ? def.key : `${def.key}:${def.actions[s.actions - 1]}`;
};

describe("presenter Next walk (#216)", () => {
  it("walks Title to Close through every action in the spec's order", () => {
    const seen: string[] = [];
    let s = atStart(1);
    seen.push(label(s));
    for (let i = 0; i < 30; i++) {
      const n = nextState(s);
      if (n.screen === s.screen && n.actions === s.actions) break;
      s = n;
      seen.push(label(s));
    }
    expect(seen).toEqual([
      "title",
      "traffic",
      "race",
      "race:replay",
      "call",
      "call:callNow",
      "call:callAgain",
      "replan",
      "replan:resume",
      "envelope",
      "envelope:backtest",
      "scale",
      "scale:fleetMax",
      "close",
    ]);
  });

  it("Next on Close stays on Close", () => {
    expect(nextState(atEnd(8))).toEqual(atEnd(8));
  });

  it("Back lands on the previous screen at its end state, and stays on Title", () => {
    expect(backState(atStart(5))).toEqual({ screen: 4, actions: 2 });
    expect(backState({ screen: 4, actions: 1 })).toEqual({
      screen: 3,
      actions: 1,
    });
    expect(backState(atStart(1))).toEqual(atStart(1));
  });

  it("names the step start, partial and end", () => {
    expect(stepName(atStart(4))).toBe("start");
    expect(stepName({ screen: 4, actions: 1 })).toBe("partial");
    expect(stepName(atEnd(4))).toBe("end");
    expect(stepName(atStart(2))).toBe("end");
    expect(stepName(atStart(1))).toBe("end");
  });

  it("counts every earlier screen as finished", () => {
    const replan = atStart(5);
    expect(ran(replan, "callNow")).toBe(true);
    expect(ran(replan, "callAgain")).toBe(true);
    expect(ran(replan, "resume")).toBe(false);
    expect(ran(replan, "backtest")).toBe(false);
    expect(ran({ screen: 4, actions: 1 }, "callAgain")).toBe(false);
    expect(ran(atStart(8), "fleetMax")).toBe(true);
  });

  it("reads deep links and clamps them", () => {
    expect(fromQuery(new URLSearchParams("screen=4&step=end"))).toEqual(
      atEnd(4),
    );
    expect(fromQuery(new URLSearchParams("screen=6"))).toEqual(atStart(6));
    expect(fromQuery(new URLSearchParams("screen=99"))).toEqual(atStart(8));
    expect(fromQuery(new URLSearchParams("screen=x"))).toEqual(atStart(1));
  });
});
