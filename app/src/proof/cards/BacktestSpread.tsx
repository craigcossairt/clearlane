import type { BacktestResult, Policy, PolicyStats } from "@contracts/types";
import { Num } from "../../components/Num";
import { COPY } from "../../copy";
import { usdPerMw } from "../../format";
import { PROOF_FILES } from "../sources";

const LABEL: Record<Policy, string> = {
  fixed_overnight: COPY.fixedLabel,
  price_only: COPY.priceOnlyLabel,
  clearlane: COPY.clearlaneLabel,
};

const TONE: Record<Policy, string> = {
  fixed_overnight: "var(--muted)",
  price_only: "var(--shoulder)",
  clearlane: "var(--clear)",
};

const W = 1000;
const PAD_L = 24;
const PAD_R = 40;
const TOP = 8;
const ROW = 92;
const BAND = 32;
// Tall enough for the tick labels and the axis title at the phone font size (proof.css).
const AXIS = 104;

/** Round axis ticks (steps of 1, 2 or 5 times a power of ten) that cover lo to hi. */
export function niceTicks(lo: number, hi: number, target = 6): number[] {
  const span = hi - lo || 1;
  const raw = span / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const first = Math.floor(lo / step) * step;
  const last = Math.ceil(hi / step) * step;
  const out: number[] = [];
  for (let t = first; t <= last + step / 2; t += step)
    out.push(Math.round(t / step) * step);
  return out;
}

const axisUsd = (v: number) => (v < 0 ? `-$${-v}` : `$${v}`);

/**
 * backtest.json as bands: for each timetable, P10 to P90 across the window's days, the P50 as a
 * tick and the mean as a dot. Clearlane's percentiles are the pinned numbers.json keys, so the
 * card and beat 5 can never disagree; the others are read live from the file.
 */
export function BacktestSpread({ result }: { result: BacktestResult }) {
  const rows = result.policies;
  const lo = Math.min(0, ...rows.map((p) => p.usd_per_mw_day.p10));
  const hi = Math.max(0, ...rows.map((p) => p.usd_per_mw_day.p90));
  const ticks = niceTicks(lo, hi);
  const x0 = ticks[0] ?? lo;
  const x1 = ticks[ticks.length - 1] ?? hi;
  const sx = (v: number) =>
    PAD_L + ((v - x0) / (x1 - x0 || 1)) * (W - PAD_L - PAD_R);
  const plotBottom = TOP + rows.length * ROW;
  const H = plotBottom + AXIS;

  return (
    <>
      <p>{COPY.proofBacktestLead}</p>
      <svg
        className="proof-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={COPY.proofBacktestAria}
      >
        {ticks.map((t) => (
          <line
            key={t}
            className={t === 0 ? "proof-zero" : "proof-grid"}
            x1={sx(t)}
            x2={sx(t)}
            y1={TOP}
            y2={plotBottom}
          />
        ))}
        {rows.map((p, i) => {
          const v = p.usd_per_mw_day;
          const y = TOP + i * ROW;
          const bandY = y + 44;
          return (
            <g key={p.policy}>
              <text className="proof-row-label" x={PAD_L} y={y + 30}>
                {LABEL[p.policy]}
              </text>
              <rect
                data-band={p.policy}
                x={sx(v.p10)}
                y={bandY}
                width={Math.max(2, sx(v.p90) - sx(v.p10))}
                height={BAND}
                rx={6}
                fill={TONE[p.policy]}
                fillOpacity={0.35}
                stroke={TONE[p.policy]}
                strokeWidth={2}
              />
              <line
                data-p50={p.policy}
                x1={sx(v.p50)}
                x2={sx(v.p50)}
                y1={bandY - 8}
                y2={bandY + BAND + 8}
                stroke="var(--ink)"
                strokeWidth={4}
              />
              <circle
                data-mean={p.policy}
                cx={sx(v.mean)}
                cy={bandY + BAND / 2}
                r={8}
                fill="var(--ink)"
                stroke="var(--bg)"
                strokeWidth={2}
              />
            </g>
          );
        })}
        {ticks.map((t, i) => (
          <text
            key={t}
            data-axis=""
            className="proof-tick"
            x={sx(t)}
            y={plotBottom + 36}
            // The end labels hang inward, so they never clip at the SVG's edges.
            textAnchor={
              i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"
            }
          >
            {axisUsd(t)}
          </text>
        ))}
        <text className="proof-tick" x={W - PAD_R} y={H - 8} textAnchor="end">
          {COPY.proofAxis}
        </text>
      </svg>
      <p className="proof-note">{COPY.proofBandNote}</p>
      <ul className="proof-rows" data-detail="">
        {rows.map((p) => (
          <PolicyRow key={p.policy} stats={p} />
        ))}
      </ul>
      <p>
        {COPY.backtestWindow} <Num k="backtest_days" /> {COPY.daysWord}{" "}
        <span data-time="">{result.window.start_mt}</span> {COPY.ribbonTo}{" "}
        <span data-time="">{result.window.end_mt}</span>.
        {result.window.missing_days.length > 0 ? (
          <>
            {" "}
            {COPY.missingDays}{" "}
            {result.window.missing_days.map((d) => (
              <span key={d} data-time="">
                {d}{" "}
              </span>
            ))}
          </>
        ) : null}
      </p>
      <p>{COPY.proofBaseline}</p>
    </>
  );
}

function PolicyRow({ stats }: { stats: PolicyStats }) {
  const v = stats.usd_per_mw_day;
  const pct = (which: "p10" | "p50" | "p90") =>
    stats.policy === "clearlane" ? (
      <Num k={`clearlane_${which}`} />
    ) : (
      <Live value={v[which]} />
    );
  return (
    <li data-policy={stats.policy}>
      <strong>{LABEL[stats.policy]}</strong>:{" "}
      <span data-copy-ok="percentile names">{COPY.bandP10}</span>
      {pct("p10")}
      <span data-copy-ok="percentile names">{COPY.bandP50}</span>
      {pct("p50")}
      <span data-copy-ok="percentile names">{COPY.bandP90}</span>
      {pct("p90")}
      {COPY.proofMean}
      <Live value={v.mean} /> {COPY.perMwDay}
    </li>
  );
}

function Live({ value }: { value: number }) {
  return (
    <Num
      value={value}
      display={usdPerMw(value)}
      prov="DERIVED"
      source={PROOF_FILES.backtest}
    />
  );
}
