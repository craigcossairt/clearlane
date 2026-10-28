// The flag-off harness (docs/lanes/ui.md section 4, core 11). Every stretch PR calls
// expectFlagsOffStage() from its own test, so no stretch item can move the core stage without a
// red test. It renders each beat's end state with every ff_* flag forced off, compares the DOM
// with app/src/__snapshots__/beat<N>.html, and checks every numbers.json value on screen against
// its pinned display string.
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import path from "node:path";
import { expect } from "vitest";
import { App, BEATS, type BeatId } from "../App";
import { loadStageData, type StageData } from "../data";
import { FLAGS } from "@contracts/flags";
import type { FlagName } from "../flags";

/** The laptop clock the snapshots are taken at: the Oct 27 stage day, midday Mountain time. */
export const STAGE_NOW = new Date("2026-10-27T18:00:00Z");

/** No flag on, whatever contracts/flags.ts defaults to. */
export const ALL_FLAGS_OFF: ReadonlySet<FlagName> = new Set();

export const SNAPSHOT_DIR = `${path.resolve(import.meta.dirname, "../__snapshots__")}/`;

export const MASK_MEASURED = "[masked: MEASURED]";
export const MASK_GENERATED = "[masked: generated_utc]";

/** jsdom has no matchMedia; report reduced motion so every beat lands on its end state. */
export function installMatchMedia(): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

export function endStateSearch(beat: BeatId): string {
  return `?beat=${beat}&step=end&motion=off`;
}

/** Render one beat's end state with every flag off. The caller unmounts (or calls cleanup). */
export function renderFlagsOff(beat: BeatId, data: StageData = loadStageData()) {
  return render(
    createElement(App, {
      data,
      now: STAGE_NOW,
      search: endStateSearch(beat),
      flags: ALL_FLAGS_OFF,
    }),
  );
}

/**
 * The DOM as stable text. MEASURED values (timed live on the machine) and generated_utc are
 * masked; everything else, including SIMULATED engine output, must match exactly.
 */
export function stableHtml(root: Element): string {
  const copy = root.cloneNode(true) as Element;
  for (const el of copy.querySelectorAll('[data-prov="MEASURED"] .figure')) {
    el.textContent = MASK_MEASURED;
  }
  for (const el of copy.querySelectorAll("[data-generated-utc]")) {
    el.setAttribute("data-generated-utc", MASK_GENERATED);
    el.textContent = MASK_GENERATED;
  }
  return copy.innerHTML
    .replace(/("generated_utc"\s*:\s*)"[^"]*"/g, `$1"${MASK_GENERATED}"`)
    .replace(/(generated_utc=)"[^"]*"/g, `$1"${MASK_GENERATED}"`)
    .replace(/></g, ">\n<")
    .concat("\n");
}

/** Every numbers.json value on screen shows its pinned display string; returns the mismatches. */
export function pinnedNumberMismatches(root: Element, data: StageData): string[] {
  const out: string[] = [];
  const byKey = new Map((data.numbers ?? []).map((n) => [n.key, n]));
  for (const el of root.querySelectorAll("[data-num]")) {
    const key = el.getAttribute("data-num");
    if (!key || key === "live") continue;
    const pinned = byKey.get(key);
    const state = el.getAttribute("data-num-state");
    if (!pinned) {
      if (state !== "not-computed") out.push(`${key}: not in numbers.json but renders as ${state}`);
      continue;
    }
    const shown = el.querySelector(".figure")?.textContent;
    if (state !== "ok" || shown !== pinned.display)
      out.push(`${key}: shows ${JSON.stringify(shown ?? state)}, pinned ${JSON.stringify(pinned.display)}`);
    if (el.getAttribute("data-prov") !== pinned.prov)
      out.push(`${key}: chip ${el.getAttribute("data-prov")}, pinned ${pinned.prov}`);
  }
  return out;
}

/**
 * The check every stretch PR runs: the six beats with every flag off still match the stored
 * snapshots and the pinned numbers. Call it inside an `it`, after installMatchMedia().
 */
export async function expectFlagsOffStage(data: StageData = loadStageData()): Promise<void> {
  expect(Object.keys(FLAGS).filter((f) => ALL_FLAGS_OFF.has(f as FlagName))).toEqual([]);
  for (const { id } of BEATS) {
    const { container, unmount } = renderFlagsOff(id, data);
    try {
      expect(container.querySelector(".failed-state"), `beat ${id} renders`).toBeNull();
      expect(document.body.dataset.beat, `beat ${id} deep link`).toBe(String(id));
      expect(pinnedNumberMismatches(container, data), `beat ${id} pinned numbers`).toEqual([]);
      await expect(stableHtml(container)).toMatchFileSnapshot(`${SNAPSHOT_DIR}beat${id}.html`);
    } finally {
      unmount();
      cleanup();
    }
  }
}
