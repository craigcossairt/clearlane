import { describe, expect, it } from "vitest";
import {
  duplicateBindings,
  KEYMAP,
  lookup,
  RESERVED_KEYS,
  type Binding,
} from "./keymap";

describe("key map", () => {
  it("binds no key twice in one context", () => {
    expect(duplicateBindings()).toEqual([]);
  });

  it("catches a key bound twice", () => {
    const clash: Binding = {
      keys: ["c"],
      action: "reset",
      contexts: ["all"],
      keyLabel: "C",
      label: "clash",
    };
    expect(duplicateBindings([...KEYMAP, clash])).toContain("beat3:c");
  });

  it("binds every core key", () => {
    const keys = ["ArrowRight", "PageDown", "ArrowLeft", "PageUp", "1", "6", "r", "?", "Escape"];
    for (const k of keys) expect(lookup(k, 1), k).not.toBeNull();
    expect(lookup(" ", 2)?.action).toBe("play");
    expect(lookup("C", 3)?.action).toBe("call");
    expect(lookup("e", 5)?.action).toBe("envelope");
    expect(lookup("b", 5)?.action).toBe("backtest");
    for (const k of ["+", "-", "Home", "End"]) expect(lookup(k, 6), k).not.toBeNull();
  });

  it("leaves the stretch keys unbound", () => {
    for (const k of RESERVED_KEYS) {
      for (const beat of [1, 2, 3, 4, 5, 6]) expect(lookup(k, beat), `${k} on ${beat}`).toBeNull();
    }
  });
});
