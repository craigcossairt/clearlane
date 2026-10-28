import { Num } from "../../components/Num";
import { COPY } from "../../copy";
import { clock, grouped } from "../../format";
import { PROOF_FILES, type StepStats } from "../sources";

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

/** A p-value at two significant figures; a tiny one in powers of ten, never rounded to zero. */
export function pValue(p: number): string {
  if (p >= 0.001) return String(Number(p.toPrecision(2)));
  const [mantissa, exp] = p.toExponential(1).split("e");
  const power = String(Number(exp))
    .split("")
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join("");
  return `${mantissa} × 10${power}`;
}

const W = 1000;
const PAD_X = 16;
const LABEL = 40;
const PANEL = 150;
const GAP = 28;
const AXIS = 44;
const SLOT = (W - 2 * PAD_X) / 24;

type Month = "october" | "july";

/** Days per hour beginning (0 to 23) for the days inside a [first, last] window. */
export function stepHours(s: StepStats, month: Month): number[] {
  const [first, last] = s.windows[month];
  const out = Array.from({ length: 24 }, () => 0);
  for (const [day, row] of Object.entries(s.per_day)) {
    if (day < first || day > last) continue;
    if (row.hb >= 0 && row.hb < 24) out[row.hb] = (out[row.hb] ?? 0) + 1;
  }
  return out;
}

function Stat({
  id,
  value,
  display,
}: {
  id: string;
  value: number;
  display: string;
}) {
  return (
    <span data-stat={id}>
      <Num
        value={value}
        display={display}
        prov="DERIVED"
        source={PROOF_FILES.stepStats}
        width={3}
      />
    </span>
  );
}

const monthName = (ym: string) =>
  new Date(`${ym}-01T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * science/step_stats.json (#108): the hour each day's largest price step landed in, October above
 * July, with the target hours shaded as a band; then the exact binomial tests, the permutation
 * test the science brief says to quote, the monthly lines and the reproduction checks.
 */
export function StepStatsCard({ data }: { data: StepStats }) {
  const hist = {
    october: stepHours(data, "october"),
    july: stepHours(data, "july"),
  };
  const max = Math.max(1, ...hist.october, ...hist.july);
  const lo = Math.min(...data.target_hb);
  const hi = Math.max(...data.target_hb);
  const H = 2 * (LABEL + PANEL) + GAP + AXIS;
  const perm = data.permutation.october_vs_july;
  const repro = Object.values(data.reproduction ?? {});
  const months = Object.entries(data.months ?? {});

  const panel = (month: Month, top: number) => (
    <g data-hist={month}>
      <text x={PAD_X} y={top + 28}>
        {month === "october" ? COPY.proofOctober : COPY.proofJuly}
      </text>
      <text
        data-axis=""
        className="proof-tick"
        x={W - PAD_X}
        y={top + 28}
        textAnchor="end"
      >
        {`${max} ${COPY.proofDaysWord}`}
      </text>
      <rect
        data-band="target-hours"
        className="proof-target"
        x={PAD_X + lo * SLOT}
        y={top + LABEL}
        width={(hi - lo + 1) * SLOT}
        height={PANEL}
      />
      <line
        className="proof-grid"
        x1={PAD_X}
        x2={W - PAD_X}
        y1={top + LABEL}
        y2={top + LABEL}
      />
      {hist[month].map((days, hb) => {
        const h = (days / max) * PANEL;
        return (
          <rect
            key={hb}
            data-hour={hb}
            data-days={days}
            className={
              hb >= lo && hb <= hi ? "proof-bar proof-bar-target" : "proof-bar"
            }
            x={PAD_X + hb * SLOT + 4}
            y={top + LABEL + PANEL - h}
            width={SLOT - 8}
            height={h}
          />
        );
      })}
      <line
        className="proof-base"
        x1={PAD_X}
        x2={W - PAD_X}
        y1={top + LABEL + PANEL}
        y2={top + LABEL + PANEL}
      />
    </g>
  );

  const julyTop = LABEL + PANEL + GAP;
  const axisY = 2 * (LABEL + PANEL) + GAP + 34;

  return (
    <>
      <p>{COPY.proofStepLead}</p>
      <svg
        className="proof-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={COPY.proofStepAria}
      >
        {panel("october", 0)}
        {panel("july", julyTop)}
        {[0, 6, 12, 18].map((hb, i) => (
          <text
            key={hb}
            data-axis=""
            className="proof-tick"
            x={PAD_X + hb * SLOT + (i === 0 ? 0 : SLOT / 2)}
            y={axisY}
            textAnchor={i === 0 ? "start" : "middle"}
          >
            {clock(hb)}
          </text>
        ))}
      </svg>
      <p className="proof-note">
        {COPY.proofStepShaded}{" "}
        {data.target_hb.map((hb, i) => (
          <span key={hb}>
            {i > 0 ? ` ${COPY.proofAnd} ` : null}
            <span data-time="">{clock(hb)}</span>
          </span>
        ))}
        {COPY.proofStepBars} {COPY.proofStepWindows}{" "}
        <span data-time="">{data.windows.october[0]}</span> {COPY.ribbonTo}{" "}
        <span data-time="">{data.windows.october[1]}</span>,{" "}
        <span data-time="">{data.windows.july[0]}</span> {COPY.ribbonTo}{" "}
        <span data-time="">{data.windows.july[1]}</span>.
      </p>
      <p>
        {COPY.proofStepOctPre}{" "}
        <Stat
          id="october-k"
          value={data.binomial.october.k}
          display={String(data.binomial.october.k)}
        />{" "}
        {COPY.proofOf}{" "}
        <Stat
          id="october-n"
          value={data.binomial.october.n}
          display={String(data.binomial.october.n)}
        />{" "}
        {COPY.proofStepDaysIn} {COPY.proofStepChance}{" "}
        <Stat
          id="october-p"
          value={data.binomial.october.p_value}
          display={pValue(data.binomial.october.p_value)}
        />{" "}
        {COPY.proofStepBinom} {COPY.proofStepJulPre}{" "}
        <Stat
          id="july-k"
          value={data.binomial.july.k}
          display={String(data.binomial.july.k)}
        />{" "}
        {COPY.proofOf}{" "}
        <Stat
          id="july-n"
          value={data.binomial.july.n}
          display={String(data.binomial.july.n)}
        />
        {COPY.proofChance}{" "}
        <Stat
          id="july-p"
          value={data.binomial.july.p_value}
          display={pValue(data.binomial.july.p_value)}
        />
        .
      </p>
      <p>
        {COPY.proofPermPre}{" "}
        <Stat
          id="perm-draws"
          value={perm.b_perms}
          display={grouped(perm.b_perms, 0)}
        />{" "}
        {COPY.proofPermMid}{" "}
        <Stat
          id="perm-hits"
          value={perm.tvd.n_ge}
          display={String(perm.tvd.n_ge)}
        />{" "}
        {COPY.proofPermPost}{" "}
        <Stat
          id="perm-tvd"
          value={perm.observed.tvd}
          display={perm.observed.tvd.toFixed(2)}
        />
        {COPY.proofPermP}{" "}
        <Stat
          id="perm-p"
          value={perm.tvd.p_value}
          display={pValue(perm.tvd.p_value)}
        />
        {perm.tvd.n_ge === 0 ? COPY.proofPermFloor : "."}
      </p>
      {months.length > 0 ? (
        <ul className="proof-rows" data-detail="">
          {months.map(([ym, m]) => (
            <li key={ym} data-month={ym}>
              <span data-time="">{monthName(ym)}</span>:{" "}
              <Stat id={`${ym}-days`} value={m.days} display={String(m.days)} />{" "}
              {COPY.proofMonthDays}{" "}
              {m.modal_hb.map((hb, i) => (
                <span key={hb}>
                  {i > 0 ? ` ${COPY.proofAnd} ` : null}
                  <span data-time="">{clock(hb)}</span>
                </span>
              ))}
              {COPY.proofMonthOn}{" "}
              <Stat
                id={`${ym}-mode`}
                value={m.count_at_mode}
                display={String(m.count_at_mode)}
              />{" "}
              {COPY.proofMonthMedian}{" "}
              <Stat
                id={`${ym}-median`}
                value={m.median_step}
                display={`$${m.median_step.toFixed(2)}`}
              />{" "}
              {COPY.proofPerMwh}
            </li>
          ))}
        </ul>
      ) : null}
      {repro.length > 0 ? (
        <p>
          {COPY.proofStepRepro}{" "}
          <Stat
            id="repro-match"
            value={repro.filter((r) => r.status === "match").length}
            display={String(repro.filter((r) => r.status === "match").length)}
          />{" "}
          {COPY.proofOf}{" "}
          <Stat
            id="repro-total"
            value={repro.length}
            display={String(repro.length)}
          />{" "}
          {COPY.proofChecksMatch}
        </p>
      ) : null}
    </>
  );
}
