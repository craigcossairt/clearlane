import { describe, expect, it } from "vitest";
import { parseFlags } from "./flags";

describe("flags", () => {
  it("every flag is off by default", () => {
    expect([...parseFlags("")]).toEqual([]);
  });

  it("?ff= turns named flags on, without the ff_ prefix, and ignores unknown names", () => {
    const on = parseFlags("?ff=any_day,nope,freeway");
    expect(on.has("ff_any_day")).toBe(true);
    expect(on.has("ff_freeway")).toBe(true);
    expect(on.size).toBe(2);
  });
});
