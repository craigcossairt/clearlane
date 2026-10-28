// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseFacts } from "../../../tools/lib/facts.mjs";
import { App } from "../App";
import { mtDate } from "../components/Time";
import { COPY } from "../copy";
import { loadStageData } from "../data";
import type { FlagName } from "../flags";
import { LINEAGE_KEY } from "../keymap";
import { SCREENS } from "../presenter/model";
import { statusLabel } from "../proof/cards/CrossCheckCard";
import { loadProofSources, type CrossCheck } from "../proof/sources";
import {
  expectFlagsOffStage,
  installMatchMedia,
  SNAPSHOT_DIR,
  STAGE_NOW,
  stableHtml,
} from "../test/flagsOff";
import {
  crossCheckFor,
  FACTS_FILE,
  lineageFor,
  loadFactsRows,
  parseFactsRows,
  torusMatches,
} from "./lineage";
import { LineagePanel, LineageRows, type FactsState } from "./LineagePanel";

beforeEach(installMatchMedia);
afterEach(cleanup);

const data = loadStageData();
const numbers = data.numbers!;
const torus = data.torus;
const bundledCross = loadProofSources().crosscheck;
const cross = bundledCross.state === "ok" ? bundledCross.data : null;
const PRESENTER_ONLY: ReadonlySet<FlagName> = new Set(["ff_presenter"]);

const ALLOWED = "[data-num], [data-time], [data-axis], [data-copy-ok]";

/** Text nodes with a digit outside every allowed wrapper (the stage's digit rule). */
function strayDigits(root: Element): string[] {
  const out: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    if (!/\d/.test(text)) continue;
    if (!node.parentElement?.closest(ALLOWED)) out.push(text.trim());
  }
  return out;
}

const panel = () => document.querySelector<HTMLElement>(".lineage-panel");
const press = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key,
      ...init,
    });
  });
const keyedChip = (root: ParentNode, key?: string) =>
  [...root.querySelectorAll<HTMLElement>(".chip[data-lineage]")].find((c) => {
    const k = c.closest("[data-num]")?.getAttribute("data-num");
    return key ? k === key : !!k && k !== "live";
  })!;

function rowsFor(
  key: string,
  facts: FactsState,
  cc: CrossCheck | null = cross,
) {
  const n = numbers.find((x) => x.key === key)!;
  const l = lineageFor(
    { key, prov: n.prov, source: n.source },
    numbers,
    torus,
    cc,
  );
  return render(<LineageRows lineage={l} facts={facts} />).container;
}

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

  it("keeps chips out of the tab order, and I and Enter open nothing", () => {
    render(
      <App data={data} now={STAGE_NOW} search="?beat=5&step=end&motion=off" />,
    );
    const chips = document.querySelectorAll(".chip");
    expect(chips.length).toBeGreaterThan(0);
    for (const c of chips) {
      expect(c.hasAttribute("tabindex")).toBe(false);
      expect(c.hasAttribute("data-lineage")).toBe(false);
    }
    press("i");
    press("Enter");
    fireEvent.click(chips[0]!);
    expect(panel()).toBeNull();
    press("?");
    const dts = [...document.querySelectorAll(".keymap dt")].map(
      (d) => d.textContent,
    );
    expect(dts).not.toContain(LINEAGE_KEY.keyLabel);
  });
});

describe("number lineage data (#91)", () => {
  it("resolves every numbers.json key to a panel with a non-empty source", async () => {
    const rows = await loadFactsRows();
    expect(numbers.length).toBeGreaterThan(0);
    for (const n of numbers) {
      const c = rowsFor(n.key, { state: "ready", rows });
      expect(c.querySelector("[data-lineage-key]")?.textContent).toBe(n.key);
      expect(c.querySelector("[data-lineage-value]")?.textContent).toBe(
        n.display,
      );
      expect(
        c
          .querySelector("[data-lineage-class]")
          ?.getAttribute("data-lineage-class"),
      ).toBe(n.prov);
      const items = [...c.querySelectorAll("[data-lineage-source] li")];
      expect(items.length, n.key).toBeGreaterThan(0);
      for (const li of items)
        expect(li.textContent?.trim(), n.key).not.toBe("");
      expect(c.textContent).toContain(mtDate(n.as_of_mt));
      expect(c.querySelector("[data-facts-status]"), n.key).not.toBeNull();
      expect(strayDigits(c), n.key).toEqual([]);
      expect(c.textContent).not.toContain(String.fromCharCode(0x2014));
      cleanup();
    }
  });

  it("reads the same status and level for every key as the fact-ledger check does", () => {
    const md = readFileSync(
      path.resolve(import.meta.dirname, "../../..", FACTS_FILE),
      "utf8",
    );
    const ours = parseFactsRows(md);
    const theirs = parseFacts(md);
    for (const n of numbers) {
      const t = theirs.get(n.key);
      expect(t, `${n.key} is in ${FACTS_FILE}`).toBeDefined();
      expect(ours.get(n.key)?.status).toBe(t!.status);
      expect(ours.get(n.key)?.lvl).toBe(t!.lvl.match(/[1-5]/)?.[0]);
    }
  });

  it("gives each TORUS_PUBLISHED value its Torus page from torus_published.json", () => {
    const published = numbers.filter((n) => n.prov === "TORUS_PUBLISHED");
    expect(published.length).toBeGreaterThan(0);
    const urls = torus!.sources!.map((s) => s.url);
    for (const n of published) {
      const found = torusMatches(n, torus);
      expect(found, n.key).toHaveLength(1);
      expect(urls).toContain(found[0]!.ref.url);
      const c = rowsFor(n.key, { state: "loading" });
      expect(c.querySelector("[data-torus-url]")?.textContent).toBe(
        found[0]!.ref.url,
      );
      cleanup();
    }
    const mou = torusMatches(
      numbers.find((n) => n.key === "mou_70mw")!,
      torus,
    );
    expect(mou[0]!.field).toBe("mou_mw");
  });

  it("shows a cross-check only when crosscheck.json lists the key, with that file's status", () => {
    let listed = 0;
    for (const n of numbers) {
      const line = crossCheckFor(n.key, cross);
      const c = rowsFor(n.key, { state: "loading" });
      const shown = c.querySelector("[data-lineage-cross]");
      if (line) {
        listed++;
        expect(shown?.getAttribute("data-lineage-cross")).toBe(line.row.status);
        expect(shown?.textContent).toContain(statusLabel(line.row.status));
      } else {
        expect(shown, n.key).toBeNull();
        expect(c.textContent).not.toContain(COPY.lineageCross);
      }
      cleanup();
    }
    expect(listed).toBeGreaterThan(0);
    expect(crossCheckFor("clearlane_p50", cross)?.row.status).toBe("match");
    expect(crossCheckFor("clearlane_70", cross)?.row.status).toBe("mismatch");
  });

  it("never shows a missing or pending check as passed", () => {
    const empty: CrossCheck = {
      schema: "clearlane.science.crosscheck/v1",
      checks: {},
    };
    for (const cc of [empty, null]) {
      const c = rowsFor("clearlane_p50", { state: "loading" }, cc);
      expect(c.querySelector("[data-lineage-cross]")).toBeNull();
      expect(c.textContent).not.toContain(COPY.proofStatusMatch);
      cleanup();
    }
    const pending: CrossCheck = {
      schema: "clearlane.science.crosscheck/v1",
      checks: { other_name: { status: "pending", facts_key: "clearlane_p50" } },
    };
    const c = rowsFor("clearlane_p50", { state: "loading" }, pending);
    expect(c.querySelector("[data-lineage-cross]")?.textContent).toContain(
      COPY.proofStatusPending,
    );
    expect(c.textContent).not.toContain(COPY.proofStatusMatch);
  });

  it("says a live engine value has no numbers.json key, and gives no ledger row", () => {
    const l = lineageFor(
      { display: "$1.00", prov: "MEASURED", source: "engine on this laptop" },
      numbers,
      torus,
      cross,
    );
    const c = render(
      <LineageRows lineage={l} facts={{ state: "loading" }} />,
    ).container;
    expect(c.textContent).toContain(COPY.lineageLive);
    expect(c.querySelector("[data-lineage-key]")).toBeNull();
    expect(c.querySelector("[data-lineage-facts]")).toBeNull();
    expect(c.querySelector("[data-lineage-cross]")).toBeNull();
  });
});

describe("number lineage on the stage (#91, ff_lineage)", () => {
  const stage = (extra = "") =>
    render(
      <App
        data={data}
        now={STAGE_NOW}
        search={`?ff=lineage${extra}&beat=5&step=end&motion=off`}
      />,
    ).container;

  it("makes every chip focusable, and Enter, I or a click opens its lineage", async () => {
    const c = stage();
    const chips = [...c.querySelectorAll<HTMLElement>(".chip")];
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      expect(chip.getAttribute("tabindex")).toBe("0");
      expect(chip.getAttribute("role")).toBe("button");
    }
    const chip = keyedChip(c);
    const key = chip.closest("[data-num]")!.getAttribute("data-num");
    for (const open of [
      () => press("i"),
      () => press("Enter"),
      () => fireEvent.click(chip),
    ]) {
      chip.focus();
      open();
      expect(panel(), "panel opens").not.toBeNull();
      expect(panel()!.getAttribute("role")).toBe("dialog");
      expect(panel()!.querySelector("[data-lineage-key]")?.textContent).toBe(
        key,
      );
      await waitFor(() =>
        expect(
          panel()!.querySelector('[data-lineage-facts="ready"]'),
        ).not.toBeNull(),
      );
      expect(strayDigits(panel()!)).toEqual([]);
      press("Escape");
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(chip);
    }
  });

  it("holds the stage still while the panel is open, and keeps Tab inside it", () => {
    const c = stage();
    const chip = keyedChip(c);
    const beat = document.body.dataset.beat;
    chip.focus();
    press("i");
    for (const key of ["ArrowRight", "1", "r", "b", "?"]) press(key);
    expect(document.body.dataset.beat).toBe(beat);
    expect(document.querySelector(".keymap")).toBeNull();
    for (let i = 0; i < 6; i++) {
      press("Tab", { shiftKey: i % 2 === 0 });
      expect(panel()!.contains(document.activeElement)).toBe(true);
    }
    press("PageDown");
    expect(panel()).toBeNull();
    expect(document.body.dataset.beat).toBe(beat);
    expect(document.activeElement).toBe(chip);
  });

  it("closes from its Close button and from a click outside", () => {
    const c = stage();
    const chip = keyedChip(c);
    fireEvent.click(chip);
    fireEvent.click(
      panel()!.querySelector<HTMLButtonElement>(".lineage-close")!,
    );
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(chip);
    fireEvent.click(chip);
    fireEvent.click(document.querySelector(".lineage-backdrop")!);
    expect(panel()).toBeNull();
  });

  it("lists I in the ? overlay while the flag is on", () => {
    stage();
    press("?");
    const dts = [...document.querySelectorAll(".keymap dt")].map(
      (d) => d.textContent,
    );
    expect(dts).toContain(LINEAGE_KEY.keyLabel);
  });

  it("opens over the proof drawer, and Esc closes the panel before the drawer", () => {
    stage(",proof_drawer");
    press("p");
    const drawer = document.querySelector<HTMLElement>(".proof-drawer")!;
    expect(drawer).not.toBeNull();
    const chip = keyedChip(drawer);
    chip.focus();
    press("i");
    expect(panel()).not.toBeNull();
    expect(document.querySelector(".proof-drawer")).not.toBeNull();
    press("p");
    expect(document.querySelector(".proof-drawer")).not.toBeNull();
    press("Escape");
    expect(panel()).toBeNull();
    expect(document.querySelector(".proof-drawer")).not.toBeNull();
    expect(document.activeElement).toBe(chip);
    press("Escape");
    expect(document.querySelector(".proof-drawer")).toBeNull();
  });

  it("works in presenter mode, and the clicker's PageDown closes it without turning the screen", () => {
    render(
      <App
        data={data}
        now={STAGE_NOW}
        search="?ff=presenter,lineage&screen=6&step=end&motion=off"
      />,
    );
    const screen = document.body.dataset.screen;
    const chip = keyedChip(document);
    chip.focus();
    press("Enter");
    expect(panel()).not.toBeNull();
    press("PageDown");
    expect(panel()).toBeNull();
    expect(document.body.dataset.screen).toBe(screen);
  });

  it("renders nothing with the flag off, even when given a cross-check", () => {
    const { container } = render(
      <LineagePanel torus={torus} crosscheck={cross} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
