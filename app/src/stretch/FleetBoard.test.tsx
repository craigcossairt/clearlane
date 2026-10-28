// @vitest-environment jsdom
// #92 fleet board (ff_fleet_board). Partial: the engine's fleet roll-up (#66) and fleet call
// allocator (#67) were cut at Train 5, so the board shows the one simulated site the engine
// models, the engine envelope scaled to the 70 MW MOU, and a call through engineClient.crash;
// the many-site tiles and the fleet delivered share render as "not computed".
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { NumbersContext } from "../components/Num";
import { COPY, FLEET } from "../copy";
import { loadStageData } from "../data";
import { envelope } from "../engineClient";
import { FlagsContext, type FlagName } from "../flags";
import { FLEET_KEY, KEYMAP, RESERVED_KEYS } from "../keymap";
import { buildLive } from "../live";
import { resolveStageDay } from "../stageDay";
import {
  ALL_FLAGS_OFF,
  expectFlagsOffStage,
  installMatchMedia,
  STAGE_NOW,
  stableHtml,
} from "../test/flagsOff";
import FleetBoard, { callIntervalIndex } from "./FleetBoard";

beforeEach(installMatchMedia);
afterEach(cleanup);

const data = loadStageData();
const day = resolveStageDay(data, "");
if (day.state !== "ready") throw new Error("stage day did not resolve");
const live = buildLive(day.entry.bundle, day.entry.file, data.torus);
const BOARD_ON: ReadonlySet<FlagName> = new Set<FlagName>(["ff_fleet_board"]);

const press = (key: string) =>
  act(() => {
    fireEvent.keyDown(window, { key });
  });

function renderBoard(flags: ReadonlySet<FlagName> = BOARD_ON) {
  return render(
    <NumbersContext.Provider value={{ state: "ready", numbers: data.numbers }}>
      <FlagsContext.Provider value={flags}>
        <FleetBoard live={live} />
      </FlagsContext.Provider>
    </NumbersContext.Provider>,
  );
}

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

/** The tile's moment label that is not hidden. */
function visibleMoment(board: Element): string {
  const shown = [...board.querySelectorAll(".fleet-moment > span")].filter(
    (el) =>
      !el.classList.contains("off") &&
      el.getAttribute("aria-hidden") !== "true",
  );
  expect(shown).toHaveLength(1);
  return shown[0]!.textContent ?? "";
}

/** Every number on the board carries a chip, or says why it has none. */
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

describe("fleet board with the flag off", () => {
  it("leaves the six beats identical: snapshots and pinned numbers (flag-off helper)", async () => {
    await expectFlagsOffStage();
  });

  it("renders no pill or board, and F changes nothing on any beat", () => {
    for (const beat of [1, 3, 5]) {
      const { container, unmount } = render(
        <App
          data={data}
          now={STAGE_NOW}
          search={`?beat=${beat}&motion=off`}
          flags={ALL_FLAGS_OFF}
        />,
      );
      const before = stableHtml(container);
      expect(container.querySelector("[data-fleet-pill]")).toBeNull();
      press("f");
      press("F");
      expect(container.querySelector("[data-fleet-board]")).toBeNull();
      expect(stableHtml(container)).toBe(before);
      expect(document.body.dataset.beat).toBe(String(beat));
      unmount();
    }
  });

  it("renders nothing from the board component itself", () => {
    const { container } = renderBoard(ALL_FLAGS_OFF);
    expect(container.innerHTML).toBe("");
  });

  it("App.tsx reaches the board only through a lazy import, so flag-off imports nothing new", () => {
    const src = readFileSync(
      path.resolve(import.meta.dirname, "../App.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/^import[^;]*from\s+["']\.\/stretch\//m);
    expect(src).toContain('import("./stretch/FleetBoard")');
  });

  it("keeps F out of the core key map and the ? overlay table", () => {
    expect(RESERVED_KEYS).toContain(FLEET_KEY.key);
    expect(FLEET_KEY.flag).toBe("ff_fleet_board");
    for (const b of KEYMAP)
      expect(b.keys.map((k) => k.toLowerCase())).not.toContain("f");
  });
});

describe("fleet board with ff_fleet_board on", () => {
  it("F opens the board on the stage, and C on the board does not fire the stage call", async () => {
    render(
      <App
        data={data}
        now={STAGE_NOW}
        search="?beat=3&motion=off"
        flags={BOARD_ON}
      />,
    );
    const pill = await screen.findByRole("button", { name: FLEET.pill });
    expect(document.body.dataset.state).toBe("ready");
    press("f");
    const board = screen.getByRole("dialog", { name: FLEET.title });
    expect(board.getAttribute("data-fleet-call")).toBe("none");
    press("c");
    expect(board.getAttribute("data-fleet-call")).toBe("first");
    // The stage's own C handler never saw the key: beat 3 is still waiting for its call.
    expect(document.body.dataset.state).toBe("ready");
    expect(document.body.dataset.beat).toBe("3");
    press("f");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(pill);
  });

  it("shows the engine's simulated site as a tile, with chips on every number", () => {
    const { container } = renderBoard();
    press("f");
    const board = screen.getByRole("dialog", { name: FLEET.title });
    const tiles = board.querySelectorAll("[data-site]");
    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.getAttribute("data-site")).toBe(live.site.id);
    expect(tiles[0]!.textContent).toContain(live.site.label);
    // Spin, Pulse and the host meter, each a SIMULATED or DERIVED engine value with a chip.
    expect(
      tiles[0]!.querySelectorAll('[data-num][data-prov="DERIVED"]').length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      tiles[0]!.querySelectorAll('[data-num][data-prov="SIMULATED"]').length,
    ).toBeGreaterThanOrEqual(2);
    expect(board.textContent).toContain(FLEET.refillNone);
    // The idle moment label stays in the same grid cell, hidden, so the tile keeps its size.
    expect(visibleMoment(board)).toContain(FLEET.tilePlanned);
    expect(visibleMoment(board)).not.toContain(FLEET.tileAfter);
    expect(chiplessNumbers(container)).toEqual([]);
    expect(strayDigits(container)).toEqual([]);
  });

  it("reads the tile from the plan's quarter hour that holds the 6:40pm call", () => {
    const i = callIntervalIndex(live);
    expect(i).toBeGreaterThanOrEqual(0);
    const iv = live.plans.clearlane.intervals[i]!;
    const start = Date.parse(iv.ts_utc);
    const call = Date.parse(live.calls.first.start_utc);
    expect(start).toBeLessThanOrEqual(call);
    expect(call).toBeLessThan(start + 15 * 60 * 1000);
  });

  it("summarizes the sites it cannot tile as not computed, never as zero", () => {
    renderBoard();
    press("f");
    const more = document.querySelector('[data-slot="fleet-more"]');
    expect(more).toBeTruthy();
    expect(more!.textContent).toContain(COPY.notComputed);
    expect(more!.textContent).toContain(FLEET.moreLine);
    expect(more!.querySelector("[data-num]")).toBeNull();
  });

  it("draws the 24-hour fleet envelope strip at the 70 MW MOU with System Critical Hours shaded", () => {
    renderBoard();
    press("f");
    const strip = document.querySelector('[data-slot="fleet-strip"]')!;
    const svg = strip.querySelector("svg")!;
    const mou = data.numbers!.find((n) => n.key === "mou_70mw")!;
    expect(svg.getAttribute("data-fleet-kw")).toBe(String(mou.value * 1000));
    const env = envelope(
      live.bundle,
      live.plans.clearlane,
      live.site,
      mou.value * 1000,
    );
    expect(svg.querySelectorAll("[data-hour]")).toHaveLength(24);
    const shaded = svg.querySelectorAll(
      '[data-hour][data-critical="yes"]',
    ).length;
    expect(shaded).toBe(env.hours.filter((h) => h.system_critical).length);
    expect(shaded).toBeGreaterThan(0);
    expect(
      strip
        .querySelector('[data-num="mou_70mw"]')
        ?.getAttribute("data-num-state"),
    ).toBe("ok");
    expect(strip.textContent).toContain(FLEET.stripLegend);
    expect(strip.textContent).toContain(COPY.axisCaption);
  });

  it("C lands a call: per-site contribution, MEASURED re-plan ms, fleet share not computed", () => {
    const { container } = renderBoard();
    press("f");
    const panel = document.querySelector('[data-slot="fleet-call"]')!;
    expect(panel.textContent).toContain(FLEET.callPrompt);
    press("c");
    const board = screen.getByRole("dialog");
    expect(board.getAttribute("data-fleet-call")).toBe("first");
    const row = panel.querySelector(`[data-contribution="${live.site.id}"]`);
    expect(row, "one contribution row for the one site").toBeTruthy();
    expect(row!.querySelectorAll('[data-prov="SIMULATED"]').length).toBe(4);
    expect(
      panel.querySelector('[data-prov="MEASURED"] .figure')?.textContent,
    ).toMatch(/ms$/);
    expect(panel.textContent).toContain(FLEET.fleetNotBuilt);
    expect(
      panel.querySelector('[data-slot="fleet-share"] .num-not-computed'),
    ).toBeTruthy();
    // The tile now shows the re-plan after the call and when Spin is full again.
    expect(visibleMoment(board)).toContain(FLEET.tileAfter);
    expect(
      board.querySelector('[data-slot="fleet-refill"]')?.textContent,
    ).toContain(COPY.spinFull);
    expect(chiplessNumbers(container)).toEqual([]);
    expect(strayDigits(container)).toEqual([]);
  });

  it("a second C during the refill shows the second-call rule and its shortfall", () => {
    renderBoard();
    press("f");
    press("c");
    press("c");
    const board = screen.getByRole("dialog");
    expect(board.getAttribute("data-fleet-call")).toBe("second");
    const panel = document.querySelector('[data-slot="fleet-call"]')!;
    expect(panel.textContent).toContain(COPY.secondRule);
    const shortfall = panel.querySelector("[data-shortfall] [data-num]");
    expect(shortfall?.getAttribute("data-prov")).toBe("SIMULATED");
    // A third press changes nothing, as on the stage.
    const html = board.innerHTML;
    press("c");
    expect(board.innerHTML).toBe(html);
  });

  it("the button lands the call too, for touch", () => {
    renderBoard();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: FLEET.pill }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: FLEET.callButton }));
    });
    expect(screen.getByRole("dialog").getAttribute("data-fleet-call")).toBe(
      "first",
    );
  });

  it("Esc closes the board and hands focus back to the pill", () => {
    renderBoard();
    const pill = screen.getByRole("button", { name: FLEET.pill });
    pill.focus();
    press("f");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.activeElement).not.toBe(pill);
    press("Escape");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(pill);
  });

  it("ignores F typed into a text input", () => {
    renderBoard();
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => {
      fireEvent.keyDown(input, { key: "f" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    input.remove();
  });
});

describe("fleet board copy", () => {
  const strings = Object.values(FLEET).join("\n");

  it("has no em or en dash and no digit", () => {
    expect(strings).not.toMatch(/[–—]/);
    expect(strings).not.toMatch(/\d/);
  });

  it("names the sites simulated Torus-style and keeps System Critical Hours off the forecast path", () => {
    expect(FLEET.title).toContain("simulated Torus-style sites");
    expect(FLEET.stripLegend).toContain("the grid's tightest hours");
    expect(FLEET.stripLegend).toContain("not a call forecast");
    expect(strings).not.toMatch(/Torus (lacks|revenue|practice)/i);
  });
});
