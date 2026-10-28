// Proposed, keyless grid-signal feed (stretch `lasso-feed`, flag off_lasso_feed). Lasso's API is not public, so
// this is a proposed shape, never an integration. A pure handler serves each route from the committed
// public/data and public/derived files: no network, no key, no server.
// Usage: npx tsx api/feed.ts --write-examples [--day 2026-10-27]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Bundle, Envelope, Provenance } from "../contracts/types";
import { lanes, systemCriticalHours } from "../engine/src/lanes";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_MODE = "snapshot";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface Cell<T> {
  value: T;
  prov: Provenance;
}
export interface FeedResponse {
  status: 200 | 404;
  body: Record<string, unknown>;
}

const notFound = (reason: string): FeedResponse => ({
  status: 404,
  body: { schema: "clearlane.feed.error/v1", data_mode: DATA_MODE, reason },
});

function readJson<T>(root: string, rel: string): T | null {
  const path = join(root, rel);
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as T)
    : null;
}

const cell = <T>(value: T, prov: Provenance): Cell<T> => ({ value, prov });

function signal(root: string, day: string): FeedResponse {
  const rel = `public/data/bundle_${day}.json`;
  const b = readJson<Bundle>(root, rel);
  if (!b)
    return notFound(
      `${rel} not found: no committed bundle for that operating day`,
    );
  const lane = lanes(b);
  const sch = systemCriticalHours(b);
  const critical = new Set(sch.hours);
  return {
    status: 200,
    body: {
      schema: "clearlane.feed.signal/v1",
      operating_day_mt: b.operating_day_mt,
      node: b.node,
      generated_utc: b.fetched_utc,
      data_mode: DATA_MODE,
      sch_rule: sch.label,
      rows: b.hours.map((h, i) => ({
        ts_utc: h.ts_utc,
        hour_mt: h.hour_mt,
        lane: cell(lane[i], "DERIVED"),
        system_critical: cell(critical.has(i), "DERIVED"),
        lmp_usd_mwh: cell(h.lmp_usd_mwh, h.prov.lmp),
        net_load_mw: cell(h.net_load_mw, "DERIVED"),
        co2_g_kwh: cell(h.co2_g_kwh, h.prov.co2),
      })),
      sources: [rel],
    },
  };
}

function envelope(root: string, day: string): FeedResponse {
  const rel = `public/derived/envelope_${day}.json`;
  const e = readJson<Envelope>(root, rel);
  if (!e)
    return notFound(
      `${rel} not found: the engine has not written an envelope for that operating day`,
    );
  return {
    status: 200,
    body: {
      schema: "clearlane.feed.envelope/v1",
      envelope_schema: e.schema,
      operating_day_mt: e.operating_day_mt,
      generated_utc: e.generated_utc,
      data_mode: DATA_MODE,
      fleet_kw: cell(e.fleet_kw, "SIMULATED"),
      sch_rule: e.sch_rule,
      rows: e.hours.map((h) => ({
        ts_utc: h.ts_utc,
        system_critical: cell(h.system_critical, "DERIVED"),
        reserve_kw: cell(h.reserve_kw, "DERIVED"),
        max_charge_kw: cell(h.max_charge_kw, "DERIVED"),
        max_discharge_kw: cell(h.max_discharge_kw, "DERIVED"),
        planned_kw: cell(h.planned_kw, "DERIVED"),
        reason: cell(h.reason, "DERIVED"),
      })),
      sources: [rel],
    },
  };
}

/** Pure router: GET path in, status and JSON body out. */
export function handle(path: string, root = ROOT): FeedResponse {
  const parts = path.replace(/^\/+|\/+$/g, "").split("/");
  if (parts[0] !== "v1" || parts.length < 3 || !DAY.test(parts[2]!)) {
    return notFound(
      `unknown route ${path}; routes are /v1/signal/{day}, /v1/envelope/{day}, /v1/fleet/{day}, /v1/envelope/{day}/2030.5`,
    );
  }
  const [, kind, day, extra] = parts as [
    string,
    string,
    string,
    string | undefined,
  ];
  if (kind === "signal" && parts.length === 3) return signal(root, day);
  if (kind === "envelope" && parts.length === 3) return envelope(root, day);
  if (kind === "envelope" && extra === "2030.5" && parts.length === 4) {
    return notFound(
      "no 2030.5-shaped export exists: the export-2030-5 item (#48) was cut before it shipped",
    );
  }
  if (kind === "fleet" && parts.length === 3) {
    const rel = `public/derived/fleet_${day}.json`;
    const fleet = readJson<Record<string, unknown>>(root, rel);
    if (!fleet)
      return notFound(
        `${rel} not found: the fleet-rollup item has not written a fleet file`,
      );
    return {
      status: 200,
      body: {
        schema: "clearlane.feed.fleet/v1",
        data_mode: DATA_MODE,
        generated_utc: fleet.generated_utc,
        fleet,
        sources: [rel],
      },
    };
  }
  return notFound(`unknown route ${path}`);
}

export const ROUTES = [
  "signal",
  "envelope",
  "fleet",
  "envelope_2030_5",
] as const;

export function examplePaths(
  day: string,
): Record<(typeof ROUTES)[number], string> {
  return {
    signal: `/v1/signal/${day}`,
    envelope: `/v1/envelope/${day}`,
    fleet: `/v1/fleet/${day}`,
    envelope_2030_5: `/v1/envelope/${day}/2030.5`,
  };
}

/** Writes api/examples/<route>_<day>.json with the status and body each route returns today. */
export function writeExamples(
  day: string,
  root = ROOT,
  outDir = join(root, "api", "examples"),
): string[] {
  mkdirSync(outDir, { recursive: true });
  return Object.entries(examplePaths(day)).map(([name, path]) => {
    const file = join(outDir, `${name}_${day}.json`);
    const { status, body } = handle(path, root);
    writeFileSync(file, JSON.stringify({ path, status, body }, null, 2) + "\n");
    return file;
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (!process.argv.includes("--write-examples")) {
    console.error(
      "usage: npx tsx api/feed.ts --write-examples [--day YYYY-MM-DD]",
    );
    process.exit(2);
  }
  const i = process.argv.indexOf("--day");
  const day = i >= 0 ? process.argv[i + 1]! : "2026-10-27";
  for (const file of writeExamples(day)) console.log(`wrote ${file}`);
}
