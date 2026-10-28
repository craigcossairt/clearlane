import { Num } from "../../components/Num";
import { COPY } from "../../copy";
import { PROOF_FILES, type CrossCheck, type CrossCheckRow } from "../sources";

const ORDER = ["match", "mismatch", "pending"];
const rank = (status: string) => {
  const i = ORDER.indexOf(status);
  return i < 0 ? ORDER.length : i;
};

const STATUS_LABEL: Record<string, string> = {
  match: COPY.proofStatusMatch,
  mismatch: COPY.proofStatusMismatch,
  pending: COPY.proofStatusPending,
};
const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;
const statusClass = (s: string) => (ORDER.includes(s) ? s : "other");

const PER_ROW = 20;
const CELL = 50;
const SIZE = 40;

/**
 * science/crosscheck.json: one square per check, grouped by status, then each check outside its
 * tolerance with the pinned value, the science value and the second path the script also ran.
 * Status is marked by fill, outline and a cross, never by color alone, and named in the legend.
 */
export function CrossCheckCard({ data }: { data: CrossCheck }) {
  const rows = Object.entries(data.checks).sort(
    ([a, ra], [b, rb]) =>
      rank(ra.status) - rank(rb.status) || a.localeCompare(b),
  );
  const counts = new Map<string, number>();
  for (const [, r] of rows)
    counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  const statuses = [...counts.keys()].sort((a, b) => rank(a) - rank(b));
  const H = Math.max(1, Math.ceil(rows.length / PER_ROW)) * CELL;
  const outside = rows.filter(([, r]) => r.status === "mismatch");

  return (
    <>
      <p>{COPY.proofCrossLead}</p>
      <svg
        className="proof-svg proof-squares"
        viewBox={`0 0 ${PER_ROW * CELL} ${H}`}
        role="img"
        aria-label={COPY.proofCrossAria}
      >
        {rows.map(([name, r], i) => (
          <Square
            key={name}
            name={name}
            status={r.status}
            x={(i % PER_ROW) * CELL}
            y={Math.floor(i / PER_ROW) * CELL}
          />
        ))}
      </svg>
      <p className="proof-legend">
        {statuses.map((s) => (
          <span key={s} className="proof-legend-item" data-status-count={s}>
            <svg width={28} height={28} viewBox="0 0 50 50" aria-hidden="true">
              <Square status={s} x={0} y={0} />
            </svg>{" "}
            {statusLabel(s)} <Count value={counts.get(s) ?? 0} />
          </span>
        ))}
      </p>
      {outside.length > 0 ? (
        <>
          <p>{COPY.proofMismatchHead}</p>
          <ul className="proof-checks" data-detail="">
            {outside.map(([name, r]) => (
              <OutsideRow key={name} name={name} row={r} />
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

/** One check's square; without a name it is a legend swatch and carries no check data. */
function Square({
  name,
  status,
  x,
  y,
}: {
  name?: string;
  status: string;
  x: number;
  y: number;
}) {
  return (
    <g>
      {name ? <title>{`${name}: ${statusLabel(status)}`}</title> : null}
      <rect
        data-status={name ? status : undefined}
        className={`proof-sq proof-sq-${statusClass(status)}`}
        x={x + 5}
        y={y + 5}
        width={SIZE}
        height={SIZE}
        rx={6}
      />
      {status === "mismatch" ? (
        <path
          className="proof-sq-mark"
          d={`M${x + 15} ${y + 15}L${x + 35} ${y + 35}M${x + 35} ${y + 15}L${x + 15} ${y + 35}`}
        />
      ) : null}
    </g>
  );
}

function Count({ value }: { value: number }) {
  return (
    <Num
      value={value}
      display={String(value)}
      prov="DERIVED"
      source={PROOF_FILES.crosscheck}
      width={3}
    />
  );
}

const scalar = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** A value from the file, shown exactly as the script wrote it, or to four places. */
function Value({ value, places }: { value: unknown; places?: number }) {
  const n = scalar(value);
  return (
    <Num
      value={n}
      display={
        n === null || places === undefined ? String(n) : n.toFixed(places)
      }
      prov="DERIVED"
      source={PROOF_FILES.crosscheck}
      reason={
        typeof value === "object" && value !== null
          ? `${COPY.proofNotScalar} ${PROOF_FILES.crosscheck}`
          : undefined
      }
      width={3}
    />
  );
}

/**
 * Science's verdict stands, but a check that misses only a tolerance finer than a cent says so:
 * otherwise "outside tolerance" beside a headline reads as "the headline is wrong".
 */
const sameToTheCent = (a: number | null, b: number | null) =>
  a !== null && b !== null && Math.round(a * 100) === Math.round(b * 100);

function OutsideRow({ name, row }: { name: string; row: CrossCheckRow }) {
  const second = row.second_path;
  const pinned = scalar(row.pinned?.facts);
  const science = scalar(row.science);
  return (
    <li data-check={name}>
      <code data-copy-ok="check name">{name}</code>
      {row.unit ? (
        <>
          {" "}
          (<span data-copy-ok="unit named in the file">{row.unit}</span>)
        </>
      ) : null}
      :{" "}
      {sameToTheCent(pinned, science) ? (
        <>
          <span data-same-cent="">{COPY.proofSameCent}</span> {COPY.proofPinned}{" "}
          <Value value={pinned} places={4} />, {COPY.proofScience}{" "}
          <Value value={science} places={4} />, {COPY.proofDifference}{" "}
          <Value value={science! - pinned!} places={4} />.
        </>
      ) : (
        <>
          {COPY.proofPinned} <Value value={row.pinned?.facts} />,{" "}
          {COPY.proofScience} <Value value={row.science} />.
        </>
      )}
      {second ? (
        <>
          <br />
          {COPY.proofSecondPath}
          {second.source ? (
            <>
              {" "}
              {COPY.proofFrom}{" "}
              <span data-copy-ok="source named in the file">
                {second.source}
              </span>
            </>
          ) : null}
          : <Value value={second.value} />,{" "}
          {second.passes_tolerance
            ? COPY.proofSecondPathPasses
            : COPY.proofSecondPathFails}
          .
        </>
      ) : null}
      {row.tolerance ? (
        <>
          <br />
          {COPY.proofTolerance}{" "}
          <span data-copy-ok="tolerance written in the file">
            {row.tolerance}
          </span>
          .
        </>
      ) : null}
    </li>
  );
}
