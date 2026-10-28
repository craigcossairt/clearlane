import { Num } from "../../components/Num";
import { COPY } from "../../copy";
import { PROOF_FILES, type Pctl, type RtReplay } from "../sources";
import { BandChart, signedUsd } from "./BandChart";

type Way = "hold" | "replan" | "foresight";

const WAYS: { id: Way; label: string; tone: string }[] = [
  { id: "hold", label: COPY.proofRtHold, tone: "var(--muted)" },
  { id: "replan", label: COPY.proofRtReplan, tone: "var(--shoulder)" },
  { id: "foresight", label: COPY.proofRtForesight, tone: "var(--clear)" },
];

/**
 * public/derived/rt_replay.json (#72): the window's days settled on real-time prices three ways,
 * net of wear, as bands; then how often re-planning beat holding, the regret against perfect
 * foresight and how often the real-time evening fell below midday. The settlement status always
 * shows: an unverified rule is never presented as settled.
 */
export function RtReplayCard({ data }: { data: RtReplay }) {
  const s = data.summary;
  const prov = data.prov.values;
  const live = (value: number, money = false) => (
    <Num
      value={value}
      display={money ? signedUsd(value) : String(value)}
      prov={prov}
      source={PROOF_FILES.rtReplay}
    />
  );
  const row = (id: Way, v: Pctl) => (
    <li key={id} data-way={id}>
      <strong>{WAYS.find((w) => w.id === id)?.label}</strong>:{" "}
      <span data-copy-ok="percentile names">{COPY.bandP10}</span>
      {live(v.p10, true)}
      <span data-copy-ok="percentile names">{COPY.bandP50}</span>
      {live(v.p50, true)}
      <span data-copy-ok="percentile names">{COPY.bandP90}</span>
      {live(v.p90, true)}
      {COPY.proofMean}
      {live(v.mean, true)} {COPY.perMwDay}
    </li>
  );

  return (
    <>
      <p>{COPY.proofRtLead}</p>
      {/* The settlement label comes before any number from the file. */}
      <p className="proof-settlement">
        {COPY.proofRtSettlement}{" "}
        <strong data-settlement={data.settlement.status}>
          {data.settlement.status}
        </strong>
        .
        {data.settlement.status === "UNVERIFIED" ? (
          <> {COPY.proofRtUnverified}</>
        ) : null}
      </p>
      <BandChart
        aria={COPY.proofRtAria}
        rows={WAYS.map((w) => {
          const v = s.net_usd_per_mw_day[w.id];
          return {
            id: w.id,
            label: w.label,
            tone: w.tone,
            lo: v.p10,
            mid: v.p50,
            hi: v.p90,
            mean: v.mean,
          };
        })}
      />
      <p className="proof-note">{COPY.proofBandNote}</p>
      <ul className="proof-rows" data-detail="">
        {WAYS.map((w) => row(w.id, s.net_usd_per_mw_day[w.id]))}
      </ul>
      <p>
        {COPY.proofRtDaysPre} {live(s.days_replan_above_hold)}{" "}
        {COPY.proofRtDaysMid} {live(s.days_replan_below_hold)}.{" "}
        {COPY.proofRtRegretPre} {live(s.regret_usd_per_mw_day.hold.p50, true)}
        {COPY.proofRtRegretMid} {live(s.regret_usd_per_mw_day.replan.p50, true)}{" "}
        {COPY.perMwDay}.
      </p>
      <p>
        {COPY.proofRtEveningPre} {live(s.rt_evening_below_midday_days)}{" "}
        {COPY.proofOf} {live(s.days)} {COPY.proofRtEveningMid}{" "}
        {live(s.da_evening_below_midday_days)}.
      </p>
      <p>
        {COPY.backtestWindow} <span data-time="">{data.window.start_mt}</span>{" "}
        {COPY.ribbonTo} <span data-time="">{data.window.end_mt}</span>.{" "}
        {COPY.proofRtWearPre} <Num k="wear_usd_mwh" /> {COPY.proofPerMwh}
      </p>
    </>
  );
}
