import { Num } from "../../components/Num";
import { COPY } from "../../copy";
import { clock } from "../../format";
import {
  PROOF_FILES,
  SCH_RULES,
  type SchRule,
  type SchStudy,
} from "../sources";

const LABEL: Record<SchRule, string> = {
  ours: COPY.schLabel,
  top6_price: COPY.proofSchTop6,
  netload_p75: COPY.proofSchP75,
  top4_netload: COPY.proofSchTop4,
};

const TONE: Record<SchRule, string> = {
  ours: "var(--clear)",
  top6_price: "var(--shoulder)",
  netload_p75: "var(--muted)",
  top4_netload: "var(--muted)",
};

const W = 1000;
const PAD_L = 24;
const PAD_R = 40;
const TOP = 8;
const ROW = 92;
const BAR = 32;
// Tall enough for the tick labels and the axis title at the phone font size (proof.css).
const AXIS = 104;

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Live({ value, display }: { value: number; display: string }) {
  return (
    <Num
      value={value}
      display={display}
      prov="DERIVED"
      source={PROOF_FILES.schStudy}
    />
  );
}

/** Hours that run on without a gap read as a range; anything else is listed. */
function Hours({ hb }: { hb: number[] }) {
  const sorted = [...hb].sort((a, b) => a - b);
  const contiguous = sorted.every(
    (h, i) => i === 0 || h === sorted[i - 1]! + 1,
  );
  if (contiguous && sorted.length > 1)
    return (
      <>
        <span data-time="">{clock(sorted[0]!)}</span> {COPY.ribbonTo}{" "}
        <span data-time="">{clock(sorted[sorted.length - 1]!)}</span>
      </>
    );
  return (
    <>
      {sorted.map((h, i) => (
        <span key={h}>
          {i > 0 ? ", " : null}
          <span data-time="">{clock(h)}</span>
        </span>
      ))}
    </>
  );
}

/**
 * science/sch_study.json (#109): our System Critical Hours rule and three simpler ones over the
 * season, each as its lift over chance at catching the 2025 call hours (Mountain reading only).
 * The study is of rules, not a call forecast, and the card says so whenever no rule beats chance.
 * The stage-day check uses the pinned sch_hours_today key, so it agrees with the envelope beat.
 */
export function SchStudyCard({ data }: { data: SchStudy }) {
  const lift = (r: SchRule) => data.overlap[r].mountain.lift;
  const hi = Math.max(1.2, ...SCH_RULES.map(lift));
  const ticks = [0, 0.5, 1, ...(hi > 1.5 ? [1.5] : [])];
  const x1 = Math.max(hi, ticks[ticks.length - 1]!);
  const sx = (v: number) => PAD_L + (v / x1) * (W - PAD_L - PAD_R);
  const plotBottom = TOP + SCH_RULES.length * ROW;
  const H = plotBottom + AXIS;
  const noneBeatChance = SCH_RULES.every((r) => lift(r) < 1);
  const stage = data.oct27;

  return (
    <>
      <p>{COPY.proofSchLead}</p>
      <svg
        className="proof-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={COPY.proofSchAria}
      >
        {ticks.map((t) => (
          <line
            key={t}
            className={t === 1 ? "proof-zero" : "proof-grid"}
            data-chance={t === 1 ? "" : undefined}
            x1={sx(t)}
            x2={sx(t)}
            y1={TOP}
            y2={plotBottom}
          />
        ))}
        {SCH_RULES.map((r, i) => {
          const y = TOP + i * ROW;
          return (
            <g key={r}>
              <text className="proof-row-label" x={PAD_L} y={y + 30}>
                {LABEL[r]}
              </text>
              <rect
                data-lift={r}
                x={sx(0)}
                y={y + 44}
                width={Math.max(2, sx(lift(r)) - sx(0))}
                height={BAR}
                rx={6}
                fill={TONE[r]}
                fillOpacity={0.6}
                stroke={TONE[r]}
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
            textAnchor={i === 0 ? "start" : "middle"}
          >
            {t === 1 ? `1 ${COPY.proofSchChance}` : String(t)}
          </text>
        ))}
        <text className="proof-tick" x={W - PAD_R} y={H - 8} textAnchor="end">
          {COPY.proofSchAxis}
        </text>
      </svg>
      <p className="proof-note">{COPY.proofSchBars}</p>
      <ul className="proof-rows" data-detail="">
        {SCH_RULES.map((r) => {
          const m = data.overlap[r].mountain;
          const agree = data.jaccard_vs_ours?.[r];
          return (
            <li key={r} data-rule={r}>
              <strong>{LABEL[r]}</strong>:{" "}
              <Live
                value={data.mean_per_day[r]}
                display={data.mean_per_day[r].toFixed(1)}
              />{" "}
              {COPY.proofSchHoursADay}{" "}
              <Live value={m.coverage} display={pct(m.coverage)} />{" "}
              {COPY.proofSchOfCalls}{" "}
              <Live value={m.budget} display={pct(m.budget)} />{" "}
              {COPY.proofSchOfHours}{" "}
              <Live value={m.lift} display={m.lift.toFixed(2)} />
              {r !== "ours" && agree !== undefined ? (
                <>
                  {COPY.proofSchAgrees}{" "}
                  <Live value={agree} display={pct(agree)} />{" "}
                  {COPY.proofSchOfFlagged}
                </>
              ) : null}
              .
            </li>
          );
        })}
      </ul>
      {noneBeatChance ? <p data-sch-finding="">{COPY.proofSchNone}</p> : null}
      <p>
        {COPY.proofSchStagePre} <Num k="sch_hours_today" />{" "}
        {COPY.proofSchStageMid} <Hours hb={stage.envelope_system_critical_hb} />
        {stage.status === "match" ? (
          COPY.proofSchStageMatch
        ) : (
          <>
            {COPY.proofSchStageOff}{" "}
            <strong data-sch-status={stage.status}>{stage.status}</strong>.
          </>
        )}
      </p>
      <p>
        {COPY.proofSchSeason}{" "}
        <Live value={data.season.days} display={String(data.season.days)} />{" "}
        {COPY.proofDaysWord}, <span data-time="">{data.season.first}</span>{" "}
        {COPY.ribbonTo} <span data-time="">{data.season.last}</span>.
      </p>
    </>
  );
}
