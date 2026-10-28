import { describe, expect, it } from "vitest";
import {
  boxesDiffer,
  fontTooSmall,
  noSidewaysScroll,
  numFits,
  offOrigin,
  slotChanges,
  verdict,
  type Box,
} from "./verdict";

const box = (x: number, y: number, width: number, height: number): Box => ({ x, y, width, height });

describe("verdict exit code", () => {
  it("is 0 when states were measured and nothing failed", () => {
    const v = verdict({ couldNotRun: null, statesChecked: 24, violations: [] });
    expect(v.code).toBe(0);
    expect(v.lines).toEqual(["PASS projector-check: 24 states, 0 violations"]);
  });

  it("is 1 and lists every violation when a check failed", () => {
    const v = verdict({ couldNotRun: null, statesChecked: 24, violations: ["a", "b"] });
    expect(v.code).toBe(1);
    expect(v.lines).toEqual(["FAIL a", "FAIL b", "FAIL projector-check: 2 violation(s) in 24 states"]);
  });

  it("is 2 when the check could not run, even if violations were collected first", () => {
    for (const reason of ["playwright is not installed", "server unreachable", "browser launch failed"]) {
      const v = verdict({ couldNotRun: reason, statesChecked: 3, violations: ["partial"] });
      expect(v.code, reason).toBe(2);
      expect(v.lines[0]).toContain(reason);
    }
  });

  it("is 2, never 0, when no page state was measured", () => {
    expect(verdict({ couldNotRun: null, statesChecked: 0, violations: [] }).code).toBe(2);
  });
});

describe("rules", () => {
  it("slot boxes must not move between states; half a pixel is noise", () => {
    expect(boxesDiffer(box(0, 0, 100, 40), box(0.4, 0, 100.4, 40))).toBe(false);
    expect(boxesDiffer(box(0, 0, 100, 40), box(0, 0, 101, 40))).toBe(true);
    expect(
      slotChanges("beat5 1920x1080 Copy JSON vs Copied", { "copy-json#0": box(0, 0, 100, 40) }, {
        "copy-json#0": box(0, 0, 120, 40),
      }),
    ).toEqual([
      "beat5 1920x1080 Copy JSON vs Copied: [data-slot=copy-json#0] moved from 100.0x40.0 at 0.0,0.0 to 120.0x40.0 at 0.0,0.0",
    ]);
    // A slot that only exists in one state is not a move.
    expect(slotChanges("x", { "close-card#0": box(0, 0, 1, 1) }, {})).toEqual([]);
  });

  it("no sideways scroll", () => {
    expect(noSidewaysScroll("p", 375, 375)).toEqual([]);
    expect(noSidewaysScroll("p", 390, 375)).toHaveLength(1);
  });

  it("a number must sit inside its slot and not overflow", () => {
    const slot = { name: "fleet-value", box: box(0, 0, 200, 60) };
    expect(numFits("p", { key: "k", box: box(10, 10, 150, 40), slot, scrollWidth: 150, clientWidth: 150 })).toEqual([]);
    expect(
      numFits("p", { key: "k", box: box(10, 10, 230, 40), slot, scrollWidth: 230, clientWidth: 230 }),
    ).toEqual(["p: [data-num=k] 230.0x40.0 at 10.0,10.0 spills out of [data-slot=fleet-value] 200.0x60.0 at 0.0,0.0"]);
    expect(
      numFits("p", { key: "k", box: box(0, 0, 100, 40), slot: null, scrollWidth: 140, clientWidth: 100 }),
    ).toEqual(["p: [data-num=k] overflows (scrollWidth 140 > 100)"]);
  });

  it("font minimums at 1920: numbers 40px, other text 24px, chips 18px", () => {
    expect(fontTooSmall("p", { kind: "num", px: 40, what: "x" })).toEqual([]);
    expect(fontTooSmall("p", { kind: "num", px: 36, what: "x" })).toEqual(["p: num 36.0px < 40px: x"]);
    expect(fontTooSmall("p", { kind: "text", px: 24, what: "x" })).toEqual([]);
    expect(fontTooSmall("p", { kind: "text", px: 20, what: "x" })).toHaveLength(1);
    expect(fontTooSmall("p", { kind: "chip", px: 18, what: "x" })).toEqual([]);
    expect(fontTooSmall("p", { kind: "chip", px: 16, what: "x" })).toHaveLength(1);
  });

  it("only same-origin requests pass", () => {
    const base = "http://localhost:4173";
    expect(offOrigin("p", "http://localhost:4173/assets/index.js", base)).toEqual([]);
    expect(offOrigin("p", "data:image/png;base64,AAAA", base)).toEqual([]);
    expect(offOrigin("p", "https://fonts.example/x.woff2", base)).toEqual([
      "p: request to another origin https://fonts.example/x.woff2",
    ]);
    expect(offOrigin("p", "http://localhost:5173/x", base)).toHaveLength(1);
  });
});
