import type { ReactNode } from "react";
import { Num } from "../../components/Num";
import { COPY } from "../../copy";
import { ratio1, usdPerMw } from "../../format";
import {
  PROOF_FILES,
  type SensAxis,
  type SensBreakEven,
  type Sensitivity,
} from "../sources";
import { niceTicks, signedUsd } from "./BandChart";

/** Our names for the axes; an axis the file adds later keeps the engine's label. */
const LABEL: Record<string, string> = {
  rte: COPY.proofSensRte,
  wear_usd_mwh: COPY.proofSensWear,
  host_ceiling_slack_kw: COPY.proofSensSlack,
  enrolled_kw: COPY.proofSensEnrolled,
  export_limit_kw: COPY.proofSensExport,
  spin_refill_min: COPY.proofSensSpinRefill,
  dp_soc_states: COPY.proofSensSocGrid,
  host_load_archetype: COPY.proofSensArchetype,
  co2_basis: COPY.proofSensCarbon,
};
const label = (a: SensAxis) => LABEL[a.key] ?? a.label;

const TONE = { low: "var(--muted)", high: "var(--clear)" } as const;

const W = 1000;
const PAD_L = 24;
const PAD_R = 40;
const TOP = 8;
const ROW = 92;
const BAR = 32;
// Tall enough for the tick labels and the axis title at the phone font size (proof.css).
const AXIS = 104;

/** An axis the chart can draw: run, with a number at each end of its range. */
type Swept = SensAxis & {
  low: number;
  high: number;
  gap_low: { usd_per_mw_day: number };
  gap_high: { usd_per_mw_day: number };
};
const swept = (a: SensAxis): a is Swept =>
  a.status === "ok" &&
  typeof a.low === "number" &&
  typeof a.high === "number" &&
  a.gap_low !== undefined &&
  a.gap_high !== undefined;

const trim = (x: number) => String(Number(x.toFixed(2)));
const usdWhole = (x: number) => (Number.isInteger(x) ? `$${x}` : usdPerMw(x));

/**
 * public/derived/sensitivity.json (#69): how far Clearlane stays ahead of the off-peak rule as
 * one input at a time moves across its range, then where the gap would close. An axis is drawn
 * only when both ends of its range are numbers: the heatmap reading and the CO2 basis are named
 * readings that move calls or CO2, never dollars, and the heatmap's other readings are not for
 * stage.
 */
export function SensitivityCard({ data }: { data: Sensitivity }) {
  const live = (value: number, display: string, prov = data.prov) => (
    <Num
      value={value}
      display={display}
      prov={prov}
      source={PROOF_FILES.sensitivity}
    />
  );
  const usd = (v: number) => live(v, signedUsd(v));
  const base = data.base.gap.usd_per_mw_day;
  const swing = (a: Swept) =>
    Math.max(
      Math.abs(a.gap_low.usd_per_mw_day - base),
      Math.abs(a.gap_high.usd_per_mw_day - base),
    );
  const axes = data.axes.filter(swept).sort((a, b) => swing(b) - swing(a));
  const pending = data.axes.filter((a) => a.status === "pending");

  const all = [
    base,
    ...axes.flatMap((a) => [
      a.gap_low.usd_per_mw_day,
      a.gap_high.usd_per_mw_day,
    ]),
  ];
  const ticks = niceTicks(Math.min(0, ...all), Math.max(...all), 5);
  const x0 = ticks[0] ?? 0;
  const x1 = ticks[ticks.length - 1] ?? base;
  const sx = (v: number) =>
    PAD_L + ((v - x0) / (x1 - x0 || 1)) * (W - PAD_L - PAD_R);
  const plotBottom = TOP + axes.length * ROW;
  const H = plotBottom + AXIS;
  const bar = (from: number, to: number) => ({
    x: Math.min(sx(from), sx(to)),
    width: Math.abs(sx(to) - sx(from)),
  });

  return (
    <>
      <p>{COPY.proofSensLead}</p>
      <p>
        {COPY.proofSensBase} {usd(base)} {COPY.proofSensPerMwDay}
      </p>
      <svg
        className="proof-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={COPY.proofSensAria}
      >
        {ticks.map((t) => (
          <line
            key={t}
            className={t === 0 ? "proof-base" : "proof-grid"}
            x1={sx(t)}
            x2={sx(t)}
            y1={TOP}
            y2={plotBottom}
          />
        ))}
        {axes.map((a, i) => {
          const y = TOP + i * ROW;
          return (
            <g key={a.key} data-sens-axis={a.key}>
              <text className="proof-row-label" x={PAD_L + 12} y={y + 30}>
                {label(a)}
              </text>
              {(["low", "high"] as const).map((end) => (
                <rect
                  key={end}
                  data-end={end}
                  {...bar(
                    base,
                    (end === "low" ? a.gap_low : a.gap_high).usd_per_mw_day,
                  )}
                  y={y + 44 + (end === "high" ? BAR / 2 : 0)}
                  height={BAR / 2}
                  fill={TONE[end]}
                  fillOpacity={0.7}
                />
              ))}
            </g>
          );
        })}
        <line
          data-base=""
          className="proof-base"
          strokeDasharray="8 6"
          x1={sx(base)}
          x2={sx(base)}
          y1={TOP}
          y2={plotBottom}
        />
        {ticks.map((t, i) => (
          <text
            key={t}
            data-axis=""
            className="proof-tick"
            x={sx(t)}
            y={plotBottom + 36}
            textAnchor={i === 0 ? "start" : "middle"}
          >
            {signedUsd(t).replace(".00", "")}
          </text>
        ))}
        <text className="proof-tick" x={W - PAD_R} y={H - 8} textAnchor="end">
          {COPY.proofSensAxis}
        </text>
      </svg>
      <p className="proof-legend" aria-hidden="true">
        {(["low", "high"] as const).map((end) => (
          <span key={end} className="proof-legend-item" data-legend={end}>
            <svg width="40" height="12" viewBox="0 0 40 12">
              <rect width="40" height="12" fill={TONE[end]} fillOpacity={0.7} />
            </svg>{" "}
            {end === "low" ? COPY.proofSensLowEnd : COPY.proofSensHighEnd}
          </span>
        ))}
        <span className="proof-legend-item" data-legend="base">
          <svg width="40" height="12" viewBox="0 0 40 12">
            <line
              className="proof-base"
              x1="0"
              x2="40"
              y1="6"
              y2="6"
              strokeDasharray="8 6"
            />
          </svg>{" "}
          {COPY.proofSensBaseLine}
        </span>
      </p>
      <ul className="proof-rows" data-detail="">
        {axes.map((a) => (
          <AxisRow key={a.key} a={a} base={base} live={live} usd={usd} />
        ))}
      </ul>
      <p className="proof-note">{COPY.proofSensAlone}</p>
      {pending.length > 0 ? (
        <p data-sens-pending="">
          {COPY.proofSensPending} {pending.map(label).join("; ")}.
        </p>
      ) : null}
      <ul className="proof-rows" data-break-even="">
        <li data-be="rte">
          <RteLine be={data.break_even.rte} live={live} usd={usd} />
        </li>
        <li data-be="daily_spread">
          <SpreadLine be={data.break_even.daily_spread} live={live} usd={usd} />
        </li>
        <li data-be="wear_usd_mwh">
          <WearLine
            be={data.break_even.wear_usd_mwh}
            wear={data.wear_usd_mwh}
            live={live}
            usd={usd}
          />
        </li>
        <li data-be="by_day_spread">
          <ByDay byDay={data.break_even.by_day_spread} live={live} />
        </li>
      </ul>
    </>
  );
}

type Live = (
  value: number,
  display: string,
  prov?: SensAxis["range_prov"],
) => ReactNode;
type Usd = (value: number) => ReactNode;

/** One input in words: its range, then the gap at each end of it. */
function AxisRow({
  a,
  base,
  live,
  usd,
}: {
  a: Swept;
  base: number;
  live: Live;
  usd: Usd;
}) {
  const end = (x: number) =>
    live(
      x,
      a.unit === "fraction" ? x.toFixed(2) : trim(x),
      a.range_prov ?? "ASSUMPTION",
    );
  const unit =
    a.unit === undefined || a.unit === "fraction"
      ? ""
      : ` ${a.unit.replace(/^multiple of /, `${COPY.proofSensTimes} `)}`;
  const lo = a.gap_low.usd_per_mw_day;
  const hi = a.gap_high.usd_per_mw_day;
  const still = Math.abs(lo - base) < 0.005 && Math.abs(hi - base) < 0.005;
  return (
    <li data-axis-row={a.key}>
      <strong>{label(a)}</strong>, {end(a.low)} {COPY.ribbonTo} {end(a.high)}
      {unit}:{" "}
      {still ? (
        COPY.proofSensNoChange
      ) : (
        <>
          {COPY.proofSensGap} {usd(lo)} {COPY.ribbonTo} {usd(hi)}
        </>
      )}
      .
    </li>
  );
}

/** Ends of the scanned range: our choice, so ASSUMPTION; what the scan found is DERIVED. */
const span = (be: SensBreakEven) => {
  const xs = be.scanned.map((s) => s.x);
  return [Math.min(...xs), Math.max(...xs)] as const;
};
const CHOSEN = "ASSUMPTION" as const;

function RteLine({
  be,
  live,
  usd,
}: {
  be: SensBreakEven;
  live: Live;
  usd: Usd;
}) {
  const x = (v: number, prov?: typeof CHOSEN) => live(v, v.toFixed(2), prov);
  if (be.found && be.value !== null)
    return (
      <>
        {COPY.proofSensRteFound} {x(be.value)}.
      </>
    );
  const [lo, hi] = span(be);
  return (
    <>
      {COPY.proofSensRteNone} {x(lo, CHOSEN)} {COPY.ribbonTo} {x(hi, CHOSEN)}{" "}
      {COPY.proofSensClosesNot} {usd(be.min_gap.gap_usd_per_mw_day)}{" "}
      {COPY.proofSensAt} {x(be.min_gap.x)}.
    </>
  );
}

function SpreadLine({
  be,
  live,
  usd,
}: {
  be: SensBreakEven;
  live: Live;
  usd: Usd;
}) {
  const x = (v: number, prov?: typeof CHOSEN) => live(v, trim(v), prov);
  if (be.found && be.value !== null)
    return (
      <>
        {COPY.proofSensSpreadFound} {x(be.value)} {COPY.proofSensSpreadTimes}
      </>
    );
  const [lo, hi] = span(be);
  const flat = be.scanned.find((s) => s.x === 0);
  return (
    <>
      {COPY.proofSensSpreadNone} {x(lo, CHOSEN)} {COPY.ribbonTo} {x(hi, CHOSEN)}{" "}
      {COPY.proofSensSpreadNever} {usd(be.min_gap.gap_usd_per_mw_day)}{" "}
      {COPY.proofSensAt} {x(be.min_gap.x)} {COPY.proofSensSpreadTimes}
      {flat && flat.gap_usd_per_mw_day > 0 ? <> {COPY.proofSensFlat}</> : null}
    </>
  );
}

function WearLine({
  be,
  wear,
  live,
  usd,
}: {
  be: SensBreakEven;
  wear: number;
  live: Live;
  usd: Usd;
}) {
  if (be.found && be.value !== null)
    return (
      <>
        {COPY.proofSensWearFound} {usd(be.value)} {COPY.proofSensAMwh}{" "}
        {live(be.value / wear, ratio1(be.value / wear))} {COPY.proofSensWearOf}{" "}
        <Num k="wear_usd_mwh" />.
      </>
    );
  return (
    <>
      {COPY.proofSensWearNone}{" "}
      {live(span(be)[1], signedUsd(span(be)[1]), CHOSEN)}{" "}
      {COPY.proofSensWearNoneTail}
    </>
  );
}

function ByDay({
  byDay,
  live,
}: {
  byDay: Sensitivity["break_even"]["by_day_spread"];
  live: Live;
}) {
  const n = (v: number) => live(v, String(v));
  return (
    <>
      {COPY.proofSensByDay} {n(byDay.rule_ties_or_wins)} {COPY.proofSensOf}{" "}
      {n(byDay.days)} {COPY.proofDaysWord}. {COPY.proofSensByBand}{" "}
      {byDay.bands.map((b, i) => (
        <span key={b.from_usd_mwh} data-sens-band="">
          {i > 0 ? "; " : null}
          {live(b.from_usd_mwh, usdWhole(b.from_usd_mwh), CHOSEN)}{" "}
          {b.to_usd_mwh === null ? (
            COPY.proofSensAndOver
          ) : (
            <>
              {COPY.ribbonTo}{" "}
              {live(b.to_usd_mwh, usdWhole(b.to_usd_mwh), CHOSEN)}
            </>
          )}
          , {n(b.rule_ties_or_wins)} {COPY.proofSensOf} {n(b.days)}
        </span>
      ))}
      .
    </>
  );
}
