// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { StageNumber } from "@contracts/types";
import { afterEach, describe, expect, it } from "vitest";
import { chipText } from "./Chip";
import { Num, NumbersContext, type NumbersState } from "./Num";

afterEach(cleanup);

const row: StageNumber = {
  key: "peak_price",
  value: 55.78,
  unit: "$/MWh",
  display: "$55.78",
  prov: "REAL",
  source: "snapshot da_lmp_elap_pace",
  as_of_mt: "2026-10-27",
};

function withCtx(ctx: NumbersState, node: React.ReactNode) {
  return render(<NumbersContext.Provider value={ctx}>{node}</NumbersContext.Provider>);
}

describe("<Num>", () => {
  it("renders a key's display string verbatim with data-num, data-prov and a sourced chip", () => {
    const { container } = withCtx({ state: "ready", numbers: [row] }, <Num k="peak_price" />);
    const el = container.querySelector("[data-num]");
    expect(el?.getAttribute("data-num")).toBe("peak_price");
    expect(el?.getAttribute("data-prov")).toBe("REAL");
    expect(container.textContent).toContain("$55.78");
    const chip = container.querySelector("abbr");
    expect(chip?.getAttribute("title")).toContain("snapshot da_lmp_elap_pace");
    expect(chip?.getAttribute("title")).toContain("2026-10-27");
  });

  it("names TORUS_PUBLISHED as TORUS PUBLISHED", () => {
    expect(chipText("TORUS_PUBLISHED")).toBe("TORUS PUBLISHED");
  });

  it("a missing key says not computed and never renders 0", () => {
    const { container } = withCtx({ state: "ready", numbers: [] }, <Num k="nope" />);
    expect(container.textContent).toContain("not computed");
    expect(container.textContent).not.toMatch(/\d/);
    const { container: c2 } = withCtx({ state: "ready", numbers: null }, <Num k="nope" />);
    expect(c2.textContent).toContain("not computed");
  });

  it("loading, not computed, unavailable and failed look different", () => {
    const states = [
      withCtx({ state: "loading" }, <Num k="peak_price" />),
      withCtx({ state: "ready", numbers: [] }, <Num k="peak_price" />),
      withCtx(
        { state: "ready", numbers: [] },
        <Num value={null} display="" prov="REAL" source="x" reason="hour missing" />,
      ),
      withCtx({ state: "failed", file: "public/derived/numbers.json" }, <Num k="peak_price" />),
    ].map((r) => r.container.querySelector("[data-num]")?.className);
    expect(new Set(states).size).toBe(4);
  });

  it("a live value carries its class, and a null live value says unavailable with the reason", () => {
    const { container } = withCtx(
      { state: "ready", numbers: null },
      <Num value={12.3} display="12.3 ms" prov="MEASURED" source="performance.now" />,
    );
    expect(container.querySelector("[data-prov]")?.getAttribute("data-prov")).toBe("MEASURED");
    const { container: c2 } = withCtx(
      { state: "ready", numbers: null },
      <Num value={null} display="" prov="REAL" source="x" reason="hour missing" />,
    );
    expect(c2.textContent).toContain("unavailable: hour missing");
  });
});
