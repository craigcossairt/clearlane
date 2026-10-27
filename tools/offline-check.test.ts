import { describe, expect, it } from "vitest";
import {
  BEAT_KEYS,
  classifyRequest,
  isSameOrigin,
  scanBundleText,
  summaryLine,
} from "./lib/offline-check.mjs";

const ORIGIN = "http://127.0.0.1:5123";

describe("isSameOrigin", () => {
  it("matches scheme, host and port", () => {
    expect(isSameOrigin(`${ORIGIN}/data/x.json`, ORIGIN)).toBe(true);
    expect(isSameOrigin("http://127.0.0.1:5124/data/x.json", ORIGIN)).toBe(
      false,
    );
    expect(isSameOrigin("http://localhost:5123/", ORIGIN)).toBe(false);
    expect(isSameOrigin("https://127.0.0.1:5123/", ORIGIN)).toBe(false);
  });

  it("treats an unparseable URL as not same-origin", () => {
    expect(isSameOrigin("not a url", ORIGIN)).toBe(false);
  });
});

describe("classifyRequest", () => {
  it("allows a same-origin asset", () => {
    expect(classifyRequest(`${ORIGIN}/assets/index.js`, ORIGIN).ok).toBe(true);
  });

  it("allows data: and blob: URLs, which never leave the page", () => {
    expect(classifyRequest("data:image/png;base64,AAAA", ORIGIN).ok).toBe(true);
    expect(classifyRequest(`blob:${ORIGIN}/1234`, ORIGIN).ok).toBe(true);
  });

  it("fails a request to another origin", () => {
    const v = classifyRequest("https://cdn.example.com/lib.js", ORIGIN);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/other origin/);
  });

  it("fails the planted .invalid URL", () => {
    const v = classifyRequest(
      "https://planted.offline-check.invalid/x.png",
      ORIGIN,
    );
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/other origin/);
  });

  it("fails any WebSocket, even to the same host", () => {
    const v = classifyRequest("ws://127.0.0.1:5123/hmr", ORIGIN);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/websocket/i);
  });

  it("fails a same-origin /api/ request in snapshot mode only", () => {
    const snap = classifyRequest(`${ORIGIN}/api/prices`, ORIGIN, {
      dataMode: "snapshot",
    });
    expect(snap.ok).toBe(false);
    expect(snap.reason).toMatch(/\/api\/.*snapshot/);
    expect(classifyRequest(`${ORIGIN}/api/prices`, ORIGIN).ok).toBe(false);
    expect(
      classifyRequest(`${ORIGIN}/api/prices`, ORIGIN, { dataMode: "live" }).ok,
    ).toBe(true);
  });

  it("does not mistake a data file path containing 'api' for /api/", () => {
    expect(classifyRequest(`${ORIGIN}/data/rapid.json`, ORIGIN).ok).toBe(true);
  });
});

describe("scanBundleText", () => {
  const levels = (text: string) =>
    scanBundleText(text).map((f) => [f.level, f.url]);

  it("fails an external URL in an html src attribute", () => {
    expect(
      levels(`<img src="https://planted.offline-check.invalid/x.png">`),
    ).toEqual([["FAIL", "https://planted.offline-check.invalid/x.png"]]);
  });

  it("fails an external stylesheet link and a protocol-relative script", () => {
    expect(
      levels(
        `<link rel="stylesheet" href="https://fonts.example.com/a.css"><script src="//cdn.example.com/x.js"></script>`,
      ),
    ).toEqual([
      ["FAIL", "https://fonts.example.com/a.css"],
      ["FAIL", "//cdn.example.com/x.js"],
    ]);
  });

  it("fails css url() and @import", () => {
    expect(
      levels(
        `@import "https://a.example.com/b.css";.x{background:url(https://a.example.com/i.png)}`,
      ),
    ).toEqual([
      ["FAIL", "https://a.example.com/b.css"],
      ["FAIL", "https://a.example.com/i.png"],
    ]);
  });

  it("fails js loaders: fetch, import(), new URL, sendBeacon, EventSource, WebSocket, XHR open", () => {
    const js = [
      `fetch("https://a.example.com/1")`,
      `import("https://a.example.com/2.js")`,
      `new URL("https://a.example.com/3")`,
      `navigator.sendBeacon("https://a.example.com/4")`,
      `new EventSource("https://a.example.com/5")`,
      `new WebSocket("wss://a.example.com/6")`,
      `x.open("GET","https://a.example.com/7")`,
      `createElement("img",{src:"https://a.example.com/8.png"})`,
    ].join(";");
    expect(scanBundleText(js).map((f) => f.level)).toEqual(
      Array(8).fill("FAIL"),
    );
  });

  it("lists an SVG namespace as INFO", () => {
    const [f] = scanBundleText(
      `createElementNS("http://www.w3.org/2000/svg","svg")`,
    );
    expect(f).toMatchObject({
      level: "INFO",
      url: "http://www.w3.org/2000/svg",
    });
    expect(f?.reason).toMatch(/namespace/);
  });

  it("lists a bundled data source string as INFO", () => {
    const [f] = scanBundleText(
      `{source:"https://www.eia.gov/opendata/",value:1}`,
    );
    expect(f).toMatchObject({
      level: "INFO",
      url: "https://www.eia.gov/opendata/",
    });
  });

  it("lists React's error-decoder link as INFO", () => {
    const [f] = scanBundleText(`var m="https://react.dev/errors/"+e`);
    expect(f).toMatchObject({
      level: "INFO",
      url: "https://react.dev/errors/",
    });
    expect(f?.reason).toMatch(/React/);
  });

  it("ignores JS comments and relative URLs", () => {
    expect(
      scanBundleText(`// see docs\nfetch("/data/x.json");<img src="./a.png">`),
    ).toEqual([]);
  });
});

describe("BEAT_KEYS", () => {
  it("covers beats 1 to 6 with the ui.md 6.8 keys", () => {
    expect(Object.keys(BEAT_KEYS)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(BEAT_KEYS[2]).toContain("Space");
    expect(BEAT_KEYS[3]).toEqual(["c", "c"]);
    expect(BEAT_KEYS[5]).toEqual(["e", "b"]);
    expect(BEAT_KEYS[6]).toEqual(["+", "End"]);
  });
});

describe("summaryLine", () => {
  it("passes with counts and the honest beat tally", () => {
    expect(summaryLine({ violations: 0, sameOrigin: 12, beatsDriven: 0 })).toBe(
      "PASS offline-check: 0 external requests, 12 same-origin, 0/6 beats",
    );
    expect(summaryLine({ violations: 0, sameOrigin: 40, beatsDriven: 6 })).toBe(
      "PASS offline-check: 0 external requests, 40 same-origin, 6/6 beats",
    );
  });

  it("fails with the violation count", () => {
    expect(summaryLine({ violations: 3, sameOrigin: 12, beatsDriven: 6 })).toBe(
      "FAIL offline-check: 3 violations",
    );
  });
});
