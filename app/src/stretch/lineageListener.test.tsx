// @vitest-environment jsdom
// #91 with ff_lineage off: no capture key listener on the core path, not when the chip code
// loads and not when the stage or the presenter renders. A file of its own, so the spy is in
// place before anything is imported.
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

afterEach(cleanup);

it("adds no capture key listener with the flag off", async () => {
  const spy = vi.spyOn(window, "addEventListener");
  try {
    const { App } = await import("../App");
    const { loadStageData } = await import("../data");
    const { installMatchMedia, STAGE_NOW } = await import("../test/flagsOff");
    installMatchMedia();
    const data = loadStageData();
    for (const search of [
      "?beat=5&step=end&motion=off",
      "?ff=presenter&screen=6&step=end&motion=off",
    ]) {
      render(<App data={data} now={STAGE_NOW} search={search} />);
      cleanup();
    }
    const capture = spy.mock.calls.filter(
      ([type, , opts]) =>
        type === "keydown" &&
        (opts === true || (typeof opts === "object" && !!opts?.capture)),
    );
    expect(capture).toEqual([]);
  } finally {
    spy.mockRestore();
  }
});
