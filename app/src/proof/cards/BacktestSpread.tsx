import type { BacktestResult, PolicyStats } from "@contracts/types";
import { Num } from "../../components/Num";
import { COPY } from "../../copy";
import { PROOF_FILES } from "../sources";
import { BandChart, POLICY_LABEL, POLICY_TONE, signedUsd } from "./BandChart";

/**
 * backtest.json as bands: for each timetable, P10 to P90 across the window's days, the P50 as a
 * tick and the mean as a dot. Clearlane's percentiles are the pinned numbers.json keys, so the
 * card and beat 5 can never disagree; the others are read live from the file.
 */
export function BacktestSpread({ result }: { result: BacktestResult }) {
  const rows = result.policies;

  return (
    <>
      <p>{COPY.proofBacktestLead}</p>
      <BandChart
        aria={COPY.proofBacktestAria}
        rows={rows.map((p) => ({
          id: p.policy,
          label: POLICY_LABEL[p.policy],
          tone: POLICY_TONE[p.policy],
          lo: p.usd_per_mw_day.p10,
          mid: p.usd_per_mw_day.p50,
          hi: p.usd_per_mw_day.p90,
          mean: p.usd_per_mw_day.mean,
        }))}
      />
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
      <strong>{POLICY_LABEL[stats.policy]}</strong>:{" "}
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
      display={signedUsd(value)}
      prov="DERIVED"
      source={PROOF_FILES.backtest}
    />
  );
}
