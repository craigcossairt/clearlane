import type { Policy } from "@contracts/types";
import type { ReactNode } from "react";
import { Num } from "../../components/Num";
import { COPY } from "../../copy";
import { grouped } from "../../format";
import { PROOF_FILES, type CallLedger, type LedgerRow } from "../sources";
import { POLICY_LABEL, POLICY_TONE } from "./BandChart";

const POLICIES: Policy[] = ["fixed_overnight", "price_only", "clearlane"];

const W = 1000;
const PAD_L = 24;
const PAD_R = 40;
const TOP = 8;
const ROW = 92;
const BAR = 32;
const AXIS = 60;
const TICKS = [0, 25, 50, 75, 100];

/**
 * public/derived/call_ledger.json (#68): for the stage reading of the heatmap (Mountain time),
 * the share of SIMULATED calls each timetable delivered in band, as bars on a zero to all axis,
 * then the unanswerable and short calls, and how dense the replay is next to the 2025 rate. The
 * UTC reading is a sensitivity check the ledger marks not for stage, so it is not shown.
 */
export function CallLedgerCard({ data }: { data: CallLedger }) {
  const rows = POLICIES.map((p) =>
    data.summary.find((r) => r.for_stage && r.policy === p)!,
  );
  const d = data.replay_density;
  const live = (value: number, display: string) => (
    <Num
      value={value}
      display={display}
      prov={data.prov}
      source={PROOF_FILES.callLedger}
    />
  );
  const sx = (pct: number) => PAD_L + (pct / 100) * (W - PAD_L - PAD_R);
  const plotBottom = TOP + rows.length * ROW;
  const H = plotBottom + AXIS;

  return (
    <>
      <p>{COPY.proofLedgerLead}</p>
      <svg
        className="proof-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={COPY.proofLedgerAria}
      >
        {TICKS.map((t) => (
          <line
            key={t}
            className="proof-grid"
            x1={sx(t)}
            x2={sx(t)}
            y1={TOP}
            y2={plotBottom}
          />
        ))}
        {rows.map((r, i) => {
          const y = TOP + i * ROW;
          return (
            <g key={r.policy}>
              <text className="proof-row-label" x={PAD_L} y={y + 30}>
                {POLICY_LABEL[r.policy]}
              </text>
              <rect
                data-share={r.policy}
                x={sx(0)}
                y={y + 44}
                width={Math.max(
                  2,
                  sx(r.delivered_at_or_above_90_pct_share) - sx(0),
                )}
                height={BAR}
                rx={6}
                fill={POLICY_TONE[r.policy]}
                fillOpacity={0.6}
                stroke={POLICY_TONE[r.policy]}
                strokeWidth={2}
              />
            </g>
          );
        })}
        {TICKS.map((t, i) => (
          <text
            key={t}
            data-axis=""
            className="proof-tick"
            x={sx(t)}
            y={plotBottom + 36}
            textAnchor={
              i === 0 ? "start" : i === TICKS.length - 1 ? "end" : "middle"
            }
          >
            {`${t}%`}
          </text>
        ))}
      </svg>
      <ul className="proof-rows" data-detail="">
        {rows.map((r) => (
          <Row key={r.policy} row={r} live={live} />
        ))}
      </ul>
      <p>
        {COPY.proofLedgerBandPre} <Num k="rmp_event_band_min_pct" />{" "}
        {COPY.proofLedgerBandPost}
      </p>
      <p>
        {live(d.calls_per_reading, grouped(d.calls_per_reading, 0))}{" "}
        {COPY.proofLedgerCallsOn}{" "}
        {live(d.backtest_days, String(d.backtest_days))}{" "}
        {COPY.proofLedgerDaysIs}{" "}
        {live(d.calls_per_day, d.calls_per_day.toFixed(2))}{" "}
        {COPY.proofLedgerADay}{" "}
        {live(d.ratio_to_2025_rate, d.ratio_to_2025_rate.toFixed(1))}{" "}
        {COPY.proofLedgerTimesThe} <span data-time="">2025</span>{" "}
        {COPY.proofLedgerRate}{" "}
        {live(d.rate_2025_per_day, d.rate_2025_per_day.toFixed(2))}
        {COPY.proofLedgerStress}
      </p>
    </>
  );
}

function Row({
  row,
  live,
}: {
  row: LedgerRow;
  live: (value: number, display: string) => ReactNode;
}) {
  const share = row.delivered_at_or_above_90_pct_share;
  return (
    <li data-policy={row.policy}>
      <strong>{POLICY_LABEL[row.policy]}</strong>:{" "}
      {live(share, `${share.toFixed(1)}%`)} {COPY.proofLedgerInBand}{" "}
      {live(row.unanswerable_calls, String(row.unanswerable_calls))}{" "}
      {COPY.proofLedgerUnanswerable}{" "}
      {live(row.shortfall_calls, String(row.shortfall_calls))}{" "}
      {COPY.proofLedgerShort}{" "}
      {live(row.shortfall_kwh, `${grouped(row.shortfall_kwh, 0)} kWh`)}{" "}
      {COPY.proofLedgerInAll}
    </li>
  );
}
