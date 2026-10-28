import { describe, expect, it } from "vitest";
import { loadStageData } from "./data";
import { ALL_STAGE_KEYS, STAGE_KEYS } from "./stageKeys";

describe("stage keys", () => {
  it("lists keys for all six beats", () => {
    expect(Object.keys(STAGE_KEYS).map(Number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("every key a beat reads is in the real numbers.json, none missing", () => {
    const { numbers } = loadStageData();
    expect(numbers, "public/derived/numbers.json must be on this branch").not.toBeNull();
    if (!numbers) return;
    const have = new Set(numbers.map((n) => n.key));
    expect(ALL_STAGE_KEYS.filter((k) => !have.has(k))).toEqual([]);
  });
});
