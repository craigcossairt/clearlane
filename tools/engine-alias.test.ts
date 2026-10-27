import { describe, expect, it } from "vitest";
import * as engine from "@engine";

// The UI imports the engine as bare "@engine"; tsconfig paths and the Vite alias must both resolve it.
describe("bare @engine import", () => {
  it("resolves to engine/src/index.ts", () => {
    expect(typeof engine.lanes).toBe("function");
  });
});
