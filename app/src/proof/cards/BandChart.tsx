import type { Policy } from "@contracts/types";
import { COPY } from "../../copy";
import { usdPerMw } from "../../format";

export const POLICY_LABEL: Record<Policy, string> = {
  fixed_overnight: COPY.fixedLabel,
  price_only: COPY.priceOnlyLabel,
  clearlane: COPY.clearlaneLabel,
};

export const POLICY_TONE: Record<Policy, string> = {
  fixed_overnight: "var(--muted)",
  price_only: "var(--shoulder)",
  clearlane: "var(--clear)",
};

/** Dollars at two places with the sign before the dollar: -$11.18, never $-11.18. */
export const signedUsd = (v: number) =>
  v < 0 ? `-${usdPerMw(-v)}` : usdPerMw(v);

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

/** One row of the chart: a band from lo to hi, a tick at mid and an optional dot at mean. */
export interface BandRow {
  id: string;
  label: string;
  tone: string;
  lo: number;
  mid: number;
  hi: number;
  mean?: number;
}

const W = 1000;
const PAD_L = 24;
const PAD_R = 40;
const TOP = 8;
const ROW = 92;
const BAND = 32;
// Tall enough for the tick labels and the axis title at the phone font size (proof.css).
const AXIS = 104;

/**
 * Hand-written SVG bands on a dollar axis that always shows zero: one row per policy, the band
 * from lo to hi, the tick at mid and the dot at the mean. The figures themselves sit in the list
 * under each chart, with their chips; the SVG only carries axis labels.
 */
export function BandChart({ rows, aria }: { rows: BandRow[]; aria: string }) {
  const lo = Math.min(0, ...rows.map((r) => r.lo));
  const hi = Math.max(0, ...rows.map((r) => r.hi));
  const ticks = niceTicks(lo, hi);
  const x0 = ticks[0] ?? lo;
  const x1 = ticks[ticks.length - 1] ?? hi;
  const sx = (v: number) =>
    PAD_L + ((v - x0) / (x1 - x0 || 1)) * (W - PAD_L - PAD_R);
  const plotBottom = TOP + rows.length * ROW;
  const H = plotBottom + AXIS;

  return (
    <svg
      className="proof-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={aria}
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
      {rows.map((r, i) => {
        const y = TOP + i * ROW;
        const bandY = y + 44;
        return (
          <g key={r.id}>
            <text className="proof-row-label" x={PAD_L} y={y + 30}>
              {r.label}
            </text>
            <rect
              data-band={r.id}
              x={sx(r.lo)}
              y={bandY}
              width={Math.max(2, sx(r.hi) - sx(r.lo))}
              height={BAND}
              rx={6}
              fill={r.tone}
              fillOpacity={0.35}
              stroke={r.tone}
              strokeWidth={2}
            />
            <line
              data-p50={r.id}
              x1={sx(r.mid)}
              x2={sx(r.mid)}
              y1={bandY - 8}
              y2={bandY + BAND + 8}
              stroke="var(--ink)"
              strokeWidth={4}
            />
            {r.mean === undefined ? null : (
              <circle
                data-mean={r.id}
                cx={sx(r.mean)}
                cy={bandY + BAND / 2}
                r={8}
                fill="var(--ink)"
                stroke="var(--bg)"
                strokeWidth={2}
              />
            )}
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
  );
}
