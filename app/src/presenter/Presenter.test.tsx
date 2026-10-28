// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { PRESENTER } from "../copy";
import { loadStageData } from "../data";
import {
  expectFlagsOffStage,
  installMatchMedia,
  STAGE_NOW,
} from "../test/flagsOff";
import { SCREENS } from "./model";

beforeEach(installMatchMedia);
afterEach(cleanup);

const data = loadStageData();

function renderPresenter(search: string) {
  return render(
    <App data={data} now={STAGE_NOW} search={`?ff=presenter&${search}`} />,
  );
}

const ALLOWED = "[data-num], [data-time], [data-axis], [data-copy-ok]";

/** Text nodes with a digit outside every allowed wrapper (the stage's digit rule). */
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

const body = () => document.body.dataset;
/** Visible text of an element without its provenance chips, whitespace collapsed. */
const spoken = (el: Element | null | undefined) => {
  if (!el) return "";
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(".chip").forEach((c) => c.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
};
const click = (root: HTMLElement, action: string) => {
  const el = root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
  if (!el) throw new Error(`no [data-action=${action}]`);
  fireEvent.click(el);
};

describe("presenter mode (#216, ff_presenter)", () => {
  it("leaves the six-beat stage unchanged with every flag off", async () => {
    await expectFlagsOffStage();
  });

  it("the stage never sets presenter mode without the flag", () => {
    const { container } = render(
      <App data={data} now={STAGE_NOW} search="?beat=2" />,
    );
    expect(container.querySelector('[data-mode="presenter"]')).toBeNull();
    expect(body().mode).toBeUndefined();
  });

  for (const s of SCREENS) {
    for (const step of ["start", "end"] as const) {
      it(`screen ${s.n} (${s.key}, ${step}) renders with every number in a Num`, () => {
        const q = step === "end" ? "&step=end" : "";
        const { container } = renderPresenter(`screen=${s.n}${q}&motion=off`);
        expect(container.querySelector(".failed-state")).toBeNull();
        expect(body().mode).toBe("presenter");
        expect(body().screen).toBe(String(s.n));
        const total = s.actions.length;
        const expected = total === 0 || step === "end" ? "end" : "start";
        expect(body().step).toBe(expected);
        expect(body().actions).toBe(String(step === "end" ? total : 0));
        expect(strayDigits(container)).toEqual([]);
        // Presenter copy names buttons, never keys.
        expect(container.textContent).not.toMatch(
          /\bPress\b|\bSpace\b|Right turns/,
        );
        expect(
          container.querySelector(`[aria-current="step"]`)?.textContent,
        ).toContain(s.label);
      });
    }
  }

  it("Next from Title reaches Close through every action in order", () => {
    const { container } = renderPresenter("motion=off");
    const seen: string[] = [`${body().screen}:${body().actions}`];
    for (let i = 0; i < 20; i++) {
      click(container, "next");
      const here = `${body().screen}:${body().actions}`;
      if (here === seen[seen.length - 1]) break;
      seen.push(here);
    }
    expect(seen).toEqual([
      "1:0",
      "2:0",
      "3:0",
      "3:1",
      "4:0",
      "4:1",
      "4:2",
      "5:0",
      "5:1",
      "6:0",
      "6:1",
      "7:0",
      "7:1",
      "8:0",
    ]);
  });

  it("the call screen lands the first call, then the second call's shortfall", () => {
    const { container } = renderPresenter("screen=4&motion=off");
    const second = () =>
      container.querySelector('[data-slot="second-call"]')!.textContent!;
    expect(
      container.querySelector('[data-slot="call-result"] .unavailable'),
    ).toBeTruthy();
    expect(second()).toBe(PRESENTER.secondPrompt);
    click(container, "action-call-now");
    expect(body().step).toBe("partial");
    expect(
      container.querySelector('[data-slot="call-result"] .unavailable'),
    ).toBeNull();
    expect(second()).toBe(PRESENTER.secondPrompt);
    click(container, "action-call-again");
    expect(body().step).toBe("end");
    expect(second()).toContain(PRESENTER.secondRule);
  });

  it("arriving on Re-plan by a segment click has both calls applied", () => {
    const { container } = renderPresenter("motion=off");
    const seg = [
      ...container.querySelectorAll<HTMLButtonElement>(".p-seg"),
    ][4]!;
    fireEvent.click(seg);
    expect(body().screen).toBe("5");
    expect(body().step).toBe("start");
    expect(
      container.querySelector(
        '[data-slot="replan-line"] [data-prov="MEASURED"]',
      ),
    ).toBeTruthy();
  });

  it("Back lands on the previous screen at its end state", () => {
    const { container } = renderPresenter("screen=5&motion=off");
    click(container, "back");
    expect(body().screen).toBe("4");
    expect(body().actions).toBe("2");
    expect(body().step).toBe("end");
  });

  it("the envelope screen shows the backtest, and a pill brings the envelope back", () => {
    const { container } = renderPresenter("screen=6&motion=off");
    expect(
      container.querySelector('[data-slot="envelope-strip"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-slot="headline"]')?.textContent,
    ).toBe(PRESENTER.envelopeHeadline);
    expect(PRESENTER.envelopeHeadline).toBe(
      "An hourly envelope Rocky Mountain Power could plan around.",
    );
    click(container, "action-backtest");
    expect(
      container.querySelector('[data-slot="backtest-bands"]'),
    ).toBeTruthy();
    // Pitch review: the count and the window, never "every day".
    const head = container.querySelector<HTMLElement>('[data-slot="headline"]')!;
    expect(spoken(head)).toBe("Backtested on 179 days, May 1 to Oct 27.");
    expect(container.textContent).toContain(
      "Each policy run on every day of the history with full data, beside the off-peak rule.",
    );
    expect(
      head.querySelector('[data-num="backtest_days"]')?.getAttribute("data-prov"),
    ).toBe("DERIVED");
    expect([...head.querySelectorAll("[data-time]")].map((e) => e.textContent)).toEqual([
      "May 1",
      "Oct 27",
    ]);
    expect(container.textContent).toContain(PRESENTER.showEnvelope);
    click(container, "action-backtest");
    expect(
      container.querySelector('[data-slot="envelope-strip"]'),
    ).toBeTruthy();
  });

  it("the scale screen starts at the MOU size and the 500 MW button moves the slider", () => {
    const { container } = renderPresenter("screen=7&motion=off");
    const slider = container.querySelector<HTMLInputElement>(
      'input[type="range"]',
    )!;
    const min = data.numbers!.find((n) => n.key === "mou_70mw")!.value;
    const max = data.numbers!.find((n) => n.key === "torus_500mw")!.value;
    expect(Number(slider.value)).toBe(min);
    click(container, "action-fleet-max");
    expect(Number(slider.value)).toBe(max);
    fireEvent.change(slider, { target: { value: "250" } });
    expect(Number(slider.value)).toBe(250);
  });

  it("returns focus to the stage container after a button click", () => {
    const { container } = renderPresenter("screen=4&motion=off");
    const button = container.querySelector<HTMLButtonElement>(
      '[data-action="action-call-now"]',
    )!;
    button.focus();
    fireEvent.click(button);
    expect(document.activeElement).toBe(container.querySelector(".p-viewport"));
  });

  it("binds Right, PageDown, Left, PageUp and Home, and not the stage keys", () => {
    renderPresenter("screen=2&motion=off");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(body().screen).toBe("3");
    fireEvent.keyDown(window, { key: "PageDown" });
    expect(body().actions).toBe("1");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(body().screen).toBe("2");
    fireEvent.keyDown(window, { key: "PageUp" });
    expect(body().screen).toBe("1");
    fireEvent.keyDown(window, { key: "PageDown" });
    fireEvent.keyDown(window, { key: "4" });
    fireEvent.keyDown(window, { key: "c" });
    expect(body().screen).toBe("2");
    fireEvent.keyDown(window, { key: "Home" });
    expect(body().screen).toBe("1");
  });

  it("? shows the four presenter keys only", () => {
    const { container } = renderPresenter("motion=off");
    fireEvent.keyDown(window, { key: "?" });
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.querySelectorAll("dt")).toHaveLength(4);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("the Sources pill opens the chip legend and every screen's sources", () => {
    const { container } = renderPresenter("screen=3&motion=off");
    click(container, "sources");
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("REAL: measured market data.");
    expect(dialog.querySelectorAll("li")).toHaveLength(SCREENS.length);
  });

  it("the footer names the operating day on every screen", () => {
    for (const s of SCREENS) {
      const { container, unmount } = renderPresenter(
        `screen=${s.n}&motion=off`,
      );
      expect(container.querySelector(".p-day")?.textContent).toContain(
        "Oct 27, 2026",
      );
      unmount();
    }
  });
});

describe("presenter race screen (#216)", () => {
  it("shows the buy, sell and keep arithmetic from the start", () => {
    const { container } = renderPresenter("screen=3&motion=off");
    const card = (p: string) =>
      [...container.querySelectorAll(`[data-card="${p}"] .figure`)].map(
        (e) => e.textContent,
      );
    expect(card("fixed_overnight")).toEqual([
      "$20.06",
      "2.132 MWh",
      "$39.53",
      "$84",
      "1.876 MWh",
      "$55.62",
      "$104",
      "$20",
    ]);
    expect(card("clearlane")).toEqual([
      "$58.41",
      "2.132 MWh",
      "$21.55",
      "$46",
      "1.876 MWh",
      "$55.62",
      "$104",
      "$58",
    ]);
    const provs = [
      ...container.querySelectorAll('[data-card="clearlane"] [data-num]'),
    ].map((e) => e.getAttribute("data-prov"));
    expect(provs).toEqual([
      "DERIVED",
      "ASSUMPTION",
      "DERIVED",
      "DERIVED",
      "ASSUMPTION",
      "DERIVED",
      "DERIVED",
      "DERIVED",
    ]);
    expect(
      container.querySelector(".p-headline [data-num='race_ratio'] .figure")
        ?.textContent,
    ).toBe("2.9x");
    expect(
      spoken(container.querySelector('[data-slot="headline"]')),
    ).toBe("Filling up at midday is worth 2.9x the off-peak rule.");
    expect(
      [...container.querySelectorAll(".p-keep-label")].map((e) => e.textContent),
    ).toEqual([
      "value to RMP's system per MW per day, higher is better",
      "value to RMP's system per MW per day, higher is better",
    ]);
    expect(
      [...container.querySelectorAll(".p-arith-keep th")].map((e) => e.textContent),
    ).toEqual(["Net", "Net"]);
  });

  it("marks buy and sell hours, outlined before the replay and filled after", () => {
    const { container } = renderPresenter("screen=3&motion=off");
    const filled = () =>
      [...container.querySelectorAll("[data-mark]")].map((e) =>
        e.getAttribute("data-filled"),
      );
    expect(filled()).toHaveLength(4 + 2 + 3 + 2);
    expect(new Set(filled())).toEqual(new Set(["false"]));
    click(container, "action-replay");
    expect(new Set(filled())).toEqual(new Set(["true"]));
    const buys = [
      ...container.querySelectorAll('[data-row="clearlane"] [data-mark="buy"]'),
    ];
    expect(buys).toHaveLength(3);
  });

  it("Next during a running replay jumps it to its end; the next Next leaves the screen", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    const { container } = render(
      <App
        data={data}
        now={STAGE_NOW}
        search="?ff=presenter&screen=3"
        reducedMotion={false}
      />,
    );
    act(() => click(container, "next"));
    expect(body().actions).toBe("1");
    expect(body().state).toBe("playing");
    expect(
      container.querySelector("[data-replay]")?.getAttribute("data-replay"),
    ).toBe("running");
    act(() => click(container, "next"));
    expect(body().screen).toBe("3");
    expect(body().state).toBe("ready");
    expect(
      container.querySelector("[data-replay]")?.getAttribute("data-replay"),
    ).toBe("done");
    act(() => click(container, "next"));
    expect(body().screen).toBe("4");
  });
});
