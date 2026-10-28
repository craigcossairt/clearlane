// @vitest-environment jsdom
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadStageData } from "../data";
import {
  expectFlagsOffStage,
  installMatchMedia,
  MASK_MEASURED,
  renderFlagsOff,
  stableHtml,
} from "./flagsOff";

beforeEach(installMatchMedia);
afterEach(cleanup);

describe("six-beat DOM snapshots with every flag off", () => {
  it("each beat's end state matches app/src/__snapshots__ and the pinned numbers", async () => {
    await expectFlagsOffStage();
  });

  it("masks the MEASURED solve time, so a faster laptop does not move the snapshot", () => {
    const { container } = renderFlagsOff(4, loadStageData());
    const measured = container.querySelector('[data-prov="MEASURED"] .figure');
    expect(measured, "beat 4 shows a MEASURED solve time").toBeTruthy();
    const html = stableHtml(container);
    expect(html).toContain(MASK_MEASURED);
    expect(html).not.toContain(measured!.textContent!);
  });
});
