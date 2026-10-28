import type { Policy } from "@contracts/types";
import { Num } from "../../components/Num";
import { COPY } from "../../copy";
import { grouped } from "../../format";
import { PROOF_FILES, type BacktestIntervals } from "../sources";
import { BandChart, POLICY_LABEL, POLICY_TONE, signedUsd } from "./BandChart";

const POLICIES: Policy[] = ["fixed_overnight", "price_only", "clearlane"];

const pct = (v: number) => `${Math.round(v)}%`;

function Live({ value, display }: { value: number; display: string }) {
  return (
    <Num
      value={value}
      display={display}
      prov="DERIVED"
      source={PROOF_FILES.intervals}
    />
  );
}

/**
 * science/backtest_intervals.json (#111): each timetable's median value with the moving-block
 * interval around it, the share of days Clearlane beat the off-peak rule with its interval, and
 * how far the ends move under another resampling or another seed. The moving-block interval is
 * the headline; the iid one is a reference only and is not shown. Clearlane's median and share
 * are the pinned keys, so this card and beat 5 can never disagree.
 */
export function IntervalsCard({ data }: { data: BacktestIntervals }) {
  const mb = data.bootstrap.moving_block;
  const share = mb.days_beating_fixed_overnight_pct.clearlane;
  const stationary = data.bootstrap.stationary?.p50.clearlane;
  const seedUsd = data.seed_stability?.moving_block?.max_endpoint_change_usd;
  const checks = Object.values(data.point_vs_backtest_json ?? {});

  return (
    <>
      <p>{COPY.proofIntervalsLead}</p>
      <BandChart
        aria={COPY.proofIntervalsAria}
        rows={POLICIES.map((p) => ({
          id: p,
          label: POLICY_LABEL[p],
          tone: POLICY_TONE[p],
          lo: mb.p50[p][0],
          mid: data.point.p50[p],
          hi: mb.p50[p][1],
        }))}
      />
      <p className="proof-note">
        {COPY.proofIntervalsBars}{" "}
        <Live value={data.level} display={pct(data.level * 100)} />{" "}
        {COPY.proofIntervalsFrom}{" "}
        <Live value={data.resamples} display={grouped(data.resamples, 0)} />{" "}
        {COPY.proofIntervalsBlocks}{" "}
        <Live value={data.block_len} display={String(data.block_len)} />{" "}
        {COPY.proofIntervalsTick}
      </p>
      <ul className="proof-rows" data-detail="">
        {POLICIES.map((p) => (
          <li key={p} data-policy={p}>
            <strong>{POLICY_LABEL[p]}</strong>: {COPY.proofMedian}{" "}
            {p === "clearlane" ? (
              <Num k="clearlane_p50" />
            ) : (
              <Live
                value={data.point.p50[p]}
                display={signedUsd(data.point.p50[p])}
              />
            )}
            {COPY.proofIntervalWord}{" "}
            <Live value={mb.p50[p][0]} display={signedUsd(mb.p50[p][0])} />{" "}
            {COPY.ribbonTo}{" "}
            <Live value={mb.p50[p][1]} display={signedUsd(mb.p50[p][1])} />{" "}
            {COPY.perMwDay}
          </li>
        ))}
      </ul>
      <p>
        {COPY.proofBeatPre} <Num k="share_days_beating" /> {COPY.proofBeatPost}{" "}
        <Live value={share[0]} display={pct(share[0])} /> {COPY.ribbonTo}{" "}
        <Live value={share[1]} display={pct(share[1])} />.
      </p>
      {stationary || seedUsd !== undefined ? (
        <p>
          {stationary ? (
            <>
              {COPY.proofStationaryPre}{" "}
              <Live value={stationary[0]} display={signedUsd(stationary[0])} />{" "}
              {COPY.proofAnd}{" "}
              <Live value={stationary[1]} display={signedUsd(stationary[1])} />
            </>
          ) : null}
          {seedUsd !== undefined ? (
            <>
              {COPY.proofSeedPre}{" "}
              <Live value={seedUsd} display={signedUsd(seedUsd)} />
            </>
          ) : null}
          .
        </p>
      ) : null}
      {checks.length > 0 ? (
        <p>
          <Live
            value={checks.filter((c) => c.status === "match").length}
            display={String(checks.filter((c) => c.status === "match").length)}
          />{" "}
          {COPY.proofOf}{" "}
          <Live value={checks.length} display={String(checks.length)} />{" "}
          {COPY.proofPointChecks}
        </p>
      ) : null}
    </>
  );
}
