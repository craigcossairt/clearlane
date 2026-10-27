// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { Bundle } from "@contracts/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STUB_ACTIVE } from "./engineClient";
import { App, BEATS } from "./App";
import { loadStageData, type StageData } from "./data";
import { resolveStageDay } from "./stageDay";

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
});
afterEach(cleanup);

const data = loadStageData();
const NOW = new Date("2026-10-27T18:00:00Z");

const ALLOWED = "[data-num], [data-time], [data-axis], [data-copy-ok]";

/** Text nodes with a digit that sit outside every allowed wrapper. */
function strayDigits(root: HTMLElement): string[] {
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

describe("digit rule", () => {
  for (const beat of BEATS) {
    for (const step of ["start", "end"]) {
      it(`beat ${beat.id} (${step}) has no digit outside a number, time or axis label`, () => {
        const { container } = render(
          <App data={data} now={NOW} search={`?beat=${beat.id}&step=${step}&motion=off`} />,
        );
        expect(strayDigits(container)).toEqual([]);
      });
    }
  }
});

function redate(src: StageData, from: string, to: string): StageData {
  const entry = src.bundles[from];
  if (!entry) throw new Error("fixture missing");
  const shiftIso = (iso: string) =>
    new Date(Date.parse(iso) + 24 * 3600 * 1000).toISOString().replace(".000Z", "Z");
  const b: Bundle = {
    ...entry.bundle,
    operating_day_mt: to,
    fetched_utc: shiftIso(entry.bundle.fetched_utc),
    hours: entry.bundle.hours.map((h) => ({
      ...h,
      ts_utc: shiftIso(h.ts_utc),
      local_mt: h.local_mt.replace(from, to),
    })),
    notes: [],
  };
  // numbers.json is regenerated for whichever bundle goes on stage (engine/cli/numbers.ts), so a
  // re-dated stage day re-dates the rows that carried the old day and the bundle file they cite.
  const numbers =
    src.numbers?.map((n) => ({
      ...n,
      as_of_mt: n.as_of_mt === from ? to : n.as_of_mt,
      source: n.source.split(`bundle_${from}.json`).join(`bundle_${to}.json`),
    })) ?? null;
  return {
    ...src,
    numbers,
    bundles: { [to]: { bundle: b, file: `public/data/bundle_${to}.json` } },
  };
}

// The May to Oct history and its backtest end on Oct 27 whatever day is on stage, so their file
// name and window are not a trace of the old stage day. Everything else must move to the new day.
const HIST_FILE = /hist_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}/g;
const BACKTEST_WINDOW =
  /(<span data-time="">\d{4}-\d{2}-\d{2}<\/span>\s*to\s*)<span data-time="">\d{4}-\d{2}-\d{2}<\/span>/g;
function stageDayText(html: string): string {
  return html.replace(HIST_FILE, "hist_window").replace(BACKTEST_WINDOW, "$1<span>window end</span>");
}

describe("day switch", () => {
  it("renders a bundle re-dated to Oct 28 with no trace of Oct 27", () => {
    const oct28 = redate(data, "2026-10-27", "2026-10-28");
    for (const beat of BEATS) {
      const { container, unmount } = render(
        <App data={oct28} now={NOW} search={`?beat=${beat.id}&step=end&motion=off`} />,
      );
      const html = stageDayText(container.innerHTML);
      expect(html, `beat ${beat.id} renders the day`).not.toContain("failed-state");
      const header = container.querySelector("header")?.textContent;
      expect(header, `beat ${beat.id} header`).toContain("Oct 28, 2026");
      expect(html, `beat ${beat.id}`).not.toMatch(/Oct 27|2026-10-27|10\/27/);
      unmount();
    }
  });

  it("shows a failed state naming both files when ?day= points at a day with no bundle", () => {
    const { container } = render(<App data={data} now={NOW} search="?day=2026-10-01" />);
    expect(container.textContent).toContain("failed");
    expect(document.body.dataset.state).toBe("failed");
  });
});

/**
 * The header's day label and date for a stage day, worked out independently of the app: the day
 * the app resolves from the data (numbers.json, then the latest bundle) against NOW's calendar
 * date. NOW is noon in Denver, so its UTC date is its Mountain date.
 */
function expectedDay(stage: StageData, now: Date): { label: string; date: string } {
  const resolved = resolveStageDay(stage, "");
  if (resolved.state !== "ready") throw new Error(`fixture has no stage day: ${resolved.reason}`);
  const dayMs = Date.parse(`${resolved.day}T12:00:00Z`);
  const todayMs = Date.parse(`${now.toISOString().slice(0, 10)}T12:00:00Z`);
  const label =
    dayMs === todayMs
      ? "Today"
      : dayMs === todayMs + 24 * 3600 * 1000
        ? "Tomorrow (day-ahead)"
        : "Cached";
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dayMs));
  return { label, date };
}

describe("shell", () => {
  const stages: [string, StageData][] = [
    ["the stage day on disk", data],
    ["a stage day re-dated to Oct 28", redate(data, "2026-10-27", "2026-10-28")],
  ];
  for (const [name, stage] of stages) {
    it(`shows the day label for ${name}, node, snapshot time, the stub banner only while the stub runs, and the chip legend`, () => {
      const { container } = render(<App data={stage} now={NOW} search="" />);
      const text = container.textContent ?? "";
      const { label, date } = expectedDay(stage, NOW);
      expect(container.querySelector("header p")?.textContent).toBe(`${label} ${date}`);
      expect(text).toContain("ELAP_PACE-APND");
      expect(text).toMatch(/Snapshot, fetched .+ MT/);
      expect(text.includes("Engine stub: not engine output")).toBe(STUB_ACTIVE);
      expect(text).toContain("TORUS PUBLISHED: from Torus");
      // The slot is reserved either way, so the header never resizes.
      expect(container.querySelector('[data-slot="stub-banner"]')).toBeTruthy();
    });
  }

  it("drives the beats from the keyboard and keeps body hooks in step", () => {
    const { container } = render(<App data={data} now={NOW} search="?motion=off" />);
    expect(document.body.dataset.beat).toBe("1");
    act(() => {
      fireEvent.keyDown(window, { key: "2" });
    });
    act(() => {
      fireEvent.keyDown(window, { key: " " });
    });
    expect(document.body.dataset.step).toBe("end");
    expect(container.textContent).toContain("Battery on the off-peak rule");
    act(() => {
      fireEvent.keyDown(window, { key: "c" });
    });
    expect(document.body.dataset.beat).toBe("3");
    expect(document.body.dataset.state).toBe("call");
    expect(container.textContent).toContain("Simulated Rocky Mountain Power call");
    expect(container.textContent).toContain("Published calls by hour of day, Mountain time");
    expect(container.textContent).not.toContain("UTC");
    act(() => {
      fireEvent.keyDown(window, { key: "c" });
    });
    expect(container.textContent).toContain("Second press inside the refill window");
    act(() => {
      fireEvent.keyDown(window, { key: "?" });
    });
    expect(container.querySelector('[aria-label="Key map"]')).toBeTruthy();
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(container.querySelector('[aria-label="Key map"]')).toBeNull();
    act(() => {
      fireEvent.keyDown(window, { key: "r" });
    });
    expect(document.body.dataset.beat).toBe("1");
    expect(document.body.dataset.state).toBe("ready");
  });

  it("renders missing numbers.json keys as not computed, never 0", () => {
    const { container } = render(
      <App data={{ ...data, numbers: null }} now={NOW} search="?beat=2&step=end" />,
    );
    const cells = [...container.querySelectorAll('[data-num="fixed_usd_mw_day"]')];
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) expect(c.textContent).toBe("not computed");
  });
});
