import type { ReactNode } from "react";
import { Num, useNumber } from "../../components/Num";
import { COPY } from "../../copy";
import { clock } from "../../format";
import {
  PROOF_FILES,
  type ScaleCurve,
  type ScalePoint,
  type ScaleSeries,
  type ScaleSeriesId,
} from "../sources";
import { niceTicks, signedUsd } from "./BandChart";

const LABEL: Record<ScaleSeriesId, string> = {
  fixed_overnight: COPY.fixedLabel,
  clearlane: COPY.clearlaneLabel,
  dp_price_only: COPY.priceOnlyLabel,
  dp_wear10: COPY.proofScaleWear10,
};

const TONE: Record<ScaleSeriesId, { stroke: string; dash?: string }> = {
  fixed_overnight: { stroke: "var(--muted)" },
  clearlane: { stroke: "var(--clear)" },
  dp_price_only: { stroke: "var(--shoulder)" },
  dp_wear10: { stroke: "var(--accent)", dash: "10 8" },
};

const W = 1000;
const H = 560;
const PAD_L = 24;
const PAD_R = 40;
const TOP = 24;
// Tall enough for the tick labels and the axis title at the phone font size (proof.css).
const BOTTOM = 104;

const pct = (v: number) => `${Math.round(v)}%`;

function Hours({ label, hb }: { label: string; hb: number[] }) {
  if (hb.length === 0) return null;
  return (
    <p data-hours={label}>
      {label}{" "}
      {hb.map((h, i) => (
        <span key={h}>
          {i > 0 ? ", " : null}
          <span data-time="">{clock(h)}</span>
        </span>
      ))}
      .
    </p>
  );
}

/**
 * public/derived/scale_curve.json (#73): for each timetable, value per MW-day from the price
 * taker (no impact, the pinned stage key) out to the MOU ceiling, with the band shaded. The
 * curve lives only here: the Scale beat keeps its "does not move prices" caveat. The fleet sizes
 * are the pinned Torus keys, and 500 MW is always called the ceiling, never installed capacity.
 */
export function ScaleCurveCard({ data }: { data: ScaleCurve }) {
  const series = data.series;
  const live = (value: number, display: string) => (
    <Num
      value={value}
      display={display}
      prov={data.prov}
      source={PROOF_FILES.scaleCurve}
    />
  );
  const maxMw = Math.max(...data.fleet_mw);
  const hiUsd = Math.max(
    ...series.map((s) => s.price_taker_usd_per_mw_day),
    ...series.flatMap((s) => s.points.map((p) => p.band_high_usd_per_mw_day)),
  );
  const loUsd = Math.min(
    0,
    ...series.flatMap((s) => s.points.map((p) => p.band_low_usd_per_mw_day)),
  );
  const yTicks = niceTicks(loUsd, hiUsd, 5);
  const y0 = yTicks[0] ?? loUsd;
  const y1 = yTicks[yTicks.length - 1] ?? hiUsd;
  const sx = (mw: number) => PAD_L + (mw / maxMw) * (W - PAD_L - PAD_R);
  const sy = (usd: number) =>
    TOP + (1 - (usd - y0) / (y1 - y0 || 1)) * (H - TOP - BOTTOM);
  const plotBottom = H - BOTTOM;

  const byMw = (s: ScaleSeries) =>
    [...s.points].sort((a, b) => a.fleet_mw - b.fleet_mw);
  const path = (pts: [number, number][]) =>
    pts
      .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");

  return (
    <>
      <p>{COPY.proofScaleLead}</p>
      <svg
        className="proof-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={COPY.proofScaleAria}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line
              className={t === 0 ? "proof-zero" : "proof-grid"}
              x1={PAD_L}
              x2={W - PAD_R}
              y1={sy(t)}
              y2={sy(t)}
            />
            <text
              data-axis=""
              className="proof-tick"
              x={PAD_L + 4}
              y={sy(t) - 8}
            >
              {signedUsd(t).replace(".00", "")}
            </text>
          </g>
        ))}
        {series.map((s) => {
          const pts = byMw(s);
          const taker = s.price_taker_usd_per_mw_day;
          const hi = path([
            [sx(0), sy(taker)],
            ...pts.map((p): [number, number] => [
              sx(p.fleet_mw),
              sy(p.band_high_usd_per_mw_day),
            ]),
          ]);
          const lo = [...pts]
            .reverse()
            .map(
              (p) =>
                `L${sx(p.fleet_mw).toFixed(1)},${sy(p.band_low_usd_per_mw_day).toFixed(1)}`,
            )
            .join(" ");
          return (
            <path
              key={`band-${s.id}`}
              data-band={s.id}
              d={`${hi} ${lo} Z`}
              fill={TONE[s.id].stroke}
              fillOpacity={0.18}
              stroke="none"
            />
          );
        })}
        {series.map((s) => (
          <g key={s.id} data-series={s.id}>
            <path
              d={path([
                [sx(0), sy(s.price_taker_usd_per_mw_day)],
                ...byMw(s).map((p): [number, number] => [
                  sx(p.fleet_mw),
                  sy(p.usd_per_mw_day),
                ]),
              ])}
              fill="none"
              stroke={TONE[s.id].stroke}
              strokeWidth={4}
              strokeDasharray={TONE[s.id].dash}
            />
            {byMw(s).map((p) => (
              <circle
                key={p.fleet_mw}
                data-point={p.fleet_mw}
                cx={sx(p.fleet_mw)}
                cy={sy(p.usd_per_mw_day)}
                r={6}
                fill={TONE[s.id].stroke}
                stroke="var(--bg)"
                strokeWidth={2}
              />
            ))}
          </g>
        ))}
        <line
          className="proof-base"
          x1={PAD_L}
          x2={W - PAD_R}
          y1={plotBottom}
          y2={plotBottom}
        />
        {[0, ...data.fleet_mw].map((mw, i, all) => (
          <text
            key={mw}
            data-axis=""
            className="proof-tick"
            x={sx(mw)}
            y={plotBottom + 36}
            textAnchor={
              i === 0 ? "start" : i === all.length - 1 ? "end" : "middle"
            }
          >
            {String(mw)}
          </text>
        ))}
        <text className="proof-tick" x={W - PAD_R} y={H - 8} textAnchor="end">
          {COPY.proofScaleXAxis}
        </text>
      </svg>
      <p className="proof-note">{COPY.proofScaleNote}</p>
      <p className="proof-legend" aria-hidden="true">
        {series.map((s) => (
          <span key={s.id} className="proof-legend-item" data-legend={s.id}>
            <svg width="40" height="12" viewBox="0 0 40 12">
              <line
                x1="0"
                x2="40"
                y1="6"
                y2="6"
                stroke={TONE[s.id].stroke}
                strokeWidth="4"
                strokeDasharray={TONE[s.id].dash ? "8 6" : undefined}
              />
            </svg>{" "}
            {LABEL[s.id]}
          </span>
        ))}
      </p>
      <ul className="proof-rows" data-detail="">
        {series.map((s) => (
          <Row key={s.id} s={s} live={live} />
        ))}
      </ul>
      <p>
        {COPY.proofScaleFleetPre} <Num k="mou_70mw" /> {COPY.proofScaleFirstMou}{" "}
        <Num k="torus_500mw" /> {COPY.proofScaleMw} {COPY.mouCeiling}.
      </p>
      <p>{COPY.proofScaleAssoc}</p>
      <Hours
        label={COPY.proofScaleInconclusive}
        hb={data.slopes.inconclusive_hb}
      />
      <Hours label={COPY.proofScaleClamped} hb={data.slopes.clamped_hb} />
    </>
  );
}

/**
 * One timetable in words: the pinned price-taker value, then the points at the first MOU and at
 * the MOU ceiling, picked by the pinned fleet keys so the words always match the sizes.
 */
function Row({
  s,
  live,
}: {
  s: ScaleSeries;
  live: (value: number, display: string) => ReactNode;
}) {
  const mou = useNumber("mou_70mw")?.value;
  const ceiling = useNumber("torus_500mw")?.value;
  const first = s.points.find((p) => p.fleet_mw === mou);
  const last = s.points.find((p) => p.fleet_mw === ceiling);
  const usd = (v: number) => live(v, signedUsd(v));
  return (
    <li data-series-row={s.id}>
      <strong>{LABEL[s.id]}</strong>: <Num k={s.price_taker_keys[0]!} />{" "}
      {COPY.proofScaleTaker}
      {first ? (
        <>
          {" "}
          {usd(first.usd_per_mw_day)} {COPY.proofScaleAtFirst}
        </>
      ) : null}
      {last ? <Ceiling p={last} usd={usd} live={live} /> : null}
    </li>
  );
}

function Ceiling({
  p,
  usd,
  live,
}: {
  p: ScalePoint;
  usd: (v: number) => ReactNode;
  live: (value: number, display: string) => ReactNode;
}) {
  return (
    <>
      {" "}
      {usd(p.usd_per_mw_day)} {COPY.proofScaleAtCeiling}{" "}
      {usd(p.band_low_usd_per_mw_day)} {COPY.ribbonTo}{" "}
      {usd(p.band_high_usd_per_mw_day)}),{" "}
      {live(p.pct_of_price_taker, pct(p.pct_of_price_taker))}{" "}
      {COPY.proofScaleOfTaker}
    </>
  );
}
