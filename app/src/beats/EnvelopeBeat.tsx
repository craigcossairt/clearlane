import { useState } from "react";
import type { BacktestResult, Policy, PolicyStats } from "@contracts/types";
import { Num } from "../components/Num";
import { hourLabel } from "../components/Time";
import { COPY } from "../copy";
import { BACKTEST_FILE, loadDerivedFiles, type DerivedFiles } from "../data";
import { grouped, usdPerMw } from "../format";
import type { BeatProps } from "./types";

const POLICY_LABEL: Record<Policy, string> = {
  fixed_overnight: COPY.fixedLabel,
  price_only: COPY.priceOnlyLabel,
  clearlane: COPY.clearlaneLabel,
};
const COPY_LABELS = [COPY.copyJson, COPY.copied, COPY.copyFailed] as const;

export interface EnvelopeBeatProps extends BeatProps {
  /** Injected in tests; defaults to the files bundled at build time. */
  derived?: DerivedFiles;
  clipboard?: { writeText: (text: string) => Promise<void> } | null;
}

/**
 * Beat 5: E shows the precomputed envelope file for the stage day; B flips to the backtest
 * card from backtest.json. Both are engine files read through data.ts; nothing is computed
 * here. A missing file is "not computed yet"; an envelope for another day is the failed state.
 */
export function EnvelopeBeat(props: EnvelopeBeatProps) {
  const { live, backtest } = props;
  const derived = props.derived ?? loadDerivedFiles();
  const day = live.bundle.operating_day_mt;
  return (
    <section className="beat envelope-beat" aria-labelledby="beat-envelope">
      <h2 id="beat-envelope">
        {backtest ? COPY.backtestTitle : COPY.envelopeTitle}
      </h2>
      {backtest ? (
        <BacktestCard result={derived.backtest?.result ?? null} />
      ) : (
        <EnvelopeStrip
          derived={derived}
          day={day}
          clipboard={props.clipboard}
        />
      )}
    </section>
  );
}

function EnvelopeStrip({
  derived,
  day,
  clipboard,
}: {
  derived: DerivedFiles;
  day: string;
  clipboard?: { writeText: (text: string) => Promise<void> } | null;
}) {
  const [note, setNote] = useState<(typeof COPY_LABELS)[number]>(COPY.copyJson);
  const entry = derived.envelopes[day];
  const others = Object.keys(derived.envelopes);
  if (!entry) {
    return others.length > 0 ? (
      <p className="num-failed" role="alert" data-slot="envelope-strip">
        {COPY.failed}: {COPY.envelopeOtherDay}{" "}
        {others.map((d) => (
          <span key={d} data-time="">
            {d}
          </span>
        ))}
        {COPY.envelopeStageDay} <span data-time="">{day}</span>.
      </p>
    ) : (
      <p className="num-not-computed" data-slot="envelope-strip">
        {COPY.notComputedYet}: public/derived/envelope_<span data-time="">{day}</span>.json
      </p>
    );
  }
  const env = entry.envelope;
  const board =
    clipboard !== undefined
      ? clipboard
      : typeof navigator !== "undefined"
        ? (navigator.clipboard ?? null)
        : null;
  return (
    <div data-slot="envelope-strip">
      <p>
        <span data-copy-ok="engine sch_rule text and schema id">
          {env.sch_rule} {COPY.schemaWord} {env.schema}.
        </span>{" "}
        {COPY.workingExample}
      </p>
      <div className="scroll" data-detail="">
        <table className="envelope-table">
          <thead>
            <tr>
              <th>{COPY.colHour}</th>
              <th>{COPY.colReserve}</th>
              <th>{COPY.colMaxCharge}</th>
              <th>{COPY.colMaxDischarge}</th>
              <th>{COPY.colPlanned}</th>
              <th>{COPY.colReason}</th>
            </tr>
          </thead>
          <tbody>
            {env.hours.map((hour, index) => (
              <tr
                key={hour.ts_utc}
                className={hour.system_critical ? "critical" : undefined}
                data-critical={hour.system_critical ? "yes" : "no"}
              >
                <td>
                  <span data-time="">{hourLabel(index)}</span>
                  {hour.system_critical ? (
                    <span className="sch-tag"> {COPY.schShort}</span>
                  ) : null}
                </td>
                <Kw v={hour.reserve_kw} />
                <Kw v={hour.max_charge_kw} />
                <Kw v={hour.max_discharge_kw} />
                <Kw v={hour.planned_kw} />
                <td data-copy-ok="engine reason text">{hour.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="ghost-btn copy-btn"
        data-slot="copy-json"
        type="button"
        onClick={() => {
          if (!board) {
            setNote(COPY.copyFailed);
            return;
          }
          board.writeText(entry.raw).then(
            () => setNote(COPY.copied),
            () => setNote(COPY.copyFailed),
          );
        }}
      >
        {/* Every label is rendered and stacked, so the button keeps the widest one's width. */}
        {COPY_LABELS.map((label) => (
          <span key={label} className={label === note ? "on" : "off"} aria-hidden={label !== note}>
            {label}
          </span>
        ))}
      </button>
    </div>
  );
}

function Kw({ v }: { v: number }) {
  return (
    <td>
      <Num
        value={v}
        display={`${grouped(v, 0)} kW`}
        prov="DERIVED"
        source="public/derived/envelope file (engine)"
      />
    </td>
  );
}

function BacktestCard({ result }: { result: BacktestResult | null }) {
  if (!result) {
    return (
      <div className="cards" data-slot="backtest-bands">
        <p className="num-not-computed">
          {COPY.notComputedYet}: {BACKTEST_FILE}. {COPY.emptyNotZero}
        </p>
      </div>
    );
  }
  return (
    <>
      <p>
        {COPY.backtestWindow} <Num k="backtest_days" /> {COPY.daysWord}{" "}
        <span data-time="">{result.window.start_mt}</span> {COPY.ribbonTo}{" "}
        <span data-time="">{result.window.end_mt}</span>
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
        . {COPY.shareBeating} <Num k="share_days_beating" />.
      </p>
      <div className="cards three" data-slot="backtest-bands">
        {result.policies.map((p) => (
          <PolicyCard key={p.policy} stats={p} />
        ))}
      </div>
    </>
  );
}

function PolicyCard({ stats }: { stats: PolicyStats }) {
  const v = stats.usd_per_mw_day;
  const live = (value: number, display: string) => (
    <Num value={value} display={display} prov="DERIVED" source={BACKTEST_FILE} />
  );
  return (
    <article className="card" data-policy={stats.policy}>
      <h3>{POLICY_LABEL[stats.policy]}</h3>
      <p>
        <span data-copy-ok="percentile names">{COPY.bandP10}</span>
        {live(v.p10, usdPerMw(v.p10))} <span data-copy-ok="percentile names">{COPY.bandP50}</span>
        {live(v.p50, usdPerMw(v.p50))} <span data-copy-ok="percentile names">{COPY.bandP90}</span>
        {live(v.p90, usdPerMw(v.p90))} {COPY.perMwDay}
      </p>
      <p>
        {COPY.cyclesYear} {live(stats.pulse_cycles_per_yr, grouped(stats.pulse_cycles_per_yr, 0))}{" "}
        {COPY.against} <Num k="pulse_cycle_budget" /> {COPY.budgetWord}
      </p>
      <p>
        {COPY.callsUnanswerable} {COPY.heatmapMountain}{" "}
        {live(
          stats.calls_unanswerable_pct.heatmap_as_mt,
          `${grouped(stats.calls_unanswerable_pct.heatmap_as_mt, 0)}%`,
        )}
        , {COPY.heatmapUtc}{" "}
        {live(
          stats.calls_unanswerable_pct.heatmap_as_utc,
          `${grouped(stats.calls_unanswerable_pct.heatmap_as_utc, 0)}%`,
        )}
        .
      </p>
      <p>
        {COPY.daysBeating}{" "}
        {live(
          stats.days_beating_fixed_overnight_pct,
          `${grouped(stats.days_beating_fixed_overnight_pct, 0)}%`,
        )}
        . {COPY.ceilingBreaches}{" "}
        {live(stats.host_ceiling_breaches, grouped(stats.host_ceiling_breaches, 0))}.
      </p>
    </article>
  );
}
