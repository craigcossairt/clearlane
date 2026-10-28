// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { NumbersContext } from "../components/Num";
import { COPY } from "../copy";
import { loadStageData } from "../data";
import { FlagsContext, type FlagName } from "../flags";
import { KEYMAP, lookup, RESERVED_KEYS, STRETCH_KEYMAP } from "../keymap";
import * as F from "../test/fixtures/proof";
import {
  ALL_FLAGS_OFF,
  endStateSearch,
  expectFlagsOffStage,
  installMatchMedia,
  STAGE_NOW,
} from "../test/flagsOff";
import { ProofCard, ProofDrawer } from "./ProofDrawer";
import {
  assembleProof,
  loadProofSources,
  PROOF_FILES,
  type ProofCardId,
  type ProofSources,
} from "./sources";

beforeEach(installMatchMedia);
afterEach(cleanup);

const data = loadStageData();
const ON: ReadonlySet<FlagName> = new Set(["ff_proof_drawer"]);
const ALLOWED = "[data-num], [data-time], [data-axis], [data-copy-ok]";

function renderStage(
  beat: 1 | 2 | 3 | 4 | 5 | 6,
  flags: ReadonlySet<FlagName>,
) {
  return render(
    <App
      data={data}
      now={STAGE_NOW}
      search={endStateSearch(beat)}
      flags={flags}
    />,
  );
}

function renderDrawer(sources: ProofSources) {
  return render(
    <NumbersContext.Provider value={{ state: "ready", numbers: data.numbers }}>
      <FlagsContext.Provider value={ON}>
        <ProofDrawer sources={sources} />
      </FlagsContext.Provider>
    </NumbersContext.Provider>,
  );
}

/** A key pressed wherever focus is, bubbling to window the way the browser sends it. */
function press(key: string) {
  act(() => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key });
  });
}

const drawer = () => screen.queryByRole("dialog", { name: COPY.proofTitle });

function openDrawer(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: COPY.proofPill }));
  const d = drawer();
  if (!d) throw new Error("drawer did not open");
  return d;
}

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

/** Per card: its glob key, a file of the expected shape and one of another shape. */
const FIXTURES: Record<ProofCardId, { key: string; ok: string; unknown: string }> = {
  stepStats: { key: F.STEP_STATS_KEY, ok: F.STEP_STATS_OK, unknown: F.UNKNOWN_STEP_STATS },
  backtest: { key: F.BACKTEST_KEY, ok: F.BACKTEST_OK, unknown: F.UNKNOWN_BACKTEST },
  crosscheck: { key: F.CROSSCHECK_KEY, ok: F.CROSSCHECK_OK, unknown: F.UNKNOWN_CROSSCHECK },
};
const IDS = Object.keys(PROOF_FILES) as ProofCardId[];
const every = (pick: (f: (typeof FIXTURES)[ProofCardId]) => string) =>
  Object.fromEntries(IDS.map((id) => [FIXTURES[id].key, pick(FIXTURES[id])]));

describe("proof sources", () => {
  it("a missing file is the empty state", () => {
    const s = assembleProof({});
    for (const id of IDS) expect(s[id]).toEqual({ state: "empty", file: PROOF_FILES[id] });
  });

  it("a file that does not parse is broken", () => {
    const s = assembleProof(every(() => F.BROKEN_TEXT));
    for (const id of IDS) expect(s[id].state, id).toBe("broken");
  });

  it("a file of another shape is unknown, with the reason", () => {
    const s = assembleProof(every((f) => f.unknown));
    for (const id of IDS) {
      const src = s[id];
      expect(src.state, id).toBe("unknown");
      if (src.state === "unknown") expect(src.reason.length, id).toBeGreaterThan(0);
    }
  });

  it("files of the expected shape are ok", () => {
    const s = assembleProof(every((f) => f.ok));
    for (const id of IDS) expect(s[id].state, id).toBe("ok");
  });

  it("every card wired in this build reads a file that is on main and parses", () => {
    const s = loadProofSources();
    for (const id of IDS) expect(s[id].state, `${id}: ${s[id].file}`).toBe("ok");
  });
});

describe("proof drawer with every flag off", () => {
  it("shows no pill, and P does nothing", () => {
    renderStage(3, ALL_FLAGS_OFF);
    expect(screen.queryByRole("button", { name: COPY.proofPill })).toBeNull();
    press("p");
    expect(drawer()).toBeNull();
    expect(document.querySelector(".proof-drawer")).toBeNull();
  });

  it("leaves the six-beat snapshots and every pinned number unchanged", async () => {
    await expectFlagsOffStage();
  });
});

describe("proof drawer with ff_proof_drawer on", () => {
  it("opens from the visible Proof pill", () => {
    renderStage(1, ON);
    openDrawer();
    expect(drawer()).not.toBeNull();
  });

  it("P opens it over the current beat; Esc closes it and returns focus", () => {
    renderStage(3, ON);
    const beatButton = screen.getByRole("button", { name: "Envelope" });
    beatButton.focus();
    press("p");
    expect(drawer()).not.toBeNull();
    expect(document.body.dataset.beat).toBe("3");
    expect(drawer()!.contains(document.activeElement)).toBe(true);
    press("Escape");
    expect(drawer()).toBeNull();
    expect(document.activeElement).toBe(beatButton);
    expect(document.body.dataset.beat).toBe("3");
  });

  it("P toggles it closed again", () => {
    renderStage(2, ON);
    press("P");
    expect(drawer()).not.toBeNull();
    press("p");
    expect(drawer()).toBeNull();
  });

  it("beat keys do not move the stage underneath it", () => {
    renderStage(3, ON);
    press("p");
    press("ArrowRight");
    press("r");
    press("5");
    expect(document.body.dataset.beat).toBe("3");
    press("Escape");
    press("ArrowRight");
    expect(document.body.dataset.beat).toBe("4");
  });

  it("renders one card per file on main, each with hand-written SVG and chips", () => {
    renderStage(5, ON);
    const d = openDrawer();
    const cards = [...d.querySelectorAll("[data-card]")];
    expect(cards.map((c) => c.getAttribute("data-card"))).toEqual(
      Object.keys(PROOF_FILES),
    );
    for (const card of cards) {
      const id = card.getAttribute("data-card");
      expect(card.getAttribute("data-card-state"), `${id} state`).toBe("ok");
      expect(card.querySelector("svg"), `${id} svg`).not.toBeNull();
      expect(card.querySelector(".chip"), `${id} chip`).not.toBeNull();
    }
  });

  it("every figure in the drawer carries its provenance chip", () => {
    renderStage(5, ON);
    const d = openDrawer();
    const nums = [...d.querySelectorAll('[data-num-state="ok"]')];
    expect(nums.length).toBeGreaterThan(0);
    for (const n of nums)
      expect(n.querySelector(".chip"), n.textContent ?? "").not.toBeNull();
    expect(d.querySelectorAll('[data-num-state="not-computed"]')).toHaveLength(
      0,
    );
  });

  it("has no digit outside a number, time, axis label or copy-ok span", () => {
    renderStage(5, ON);
    expect(strayDigits(openDrawer())).toEqual([]);
  });

  it("the backtest card draws each policy's P10 to P90 as a band, with the pinned Clearlane keys", () => {
    renderStage(5, ON);
    const card = openDrawer().querySelector('[data-card="backtest"]')!;
    const bands = [...card.querySelectorAll("rect[data-band]")];
    expect(bands.map((b) => b.getAttribute("data-band"))).toEqual([
      "fixed_overnight",
      "price_only",
      "clearlane",
    ]);
    for (const b of bands)
      expect(Number(b.getAttribute("width"))).toBeGreaterThan(0);
    for (const k of [
      "clearlane_p10",
      "clearlane_p50",
      "clearlane_p90",
      "backtest_days",
    ]) {
      expect(
        card.querySelector(`[data-num="${k}"]`)?.getAttribute("data-num-state"),
        k,
      ).toBe("ok");
    }
    expect(card.textContent).toContain(COPY.proofBaseline);
  });

  it("the ? overlay lists P while the flag is on, and only then", () => {
    renderStage(1, ON);
    press("?");
    const on = screen.getByRole("dialog", { name: "Key map" });
    expect(within(on).getByText("P")).toBeTruthy();
    cleanup();
    renderStage(1, ALL_FLAGS_OFF);
    press("?");
    const off = screen.getByRole("dialog", { name: "Key map" });
    expect(within(off).queryByText("P")).toBeNull();
  });
});

describe("proof card states", () => {
  it("an absent file's card does not render", () => {
    renderDrawer(assembleProof({ [F.CROSSCHECK_KEY]: F.CROSSCHECK_OK }));
    const d = openDrawer();
    expect(d.querySelector('[data-card="backtest"]')).toBeNull();
    expect(d.querySelector('[data-card="crosscheck"]')).not.toBeNull();
  });

  it("with every file absent the drawer says so instead of showing blank cards", () => {
    renderDrawer(assembleProof({}));
    const d = openDrawer();
    expect(d.querySelectorAll("[data-card]")).toHaveLength(0);
    expect(d.textContent).toContain(COPY.proofNone);
  });

  it("broken and unknown files render distinct states that name the file", () => {
    renderDrawer(
      assembleProof({
        [F.BACKTEST_KEY]: F.BROKEN_TEXT,
        [F.CROSSCHECK_KEY]: F.UNKNOWN_CROSSCHECK,
      }),
    );
    const d = openDrawer();
    const broken = d.querySelector('[data-card="backtest"]')!;
    const unknown = d.querySelector('[data-card="crosscheck"]')!;
    expect(broken.getAttribute("data-card-state")).toBe("broken");
    expect(unknown.getAttribute("data-card-state")).toBe("unknown");
    expect(broken.textContent).toContain(COPY.proofBroken);
    expect(unknown.textContent).toContain(COPY.proofUnknown);
    expect(broken.textContent).toContain(PROOF_FILES.backtest);
    expect(unknown.textContent).toContain(PROOF_FILES.crosscheck);
    expect(broken.querySelector("svg")).toBeNull();
  });

  it("the empty state is its own state with its own words", () => {
    render(
      <ProofCard
        id="backtest"
        title="t"
        source={{ state: "empty", file: PROOF_FILES.backtest }}
      >
        {() => null}
      </ProofCard>,
    );
    const card = document.querySelector('[data-card="backtest"]')!;
    expect(card.getAttribute("data-card-state")).toBe("empty");
    expect(card.textContent).toContain(COPY.proofEmpty);
    expect(
      new Set([COPY.proofEmpty, COPY.proofBroken, COPY.proofUnknown]).size,
    ).toBe(3);
  });
});

describe("cross-check card", () => {
  it("counts each status and shows a mismatch beside its second path", () => {
    renderDrawer(assembleProof({ [F.CROSSCHECK_KEY]: F.CROSSCHECK_OK }));
    const card = openDrawer().querySelector('[data-card="crosscheck"]')!;
    const count = (status: string) =>
      card.querySelector(`[data-status-count="${status}"] .figure`)
        ?.textContent;
    expect(count("match")).toBe("2");
    expect(count("mismatch")).toBe("1");
    expect(count("pending")).toBe("1");
    const row = card.querySelector('[data-check="d_off"]')!;
    expect(row.textContent).toContain("58.4053");
    expect(row.textContent).toContain("58.40968");
    expect(row.textContent).toContain("58.40534");
    expect(row.textContent).toContain(COPY.proofSecondPathPasses);
    expect(card.querySelectorAll("rect[data-status]")).toHaveLength(4);
  });
});

describe("stretch keys", () => {
  it("P is a reserved stretch key behind ff_proof_drawer, never bound in the core map", () => {
    const p = STRETCH_KEYMAP.find((b) => b.flag === "ff_proof_drawer");
    expect(p?.key).toBe("p");
    for (const b of STRETCH_KEYMAP) {
      expect(RESERVED_KEYS as readonly string[]).toContain(b.key);
      for (const beat of [1, 2, 3, 4, 5, 6])
        expect(lookup(b.key, beat)).toBeNull();
      expect(KEYMAP.some((k) => k.keys.includes(b.key))).toBe(false);
    }
  });
});

describe("step-stats card", () => {
  const card = () => {
    renderDrawer(assembleProof({ [F.STEP_STATS_KEY]: F.STEP_STATS_OK }));
    return openDrawer().querySelector('[data-card="stepStats"]')!;
  };
  const days = (c: Element, month: string, hb: number) =>
    c.querySelector(`[data-hist="${month}"] rect[data-hour="${hb}"]`)?.getAttribute("data-days");

  it("draws October and July step hours from per_day, only inside each window", () => {
    const c = card();
    expect(days(c, "october", 18)).toBe("2");
    expect(days(c, "october", 17)).toBe("1");
    expect(days(c, "october", 6)).toBe("1");
    expect(days(c, "july", 14)).toBe("1");
    // 2026-07-31 is outside the July window [07-01, 07-30].
    expect(days(c, "july", 18)).toBe("0");
    expect(c.querySelectorAll("[data-hist] rect[data-hour]")).toHaveLength(48);
  });

  it("shades the target hours as a band on both months", () => {
    const c = card();
    const bands = c.querySelectorAll('rect[data-band="target-hours"]');
    expect(bands).toHaveLength(2);
    for (const b of bands) expect(Number(b.getAttribute("width"))).toBeGreaterThan(0);
  });

  it("shows the tests with chips: binomial k of n and p, permutation hits of draws and p", () => {
    const c = card();
    const fig = (sel: string) => c.querySelector(`${sel} .figure`)?.textContent;
    expect(fig('[data-stat="october-k"]')).toBe("3");
    expect(fig('[data-stat="october-n"]')).toBe("4");
    expect(fig('[data-stat="october-p"]')).toBe("0.0012");
    expect(fig('[data-stat="perm-hits"]')).toBe("3");
    expect(fig('[data-stat="perm-draws"]')).toBe("1,000");
    expect(fig('[data-stat="perm-p"]')).toBe("0.004");
    expect(fig('[data-stat="repro-match"]')).toBe("2");
    expect(fig('[data-stat="repro-total"]')).toBe("3");
    expect(c.querySelectorAll('[data-month]')).toHaveLength(2);
    expect(strayDigits(c)).toEqual([]);
  });

  it("writes a tiny p-value in powers of ten, never as zero", async () => {
    const { pValue } = await import("./cards/StepStatsCard");
    expect(pValue(7.867257622032662e-23)).toBe("7.9 × 10⁻²³");
    expect(pValue(9.99990000099999e-6)).toBe("1.0 × 10⁻⁵");
    expect(pValue(0.012776650692456148)).toBe("0.013");
    expect(pValue(0.0012)).toBe("0.0012");
  });
});

describe("proof drawer in presenter mode", () => {
  it("sits next to Sources in the footer, opens, and Esc hands focus back to the presenter", () => {
    const { container } = render(
      <App
        data={data}
        now={STAGE_NOW}
        search="?ff=presenter,proof_drawer&screen=3&motion=off"
      />,
    );
    const nav = container.querySelector<HTMLElement>(".p-nav")!;
    const buttons: HTMLElement[] = [...nav.querySelectorAll("button")];
    const sources = nav.querySelector<HTMLButtonElement>('[data-action="sources"]')!;
    const proof = within(nav).getByRole("button", { name: COPY.proofPill });
    expect(buttons.indexOf(proof)).toBe(buttons.indexOf(sources) + 1);
    expect(proof.className).toContain("p-pill");
    const where = () => `${document.body.dataset.screen}/${document.body.dataset.actions}`;
    const start = where();
    fireEvent.click(proof);
    expect(drawer()).not.toBeNull();
    press("ArrowRight");
    expect(where()).toBe(start);
    press("Escape");
    expect(drawer()).toBeNull();
    expect(document.activeElement?.getAttribute("data-mode")).toBe("presenter");
    press("ArrowRight");
    expect(where()).not.toBe(start);
  });
});
