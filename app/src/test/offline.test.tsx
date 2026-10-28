// @vitest-environment jsdom
// The offline guard (docs/lanes/ui.md section 4, core 11): snapshot mode makes no network
// request. The recorders are installed in vi.hoisted, before any stage module is imported.
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => {
  const log: { kind: "fetch" | "xhr" | "import"; target: string }[] = [];
  const target = (input: unknown): string =>
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : String((input as { url?: string } | null)?.url ?? input);
  const fetchRecorder = (input: unknown) => {
    log.push({ kind: "fetch", target: target(input) });
    return Promise.reject(new Error("offline guard: fetch is not allowed in snapshot mode"));
  };
  globalThis.fetch = fetchRecorder as typeof fetch;
  if (typeof window !== "undefined") window.fetch = fetchRecorder as typeof fetch;
  class XhrRecorder {
    open(_method: string, url: string | URL) {
      log.push({ kind: "xhr", target: target(url) });
    }
    send() {}
    setRequestHeader() {}
    abort() {}
    addEventListener() {}
    removeEventListener() {}
  }
  globalThis.XMLHttpRequest = XhrRecorder as unknown as typeof XMLHttpRequest;
  if (typeof window !== "undefined")
    window.XMLHttpRequest = XhrRecorder as unknown as typeof XMLHttpRequest;
  // Vite compiles import() into the module runner's dynamic request, which calls cachedRequest
  // with { isDynamicImport: true }. Wrap it on the live runner (vitest 5.0.3). If the hook is not
  // there, the self-test below fails, so the guard never passes by not looking.
  type Runner = { cachedRequest: (...a: unknown[]) => unknown };
  const runner = (globalThis as { __vitest_mocker__?: { moduleRunner?: Runner } })
    .__vitest_mocker__?.moduleRunner;
  let importHooked = false;
  if (runner && typeof runner.cachedRequest === "function") {
    const original = runner.cachedRequest.bind(runner);
    runner.cachedRequest = (...args: unknown[]) => {
      const meta = args[3] as { isDynamicImport?: boolean } | undefined;
      if (meta?.isDynamicImport) log.push({ kind: "import", target: String(args[0]) });
      return original(...args);
    };
    importHooked = true;
  }
  return { log, importHooked };
});

import { App } from "../App";
import { loadStageData } from "../data";
import { ALL_FLAGS_OFF, installMatchMedia, STAGE_NOW } from "./flagsOff";
import { findExternalUrls, isAllowedRequest, isScannedSource, scanStageSource } from "./netGuard";

beforeEach(() => {
  installMatchMedia();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: () => Promise.resolve() },
  });
});
afterEach(cleanup);

/** Recorded calls a snapshot build must not make. */
function violations() {
  return calls.log.filter((c) => c.kind === "import" || !isAllowedRequest(c.target));
}

const press = (key: string) =>
  act(() => {
    fireEvent.keyDown(window, { key });
  });

describe("offline guard: runtime", () => {
  it("the dynamic import recorder is live and catches an import() (self-test)", async () => {
    expect(calls.importHooked, "could not install the dynamic import recorder").toBe(true);
    const before = calls.log.length;
    const { loadLazy } = await import("./fixtures/lazy");
    await loadLazy();
    const seen = calls.log.slice(before).filter((c) => c.kind === "import");
    expect(seen.some((c) => c.target.endsWith("lazyTarget.ts"))).toBe(true);
    calls.log.splice(before);
  });

  it("steps through all six beats (Space, C, C, Right, E, B, the slider) with no fetch, XHR or dynamic import", async () => {
    calls.log.length = 0;
    const data = loadStageData();
    const { container } = render(
      <App data={data} now={STAGE_NOW} search="?motion=off" flags={ALL_FLAGS_OFF} />,
    );
    expect(document.body.dataset.beat).toBe("1");
    press("ArrowRight");
    expect(document.body.dataset.beat).toBe("2");
    press(" ");
    expect(document.body.dataset.step).toBe("end");
    press("c");
    expect(document.body.dataset.beat).toBe("3");
    expect(document.body.dataset.state).toBe("call");
    press("c");
    press("ArrowRight");
    expect(document.body.dataset.beat).toBe("4");
    press(" ");
    press("ArrowRight");
    expect(document.body.dataset.beat).toBe("5");
    press("e");
    const copy = [...container.querySelectorAll("button")].find((b) =>
      /Copy JSON/.test(b.textContent ?? ""),
    );
    expect(copy, "beat 5 Copy JSON button").toBeTruthy();
    await act(async () => {
      fireEvent.click(copy!);
    });
    press("b");
    press("ArrowRight");
    expect(document.body.dataset.beat).toBe("6");
    const slider = container.querySelector<HTMLInputElement>('input[type="range"]');
    expect(slider, "beat 6 fleet slider").toBeTruthy();
    act(() => {
      fireEvent.change(slider!, { target: { value: slider!.max } });
    });
    press("Home");
    press("+");
    press("End");
    press("ArrowRight");
    expect(document.body.dataset.step).toBe("end");
    // Let any effect-scheduled request land before reading the log.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(violations()).toEqual([]);
  });
});

describe("offline guard: static scan", () => {
  it("finds no http:// or https:// in app/index.html or app/src source", () => {
    const root = path.resolve(import.meta.dirname, "../../..");
    expect(scanStageSource(root)).toEqual([]);
  });

  it("the scanner catches a planted URL and skips tests and fixtures (self-test)", () => {
    expect(findExternalUrls('const a = 1;\nfetch("https://example.com/x");')).toEqual([
      { line: 2, url: "https://example.com/x" },
    ]);
    expect(findExternalUrls("<script src='http://cdn.example/a.js'>")).toHaveLength(1);
    expect(isScannedSource("app/src/beats/Ribbon.tsx")).toBe(true);
    expect(isScannedSource("app/src/test/flagsOff.ts")).toBe(true);
    expect(isScannedSource("app/src/beats/Ribbon.test.tsx")).toBe(false);
    expect(isScannedSource("app/src/test/fixtures/lazy.ts")).toBe(false);
  });

  it("allows only relative data/ and derived/ paths if a same-origin fetch fallback ever appears", () => {
    expect(isAllowedRequest("data/bundle_2026-10-27.json")).toBe(true);
    expect(isAllowedRequest("./derived/numbers.json")).toBe(true);
    for (const bad of [
      "https://example.com/data/x.json",
      "//example.com/data/x.json",
      "/data/x.json",
      "data/../secrets.json",
      "api/solve",
      "derived/",
    ])
      expect(isAllowedRequest(bad), bad).toBe(false);
  });
});
