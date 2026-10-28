// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { loadStageData } from "../data";
import type { FlagName } from "../flags";
import { SCREENS } from "../presenter/model";
import {
  expectFlagsOffStage,
  installMatchMedia,
  SNAPSHOT_DIR,
  STAGE_NOW,
  stableHtml,
} from "../test/flagsOff";

beforeEach(installMatchMedia);
afterEach(cleanup);

const data = loadStageData();
const PRESENTER_ONLY: ReadonlySet<FlagName> = new Set(["ff_presenter"]);

describe("number lineage with its flag off (#91)", () => {
  it("leaves the six-beat snapshots and every pinned number unchanged", async () => {
    await expectFlagsOffStage();
  });

  // Recorded from main before the lineage code landed, so any change to the presenter's DOM
  // with ff_lineage off fails here.
  for (const s of SCREENS) {
    for (const step of ["start", "end"] as const) {
      it(`leaves presenter screen ${s.n} (${s.key}, ${step}) byte-identical`, async () => {
        const q = step === "end" ? "&step=end" : "";
        const { container } = render(
          <App
            data={data}
            now={STAGE_NOW}
            search={`?screen=${s.n}${q}&motion=off`}
            flags={PRESENTER_ONLY}
          />,
        );
        expect(
          container.querySelector('[data-mode="presenter"]'),
        ).not.toBeNull();
        await expect(stableHtml(container)).toMatchFileSnapshot(
          `${SNAPSHOT_DIR}presenter${s.n}-${step}.html`,
        );
      });
    }
  }
});
