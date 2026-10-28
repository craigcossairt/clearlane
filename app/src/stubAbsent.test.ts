import { join } from "node:path";
import { build, type Plugin } from "vite";
import { describe, expect, it } from "vitest";
import { STUB_MARKER } from "./stub/marker";

/**
 * #83: the production build must not reach the stub. This runs the real vite build in memory
 * (the same config as `npm run build`, nothing written to dist/) and scans every emitted file
 * for the stub marker. A positive control flips STUB_ACTIVE to true in the build input and
 * requires the marker to show up, so a marker that stopped surviving the bundler cannot make
 * the real check pass by accident.
 */

const ROOT = join(import.meta.dirname, "..", "..");
const FLAG = /export const STUB_ACTIVE: boolean = false;/;

interface Emitted {
  fileName: string;
  text: string;
}

async function buildFiles(flipStubOn: boolean): Promise<Emitted[]> {
  const flip: Plugin = {
    name: "flip-stub-active",
    enforce: "pre",
    transform(code, id) {
      if (!id.replaceAll("\\", "/").endsWith("/app/src/engineClient.ts")) return null;
      if (!FLAG.test(code)) throw new Error("engineClient.ts no longer declares STUB_ACTIVE = false");
      return code.replace(FLAG, "export const STUB_ACTIVE: boolean = true;");
    },
  };
  const out = await build({
    configFile: join(ROOT, "vite.config.ts"),
    logLevel: "silent",
    plugins: flipStubOn ? [flip] : [],
    build: { write: false },
  });
  const outputs = (Array.isArray(out) ? out : [out]).flatMap((o) =>
    "output" in o ? o.output : [],
  );
  return outputs.map((o) => ({
    fileName: o.fileName,
    text:
      o.type === "chunk"
        ? o.code
        : typeof o.source === "string"
          ? o.source
          : Buffer.from(o.source).toString("utf8"),
  }));
}

describe("the production build and the stub (#83)", () => {
  it("control: with STUB_ACTIVE flipped on, the marker is in the build", async () => {
    const files = await buildFiles(true);
    expect(files.some((f) => f.text.includes(STUB_MARKER))).toBe(true);
  }, 120_000);

  it("stub absent from the production build: no emitted file carries the marker", async () => {
    const files = await buildFiles(false);
    expect(files.some((f) => f.fileName.endsWith(".js"))).toBe(true);
    expect(files.filter((f) => f.text.includes(STUB_MARKER)).map((f) => f.fileName)).toEqual([]);
  }, 120_000);
});
