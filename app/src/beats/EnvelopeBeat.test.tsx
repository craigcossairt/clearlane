// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NumbersContext } from "../components/Num";
import { COPY } from "../copy";
import { assembleDerived, loadDerivedFiles, loadStageData, type DerivedFiles } from "../data";
import { dayLanes, defaultSite, scriptedCalls, solve, STUB_ACTIVE } from "../engineClient";
import { EnvelopeBeat } from "./EnvelopeBeat";
import type { Live } from "./types";

afterEach(cleanup);

const data = loadStageData();
const entry = data.bundles["2026-10-27"];
if (!entry) throw new Error("the Oct 27 bundle (fixture) is missing");
const bundle = entry.bundle;
const site = defaultSite();
const live: Live = {
  bundle,
  bundleFile: entry.file,
  day: dayLanes(bundle),
  site,
  plans: {
    fixed_overnight: solve(bundle, site, "fixed_overnight"),
    price_only: solve(bundle, site, "price_only"),
    clearlane: solve(bundle, site, "clearlane"),
  },
  torus: data.torus,
  calls: scriptedCalls(bundle, site),
  stub: STUB_ACTIVE,
};
const ENV_PATH = join(import.meta.dirname, "../../../public/derived/envelope_2026-10-27.json");
const fileText = readFileSync(ENV_PATH, "utf8");

function renderBeat(opts: {
  backtest?: boolean;
  derived?: DerivedFiles;
  clipboard?: { writeText: (t: string) => Promise<void> } | null;
}) {
  return render(
    <NumbersContext.Provider value={{ state: "ready", numbers: data.numbers }}>
      <EnvelopeBeat
        live={live}
        hour={0}
        call={{ first: null, ghost: null, second: null }}
        backtest={opts.backtest ?? false}
        fleetMw={null}
        onFleet={() => undefined}
        derived={opts.derived}
        clipboard={opts.clipboard}
      />
    </NumbersContext.Provider>,
  );
}

describe("beat 5 envelope and backtest", () => {
  it("bundles the stage day's envelope file", () => {
    expect(loadDerivedFiles().envelopes["2026-10-27"]?.raw).toBe(fileText);
  });

  it("shows all 24 hours with System Critical Hours shaded, the rule text and the schema id", () => {
    const { container } = renderBeat({});
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(24);
    expect(container.querySelectorAll('tr[data-critical="yes"].critical').length).toBeGreaterThan(0);
    const text = container.textContent ?? "";
    expect(text).toContain("System Critical Hours (our proposal)");
    expect(text).toContain("clearlane.envelope/v1");
    expect(container.querySelector("[data-detail]")).toBeTruthy();
  });

  it("Copy JSON copies the file's exact text and the three labels share one button", async () => {
    let copied = "";
    const { container } = renderBeat({
      clipboard: { writeText: async (t) => void (copied = t) },
    });
    const btn = container.querySelector('[data-slot="copy-json"]')!;
    expect([...btn.querySelectorAll("span")].map((s) => s.textContent)).toEqual([
      COPY.copyJson,
      COPY.copied,
      COPY.copyFailed,
    ]);
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(copied).toBe(fileText);
    expect(btn.querySelector("span.on")?.textContent).toBe(COPY.copied);
  });

  it("with no clipboard it says Copy failed", async () => {
    const { container } = renderBeat({ clipboard: null });
    const btn = container.querySelector('[data-slot="copy-json"]')!;
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(btn.querySelector("span.on")?.textContent).toBe(COPY.copyFailed);
  });

  it("an envelope for another day is the failed state, never mixed in", () => {
    const other = fileText.replace(/"operating_day_mt": "2026-10-27"/, '"operating_day_mt": "2026-10-28"');
    const derived = assembleDerived({ "../../public/derived/envelope_2026-10-28.json": other });
    const { container } = renderBeat({ derived });
    expect(container.textContent).toContain(COPY.failed);
    expect(container.querySelector("tbody")).toBeNull();
  });

  it("without backtest.json the backtest card says not computed yet, never zeros", () => {
    const { container } = renderBeat({ backtest: true, derived: assembleDerived({}) });
    const slot = container.querySelector('[data-slot="backtest-bands"]')!;
    expect(slot.textContent).toContain(COPY.notComputedYet);
    expect(slot.querySelector("[data-num]")).toBeNull();
  });
});
