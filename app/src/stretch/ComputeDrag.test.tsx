// @vitest-environment jsdom
// #93 compute drag (ff_compute_drag): on the close card, a simulated 25 MW block moves along the
// day's price line by mouse, touch or arrow keys. Value and CO2 at every start hour come from the
// engine's Option 2 shift through engineClient; nothing is computed here.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { Bundle } from "@contracts/types";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { CloseCard } from "../beats/ScaleBeat";
import { NumbersContext } from "../components/Num";
import { hourLabel } from "../components/Time";
import { COPY, DRAG } from "../copy";
import { loadStageData } from "../data";
import { OPTION2_BLOCK, option2Shift, option2ShiftAt } from "../engineClient";
import { FlagsContext, type FlagName } from "../flags";
import { grouped, usdDay, usdPerMw } from "../format";
import { buildLive } from "../live";
import { resolveStageDay } from "../stageDay";
import {
  ALL_FLAGS_OFF,
  expectFlagsOffStage,
  installMatchMedia,
  STAGE_NOW,
  stableHtml,
} from "../test/flagsOff";
import ComputeDrag from "./ComputeDrag";

beforeEach(installMatchMedia);
afterEach(cleanup);

// jsdom has no PointerEvent; a MouseEvent carries clientX, which is all the drag reads.
if (!("PointerEvent" in window)) {
  class PointerEventShim extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    writable: true,
    value: PointerEventShim,
  });
}

const data = loadStageData();
const day = resolveStageDay(data, "");
if (day.state !== "ready") throw new Error("stage day did not resolve");
const live = buildLive(day.entry.bundle, day.entry.file, data.torus);
const bundle = live.bundle;
const DRAG_ON: ReadonlySet<FlagName> = new Set<FlagName>(["ff_compute_drag"]);
const LAST_START = bundle.hours.length - OPTION2_BLOCK.hours;
const key = (k: string) => data.numbers?.find((n) => n.key === k);

function renderDrag(
  b: Bundle = bundle,
  flags: ReadonlySet<FlagName> = DRAG_ON,
) {
  return render(
    <NumbersContext.Provider value={{ state: "ready", numbers: data.numbers }}>
      <FlagsContext.Provider value={flags}>
        <ComputeDrag bundle={b} />
      </FlagsContext.Provider>
    </NumbersContext.Provider>,
  );
}

const block = () => screen.getByRole("slider", { name: DRAG.blockAria });
const startOf = () => Number(block().getAttribute("aria-valuenow"));
const keyOn = (el: Element, k: string) =>
  act(() => {
    fireEvent.keyDown(el, { key: k });
  });
const usdShown = (root: ParentNode) =>
  root.querySelector('[data-slot="drag-value"] [data-num]')!;
const co2Shown = (root: ParentNode) =>
  root.querySelector('[data-slot="drag-co2"] [data-num]')!;

/** En and em dashes, built from code points so no dash sits in this file. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

const ALLOWED = "[data-num], [data-time], [data-axis], [data-copy-ok]";

/** Text nodes with a digit outside every allowed wrapper (the core 2 digit rule). */
function strayDigits(root: Element): string[] {
  const out: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    if (!/\d/.test(text)) continue;
    const parent = node.parentElement;
    if (parent?.closest("title, style, script")) continue;
    if (!parent?.closest(ALLOWED)) out.push(text.trim());
  }
  return out;
}

/** Every number on the card carries a chip, or says why it has none. */
function chiplessNumbers(root: Element): string[] {
  return [...root.querySelectorAll("[data-num]")]
    .filter((el) => {
      const state = el.getAttribute("data-num-state");
      if (state === "not-computed" || state === "unavailable") return false;
      return (
        el.getAttribute("data-prov") === "none" || !el.querySelector(".chip")
      );
    })
    .map((el) => el.outerHTML.slice(0, 120));
}

describe("compute drag with the flag off", () => {
  it("leaves the six beats identical: snapshots and pinned numbers (flag-off helper)", async () => {
    await expectFlagsOffStage();
  });

  it("keeps the close card the static core card, with or without the bundle", () => {
    const wrap = (node: ReactNode) => (
      <NumbersContext.Provider
        value={{ state: "ready", numbers: data.numbers }}
      >
        <FlagsContext.Provider value={ALL_FLAGS_OFF}>
          {node}
        </FlagsContext.Provider>
      </NumbersContext.Provider>
    );
    const core = render(wrap(<CloseCard />));
    const coreHtml = stableHtml(core.container);
    core.unmount();
    const hooked = render(wrap(<CloseCard bundle={bundle} />));
    expect(stableHtml(hooked.container)).toBe(coreHtml);
    expect(hooked.container.querySelector("[data-compute-drag]")).toBeNull();
  });

  it("renders nothing from the drag component itself", () => {
    const { container } = renderDrag(bundle, ALL_FLAGS_OFF);
    expect(container.innerHTML).toBe("");
  });

  it("leaves presenter mode as it was, even with the flag on", async () => {
    const shot = (ff: string) => {
      const { container, unmount } = render(
        <App
          data={data}
          now={STAGE_NOW}
          search={`?ff=${ff}&screen=8&step=end&motion=off`}
        />,
      );
      const html = stableHtml(container);
      unmount();
      return html;
    };
    const presenter = shot("presenter");
    expect(presenter).toContain('data-slot="close-card"');
    expect(shot("presenter,compute_drag")).toBe(presenter);
  });

  it("ScaleBeat.tsx reaches the card only through a lazy import, so flag-off imports nothing new", () => {
    const src = readFileSync(
      path.resolve(import.meta.dirname, "../beats/ScaleBeat.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/^import[^;]*from\s+["']\.\.\/stretch\//m);
    expect(src).toContain('import("../stretch/ComputeDrag")');
    // The lazy chunk is requested only under the flag. Behaviourally, offline.test.tsx fails on
    // any dynamic import while the flag-off stage runs, so dropping this gate turns it red.
    expect(src).toContain('const drag = useFlag("ff_compute_drag");');
    expect(src).toMatch(
      /\{drag && bundle \? \(\s*<Suspense fallback=\{null\}>\s*<ComputeDrag bundle=\{bundle\} \/>/,
    );
  });
});

describe("compute drag with the flag on", () => {
  it("starts at the engine's default position, where the value equals campus_usd to the cent", () => {
    const base = option2Shift(bundle);
    const start = base.to_hb[0]!;
    // The default block on the stage day is contiguous, so the slider can sit on it exactly.
    expect(base.to_hb).toEqual([start, start + 1, start + 2]);
    expect(option2ShiftAt(bundle, start)).toEqual(base);
    expect(base.mwh).toBe(OPTION2_BLOCK.mw * OPTION2_BLOCK.hours);
    const campus = key("campus_usd");
    expect(campus).toBeTruthy();
    expect(base.usd).toBeCloseTo(campus!.value, 2);

    const { container } = renderDrag();
    expect(startOf()).toBe(start);
    const shown = usdShown(container);
    expect(shown.getAttribute("data-prov")).toBe("SIMULATED");
    expect(shown.querySelector(".figure")?.textContent).toBe(campus!.display);
    expect(
      container.querySelector('[data-num="campus_mwh"] .figure')?.textContent,
    ).toBe(key("campus_mwh")!.display);
  });

  it("at every start hour shows the engine's shift for that block, or says why it cannot", () => {
    const { container } = renderDrag();
    keyOn(block(), "Home");
    for (let start = 0; start <= LAST_START; start++) {
      expect(startOf()).toBe(start);
      const shift = option2ShiftAt(bundle, start);
      const usd = usdShown(container);
      const co2 = co2Shown(container);
      if (shift) {
        expect(shift.to_hb).toEqual([start, start + 1, start + 2]);
        expect(usd.querySelector(".figure")?.textContent).toBe(
          usdDay(shift.usd),
        );
        expect(co2.querySelector(".figure")?.textContent).toBe(
          `${grouped(Math.abs(shift.co2_t), 1)} t`,
        );
        expect(
          container.querySelector('[data-slot="drag-co2"]')?.textContent,
        ).toContain(shift.co2_t < 0 ? DRAG.co2Added : DRAG.co2Avoided);
      } else {
        expect(usd.getAttribute("data-num-state")).toBe("unavailable");
        expect(usd.textContent).toContain(DRAG.overlap);
        expect(co2.getAttribute("data-num-state")).toBe("unavailable");
      }
      expect(block().getAttribute("aria-valuetext")).toBe(
        `${hourLabel(start)} to ${hourLabel(start + OPTION2_BLOCK.hours)}`,
      );
      keyOn(block(), "ArrowRight");
    }
    // The block stops at the last start hour.
    expect(startOf()).toBe(LAST_START);
  });

  it("never prices a block that overlaps the hours it moves load out of", () => {
    const from = option2Shift(bundle).from_hb;
    for (let start = 0; start <= LAST_START; start++) {
      const overlaps = from.some(
        (h) => h >= start && h < start + OPTION2_BLOCK.hours,
      );
      expect(option2ShiftAt(bundle, start) === null).toBe(overlaps);
    }
  });

  it("on the stage, arrow keys on the focused block move it and never reach the stage", async () => {
    const { container } = render(
      <App
        data={data}
        now={STAGE_NOW}
        search="?beat=6&step=end&motion=off"
        flags={DRAG_ON}
      />,
    );
    const slider = await screen.findByRole("slider", { name: DRAG.blockAria });
    expect(
      container.querySelector('[data-slot="close-card"] [data-compute-drag]'),
    ).toBeTruthy();
    const start = startOf();
    act(() => slider.focus());
    keyOn(slider, "ArrowLeft");
    expect(startOf()).toBe(start - 1);
    keyOn(slider, "End");
    expect(startOf()).toBe(LAST_START);
    keyOn(slider, "Home");
    expect(startOf()).toBe(0);
    keyOn(slider, "ArrowUp");
    expect(startOf()).toBe(1);
    expect(document.body.dataset.beat).toBe("6");
    expect(document.body.dataset.step).toBe("end");
    // Away from the block, Left is the stage's again.
    act(() => slider.blur());
    act(() => {
      fireEvent.keyDown(window, { key: "ArrowLeft" });
    });
    expect(document.body.dataset.beat).toBe("5");
  });

  it("moves by pointer: drag the block, or tap the line to bring it there (mouse and touch)", () => {
    const { container } = renderDrag();
    const track = container.querySelector<HTMLElement>("[data-drag-track]")!;
    const width = 2400;
    const perHour = width / bundle.hours.length;
    track.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width,
        height: 200,
        right: width,
        bottom: 200,
        x: 0,
        y: 0,
      }) as DOMRect;
    const at = (hour: number) => hour * perHour + perHour / 2;
    const start = startOf();

    // Grab the block by its middle hour and drag it four hours left.
    act(() => {
      fireEvent.pointerDown(block(), { clientX: at(start + 1), pointerId: 1 });
      fireEvent.pointerMove(track, { clientX: at(start - 3), pointerId: 1 });
      fireEvent.pointerUp(track, { clientX: at(start - 3), pointerId: 1 });
    });
    expect(startOf()).toBe(start - 4);
    expect(document.activeElement).toBe(block());

    // A move after release does nothing.
    act(() => {
      fireEvent.pointerMove(track, { clientX: at(2), pointerId: 1 });
    });
    expect(startOf()).toBe(start - 4);

    // A tap on the line centres the block on that hour, by touch too, clamped to the day.
    act(() => {
      fireEvent.pointerDown(track, {
        clientX: at(5),
        pointerId: 2,
        pointerType: "touch",
      });
      fireEvent.pointerUp(track, {
        clientX: at(5),
        pointerId: 2,
        pointerType: "touch",
      });
    });
    expect(startOf()).toBe(4);
    act(() => {
      fireEvent.pointerDown(track, { clientX: at(23), pointerId: 3 });
      fireEvent.pointerUp(track, { clientX: at(23), pointerId: 3 });
    });
    expect(startOf()).toBe(LAST_START);
    act(() => {
      fireEvent.pointerDown(track, { clientX: at(0), pointerId: 4 });
      fireEvent.pointerCancel(track, { clientX: at(0), pointerId: 4 });
    });
    expect(startOf()).toBe(0);
  });

  it("draws the price line with the moved-out hours shaded, and hour labels as axis text", () => {
    const { container } = renderDrag();
    const from = option2Shift(bundle).from_hb;
    const shaded = [...container.querySelectorAll("[data-from-hour]")].map(
      (el) => Number(el.getAttribute("data-from-hour")),
    );
    expect(shaded).toEqual(from);
    expect(container.querySelector("[data-drag-track] polyline")).toBeTruthy();
    const ticks = [...container.querySelectorAll(".drag-ticks [data-axis]")];
    expect(ticks.length).toBe(bundle.hours.length / 3);
    expect(ticks[0]?.textContent).toBe(hourLabel(0));
    expect(container.textContent).toContain(bundle.node);
  });

  it("move it in space shows the same hours at the peer nodes, REAL, and follows the block", () => {
    expect(bundle.peers.length).toBeGreaterThan(0);
    const { container } = renderDrag();
    const toggle = screen.getByRole("button", { name: DRAG.spaceToggle });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector("[data-drag-space]")).toBeNull();
    act(() => {
      fireEvent.click(toggle);
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    const check = () => {
      const start = startOf();
      const hours = [start, start + 1, start + 2];
      const space = container.querySelector("[data-drag-space]")!;
      const rows = [...space.querySelectorAll("tbody tr")];
      const series = [
        { node: bundle.node, lmp: bundle.hours.map((h) => h.lmp_usd_mwh) },
        ...bundle.peers.map((p) => ({ node: p.node, lmp: p.lmp_usd_mwh })),
      ];
      expect(rows.map((r) => r.getAttribute("data-node"))).toEqual(
        series.map((s) => s.node),
      );
      rows.forEach((row, i) => {
        const cells = [...row.querySelectorAll("[data-num]")];
        expect(
          cells.map((c) => c.querySelector(".figure")?.textContent),
        ).toEqual(hours.map((h) => usdPerMw(series[i]!.lmp[h]!)));
        for (const c of cells) expect(c.getAttribute("data-prov")).toBe("REAL");
      });
      expect(
        [...space.querySelectorAll("thead [data-time]")].map(
          (t) => t.textContent,
        ),
      ).toEqual(hours.map(hourLabel));
    };
    check();
    keyOn(block(), "ArrowLeft");
    check();
    // The research figures are only for a bundle without peers.
    expect(
      container.querySelector('[data-num="time_vs_space_oct_time"]'),
    ).toBeNull();
    act(() => {
      fireEvent.click(toggle);
    });
    expect(container.querySelector("[data-drag-space]")).toBeNull();
    expect(usdShown(container)).toBeTruthy();
  });

  it("with no peers, move it in space shows the research figures from numbers.json and their source path", () => {
    const { container } = renderDrag({ ...bundle, peers: [] });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: DRAG.spaceToggle }));
    });
    const space = container.querySelector("[data-drag-space]")!;
    for (const k of ["time_vs_space_oct_time", "time_vs_space_oct_space"]) {
      const el = space.querySelector(`[data-num="${k}"]`)!;
      expect(el.querySelector(".figure")?.textContent).toBe(key(k)!.display);
      expect(el.getAttribute("data-prov")).toBe(key(k)!.prov);
    }
    expect(space.querySelector('[data-copy-ok="file path"]')?.textContent).toBe(
      "research/analysis/option2/where_vs_when_output.txt",
    );
    expect(space.querySelector("tbody")).toBeNull();
  });

  it("carries a SIMULATED chip, a chip on every number, no stray digits and no Torus data-center claim", () => {
    const { container } = renderDrag();
    const card = container.querySelector("[data-compute-drag]")!;
    expect(card.querySelector("h4 .chip")?.textContent).toBe("SIMULATED");
    expect(chiplessNumbers(card)).toEqual([]);
    expect(strayDigits(card)).toEqual([]);
    expect(card.textContent).not.toMatch(/Torus/);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: DRAG.spaceToggle }));
    });
    expect(chiplessNumbers(card)).toEqual([]);
    expect(strayDigits(card)).toEqual([]);
    keyOn(block(), "End");
    keyOn(block(), "ArrowLeft");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: DRAG.spaceToggle }));
    });
    // An unpriceable position reads unavailable with its reason, never zero.
    expect(usdShown(container).getAttribute("data-num-state")).toBe(
      "unavailable",
    );
    expect(strayDigits(card)).toEqual([]);
    expect(card.textContent).toContain(COPY.co2Caveat);
  });
});

describe("compute drag copy", () => {
  it("has no digits (CO2 is a formula, shown as copy-ok) and no em or en dashes", () => {
    for (const [k, v] of Object.entries(DRAG)) {
      expect(v.replace(/CO2/g, "CO"), k).not.toMatch(/\d/);
      expect(v, k).not.toMatch(DASHES);
    }
  });

  it("says simulated, and names value to RMP's system, never Torus", () => {
    const all = Object.values(DRAG).join(" ");
    expect(all).toMatch(/simulated/i);
    expect(all).toMatch(/value to RMP's system at day-ahead prices/i);
    expect(all).not.toMatch(/Torus/);
  });
});
