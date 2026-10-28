// Writes public/derived/scale_curve.json (moonshot #73, flag ff_price_impact): value per MW at 70, 140,
// 250 and 500 MW when the fleet moves prices, with the price-response slope's interval as a band.
// Nothing in the six beats runs this; running it is the flag. No core file is read for writing.
// Usage: npx tsx engine/cli/scale.ts [--response public/data/response_tables.json] [--bundle file]
//          [--snapshot research/data/pace_snapshot_2026-10-27.csv] [--out public/derived/scale_curve.json] [--now iso]
// The bundle defaults to the one public/derived/numbers.json was built from, so the curve sits on the
// stage day. A missing or unusable input exits 2.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { stableJson } from "../src/json";
import { snapshotPricesFromCsv } from "../src/numbers";
import { readPriceResponse, scaleCurve } from "../src/scale";
import { argValue } from "./args";
import { nowUtc, readBundle } from "./common";

const rel = (p: string) => p.replace(/\\/g, "/");
const fail = (msg: string): never => {
  console.error(msg);
  process.exit(2);
};
const readText = (f: string, what: string) =>
  existsSync(f) ? readFileSync(f, "utf8") : fail(`${what} not found: ${f}`);

// The bundle named in numbers.json's sources (exactly one public/data/bundle_<day>.json).
function stageBundle(numbersFile: string): string {
  const days = new Set(
    [
      ...readText(numbersFile, "numbers.json").matchAll(
        /public\/data\/bundle_(\d{4}-\d{2}-\d{2})\.json/g,
      ),
    ].map((m) => m[1]),
  );
  if (days.size !== 1)
    fail(
      `${numbersFile} names ${days.size} bundles; pass --bundle public/data/bundle_<day>.json`,
    );
  return `public/data/bundle_${[...days][0]}.json`;
}

const responsePath = rel(
  argValue("--response") ?? "public/data/response_tables.json",
);
const bundlePath = rel(
  argValue("--bundle") ?? stageBundle("public/derived/numbers.json"),
);
const snapshotPath = rel(
  argValue("--snapshot") ?? "research/data/pace_snapshot_2026-10-27.csv",
);
const out = argValue("--out") ?? "public/derived/scale_curve.json";

const bundle = readBundle(bundlePath);
let response: ReturnType<typeof readPriceResponse>;
try {
  response = readPriceResponse(
    JSON.parse(readText(responsePath, "response table (#47)")),
    responsePath,
  );
} catch (err) {
  fail(`unusable response table: ${String(err)}`);
}
const snapshot = snapshotPricesFromCsv(readText(snapshotPath, "snapshot"));
if (snapshot.length !== 24 || !snapshot.every(Number.isFinite))
  fail(`${snapshotPath}: expected 24 finite prices, found ${snapshot.length}`);

const curve = scaleCurve({
  bundle,
  bundle_path: bundlePath,
  snapshot,
  snapshot_path: snapshotPath,
  response: response!,
  generated_utc: nowUtc(argValue("--now")),
});
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, stableJson(curve));

const usd = (x: number) =>
  x.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
console.log(
  `wrote ${out} for ${curve.operating_day_mt} (slopes ${curve.slopes.prov} from ${responsePath})`,
);
for (const s of curve.series)
  console.log(
    `  ${s.id}: price taker $${usd(s.price_taker_usd_per_mw_day)}/MW-day; ` +
      s.points
        .map(
          (p) =>
            `${p.fleet_mw} MW $${usd(p.usd_per_mw_day)} ($${usd(p.band_low_usd_per_mw_day)} to $${usd(p.band_high_usd_per_mw_day)})`,
        )
        .join(", "),
  );
console.log(
  `  clamped HB: ${curve.slopes.clamped_hb.join(", ") || "none"}; inconclusive HB: ${curve.slopes.inconclusive_hb.join(", ") || "none"}`,
);
