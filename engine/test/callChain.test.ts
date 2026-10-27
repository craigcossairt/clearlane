import { describe, expect, it } from "vitest";
import type { CrashEvent, Site } from "@contracts/types";
import { addSeconds } from "@engine/bundle";
import { eta } from "@engine/limits";
import {
  defaultSite,
  scriptedCalls,
  simulateCall,
  solve,
  stateAfterCalls,
} from "@engine/index";
import { loadFixture } from "./helpers/fixture";

// Three calls, each starting while the one before is still on: a weak Spin leaves Pulse to carry them.
const b = loadFixture();
const base = defaultSite();
const site: Site = {
  ...base,
  station: { ...base.station, spin_kw: 1, spin_kwh: 0.1 },
};
const solved = solve(b, base, "clearlane");
const [first] = scriptedCalls(b, base);
const at = (id: string, s: number): CrashEvent => ({
  ...first,
  id,
  start_utc: addSeconds(first.start_utc, s),
  duration_s: 120,
});
const [A, B, C] = [at("A", 0), at("B", 60), at("C", 120)];
// Lower every Pulse SoC by one constant (the hour-to-hour deltas stay) so that the store holds both
// earlier draws and half of the third call's: only a chain-aware C runs short.
const e = eta(site);
const probe = (() => {
  const a = simulateCall(solved, site, A);
  const b2 = simulateCall(solved, site, B, a);
  return { a, b: b2, c: simulateCall(solved, site, C, b2) };
})();
// planned Pulse SoC when C ends, interpolated inside its 15-minute interval like crash.ts does
const day0 = Date.parse(solved.intervals[0]!.ts_utc);
const cEnd = (Date.parse(C.start_utc) - day0) / 1000 + C.duration_s;
const ic = Math.floor(cEnd / 900);
const socBefore = solved.intervals[ic - 1]!.pulse_soc_kwh;
const socEnd =
  socBefore +
  ((solved.intervals[ic]!.pulse_soc_kwh - socBefore) * (cEnd - ic * 900)) / 900;
const need =
  (probe.a.pulse_kwh + probe.b.pulse_kwh + probe.c.pulse_kwh / 2) / e;
const shift = socEnd - need;
const plan = {
  ...solved,
  intervals: solved.intervals.map((iv) => ({
    ...iv,
    pulse_soc_kwh: iv.pulse_soc_kwh - shift,
  })),
};
const a = simulateCall(plan, site, A);
const bRes = simulateCall(plan, site, B, a);
const cChain = simulateCall(plan, site, C, [a, bRes]);
const cLast = simulateCall(plan, site, C, bRes);

describe("a chain of three overlapping calls", () => {
  it("each call draws Pulse", () => {
    for (const r of [a, bRes, cChain]) expect(r.pulse_kwh).toBeGreaterThan(0);
  });

  it("a one-call chain is the single prior", () => {
    expect(simulateCall(plan, site, B, [a])).toEqual(bRes);
  });

  it("the third call starts from Pulse less both earlier draws", () => {
    // only the last prior would hand C the first call's energy back
    expect(a.pulse_kwh).toBeCloseTo(probe.a.pulse_kwh, 9);
    expect(cLast.pulse_kwh).toBeCloseTo(probe.c.pulse_kwh, 6);
    expect(cChain.pulse_kwh).toBeLessThan(cLast.pulse_kwh - 1e-3);
    const drawn = (calls: CrashEvent[], rs: (typeof a)[]) =>
      stateAfterCalls(
        plan,
        site,
        calls.map((event, i) => ({ event, result: rs[i]! })),
      ).pulse_soc_kwh;
    expect(drawn([A, B, C], [a, bRes, cChain])).toBeLessThan(
      drawn([B, C], [bRes, cChain]) - 1e-6,
    );
  });
});
