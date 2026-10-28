import { useMemo, useState } from "react";
import type { Policy, PolicyStats } from "@contracts/types";
import type { Live } from "../beats/types";
import { Num, useNumber } from "../components/Num";
import { hourLabel } from "../components/Time";
import { COPY, PRESENTER } from "../copy";
import { BACKTEST_FILE, loadDerivedFiles, type DerivedFiles } from "../data";
import { grouped, usdPerMw } from "../format";
import { animAttr } from "./motion";

const ENVELOPE_SOURCE = "public/derived/envelope file (engine)";
const COPY_LABELS = [COPY.copyJson, COPY.copied, COPY.copyFailed] as const;

/**
 * Screen 6 (#270). The envelope state is a 24-hour strip: each hour's draw limit as a bar, the
 * System Critical Hours marked. The backtest state is a scorecard: money on paper, then three
 * rules of the road, each passed or failed by the backtest's own values. Both read the engine
 * files through data.ts; nothing is computed here but the pass marks.
 */
export function EnvelopeScreen({
  live,
  backtest,
  derived: injected,
}: {
  live: Live;
  backtest: boolean;
  derived?: DerivedFiles;
}) {
  const derived = injected ?? loadDerivedFiles();
  return (
    <section
      className="beat envelope-beat p-env"
      data-anim={animAttr()}
      aria-label={backtest ? COPY.backtestTitle : COPY.envelopeTitle}
    >
      {backtest ? (
        <Scorecard derived={derived} />
      ) : (
        <EnvelopeHours derived={derived} day={live.bundle.operating_day_mt} />
      )}
    </section>
  );
}

function kw(v: number) {
  return (
    <Num
      value={v}
      display={`${grouped(v, 0)} kW`}
      prov="DERIVED"
      source={ENVELOPE_SOURCE}
    />
  );
}

function EnvelopeHours({
  derived,
  day,
}: {
  derived: DerivedFiles;
  day: string;
}) {
  const [note, setNote] = useState<(typeof COPY_LABELS)[number]>(COPY.copyJson);
  const entry = derived.envelopes[day];
  if (!entry) {
    return (
      <p className="num-not-computed" data-slot="envelope-strip">
        {COPY.notComputedYet}: public/derived/envelope_
        <span data-time="">{day}</span>.json
      </p>
    );
  }
  const hours = entry.envelope.hours;
  const top = Math.max(1, ...hours.map((h) => h.max_charge_kw));
  const reserves = hours.map((h) => h.reserve_kw);
  const ready = Math.min(...reserves);
  // The first and last System Critical Hour, for the label over the marked span.
  const sch = hours.flatMap((h, i) => (h.system_critical ? [i] : []));
  const board =
    typeof navigator !== "undefined" ? (navigator.clipboard ?? null) : null;
  return (
    <div className="p-env-hours" data-slot="envelope-strip">
      <div className="p-env-facts">
        <p className="p-env-fact p-env-fact-sch">
          <span className="p-env-big">
            <Num k="sch_hours_today" width={3} />
          </span>
          <span>{PRESENTER.envelopeSchCount}</span>
        </p>
        <p className="p-env-fact">
          <span className="p-env-swatch is-draw" aria-hidden="true" />
          <span>{PRESENTER.envelopeDrawLabel}</span>
          <span className="p-env-big">{kw(top)}</span>
        </p>
        <p className="p-env-fact">
          <span>{PRESENTER.envelopeReadyLabel}</span>
          <span className="p-env-big">{kw(ready)}</span>
        </p>
      </div>
      <div
        className="p-env-strip"
        role="img"
        aria-label={PRESENTER.envelopeAria}
        style={{ gridTemplateColumns: `repeat(${hours.length}, 1fr)` }}
      >
        {sch.length > 0 ? (
          <span
            className="p-env-sch-band"
            style={{
              gridColumn: `${sch[0]! + 1} / ${sch[sch.length - 1]! + 2}`,
            }}
          >
            <span className="p-env-sch-label">
              {PRESENTER.envelopeSchLabel}
            </span>
          </span>
        ) : null}
        {hours.map((h, i) => (
          <span
            key={h.ts_utc}
            className={`p-env-col${h.system_critical ? " is-sch" : ""}`}
            data-critical={h.system_critical ? "yes" : "no"}
            style={{ gridColumn: i + 1, ["--i" as string]: i }}
          >
            <i
              className="p-env-bar"
              style={{ height: `${(h.max_charge_kw / top) * 100}%` }}
            />
          </span>
        ))}
      </div>
      <div
        className="p-env-axis"
        data-axis=""
        style={{ gridTemplateColumns: `repeat(${hours.length}, 1fr)` }}
      >
        {[0, 6, 12, 18].map((i) => (
          <span key={i} style={{ gridColumn: `${i + 1} / span 4` }}>
            {hourLabel(i)}
          </span>
        ))}
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
        {COPY_LABELS.map((label) => (
          <span
            key={label}
            className={label === note ? "on" : "off"}
            aria-hidden={label !== note}
          >
            {label}
          </span>
        ))}
      </button>
    </div>
  );
}

/** Column order: the baseline, the plan that wins on paper, then Clearlane. */
const ORDER: Policy[] = ["fixed_overnight", "price_only", "clearlane"];
const LABEL: Record<Policy, string> = {
  fixed_overnight: COPY.fixedLabel,
  price_only: COPY.priceOnlyLabel,
  clearlane: COPY.clearlaneLabel,
};

type Mark = "pass" | "fail" | "baseline";

function Verdict({ mark }: { mark: Mark }) {
  const text =
    mark === "pass"
      ? PRESENTER.scorePass
      : mark === "fail"
        ? PRESENTER.scoreFail
        : PRESENTER.scoreBaseline;
  return (
    <span className={`p-mark is-${mark}`}>
      <span className="p-mark-icon" aria-hidden="true">
        {mark === "pass" ? "✓" : mark === "fail" ? "✕" : "–"}
      </span>
      {text}
    </span>
  );
}

function Scorecard({ derived }: { derived: DerivedFiles }) {
  const result = derived.backtest?.result ?? null;
  const budget = useNumber("pulse_cycle_budget")?.value;
  const missed = {
    fixed_overnight: useNumber("calls_missed_by_policy_fixed_overnight_mt")
      ?.value,
    price_only: useNumber("calls_missed_by_policy_price_only_mt")?.value,
    clearlane: useNumber("calls_missed_by_policy_clearlane_mt")?.value,
  } satisfies Record<Policy, number | undefined>;
  const stats = useMemo(
    () =>
      ORDER.map((p) => result?.policies.find((s) => s.policy === p)).filter(
        (s): s is PolicyStats => s !== undefined,
      ),
    [result],
  );
  if (!result || stats.length === 0) {
    return (
      <div className="cards" data-slot="backtest-bands">
        <p className="num-not-computed">
          {COPY.notComputedYet}: {BACKTEST_FILE}. {COPY.emptyNotZero}
        </p>
      </div>
    );
  }
  const topP50 = Math.max(1, ...stats.map((s) => s.usd_per_mw_day.p50));
  const base = missed.fixed_overnight;
  const marks = (s: PolicyStats) =>
    ({
      wear:
        budget === undefined
          ? null
          : s.pulse_cycles_per_yr <= budget
            ? "pass"
            : "fail",
      ceiling: s.host_ceiling_breaches === 0 ? "pass" : "fail",
      calls:
        s.policy === "fixed_overnight"
          ? "baseline"
          : base === undefined || missed[s.policy] === undefined
            ? null
            : missed[s.policy]! < base
              ? "pass"
              : "fail",
    }) as Record<"wear" | "ceiling" | "calls", Mark | null>;
  const live = (value: number, display: string) => (
    <Num
      value={value}
      display={display}
      prov="DERIVED"
      source={BACKTEST_FILE}
    />
  );

  return (
    <div className="p-score" data-slot="backtest-bands">
      <div className="p-score-labels">
        <span className="p-score-head" />
        <span className="p-score-rowlabel is-money">
          {PRESENTER.scoreMoney}
        </span>
        <span className="p-score-rowlabel">
          {PRESENTER.scoreWear} <Num k="pulse_cycle_budget" width={3} />
        </span>
        <span className="p-score-rowlabel">{PRESENTER.scoreCeiling}</span>
        <span className="p-score-rowlabel">
          {PRESENTER.scoreCalls}
          <small>{PRESENTER.scoreCallsRule}</small>
        </span>
      </div>
      {stats.map((s, col) => {
        const v = s.usd_per_mw_day;
        const m = marks(s);
        const allPass =
          m.wear === "pass" && m.ceiling === "pass" && m.calls === "pass";
        return (
          <article
            key={s.policy}
            className={`p-score-col${allPass ? " is-allowed" : ""}`}
            data-policy={s.policy}
            style={{ ["--col" as string]: col }}
          >
            <h3 className="p-score-head">{LABEL[s.policy]}</h3>
            <div className="p-score-cell is-money">
              <span className="p-score-mobile-label">
                {PRESENTER.scoreMoney}
              </span>
              <span className="p-score-money">
                {live(v.p50, usdPerMw(v.p50))}
              </span>
              <span className="p-score-bar" aria-hidden="true">
                <i
                  style={{
                    width: `${(Math.max(0, v.p50) / topP50) * 100}%`,
                  }}
                />
              </span>
              <span className="p-score-range" data-detail="">
                {PRESENTER.scoreMoneyRange} {live(v.p10, usdPerMw(v.p10))}{" "}
                {PRESENTER.scoreMoneyAnd} {live(v.p90, usdPerMw(v.p90))}
              </span>
            </div>
            <div className="p-score-cell" data-rule="wear">
              <span className="p-score-mobile-label">
                {PRESENTER.scoreWear}
              </span>
              <span className="p-score-value">
                {live(s.pulse_cycles_per_yr, grouped(s.pulse_cycles_per_yr, 0))}
              </span>
              {m.wear ? <Verdict mark={m.wear} /> : null}
            </div>
            <div className="p-score-cell" data-rule="ceiling">
              <span className="p-score-mobile-label">
                {PRESENTER.scoreCeiling}
              </span>
              <span className="p-score-value">
                {live(
                  s.host_ceiling_breaches,
                  grouped(s.host_ceiling_breaches, 0),
                )}
              </span>
              <Verdict mark={m.ceiling!} />
            </div>
            <div className="p-score-cell" data-rule="calls">
              <span className="p-score-mobile-label">
                {PRESENTER.scoreCalls}
              </span>
              <span className="p-score-value">
                <Num k={`calls_missed_by_policy_${s.policy}_mt`} width={4} />
              </span>
              {m.calls ? <Verdict mark={m.calls} /> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** "Mon D" for a Mountain day YYYY-MM-DD ("May 1"); noon-ish UTC keeps it on that date. */
export function shortDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
  }).format(new Date(`${day}T18:00:00Z`));
}

/** Screen 6's supporting line after "Show the backtest": the day count, window and share. */
export function BacktestLine() {
  const window = useMemo(
    () => loadDerivedFiles().backtest?.result?.window ?? null,
    [],
  );
  return (
    <span data-detail="" data-slot="backtest-line">
      {PRESENTER.backtestLinePre} <Num k="backtest_days" width={3} />{" "}
      {PRESENTER.backtestLineDays}
      {window ? (
        <>
          {" "}
          <span data-time="">{shortDay(window.start_mt)}</span>{" "}
          {PRESENTER.backtestLineTo}{" "}
          <span data-time="">{shortDay(window.end_mt)}</span>
        </>
      ) : null}
      . {PRESENTER.backtestLineBeats} <Num k="share_days_beating" width={3} />{" "}
      {PRESENTER.backtestLineBeatsTail}
    </span>
  );
}
