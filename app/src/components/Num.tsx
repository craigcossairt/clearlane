import { createContext, useContext } from "react";
import type { Provenance, StageNumber } from "@contracts/types";
import { COPY } from "../copy";
import { NUMBERS_FILE } from "../data";
import { Chip } from "./Chip";

export type NumbersState =
  | { state: "ready"; numbers: StageNumber[] | null }
  | { state: "loading" }
  | { state: "failed"; file: string };

export const NumbersContext = createContext<NumbersState>({
  state: "ready",
  numbers: null,
});

export function findNumber(
  ctx: NumbersState,
  key: string,
): StageNumber | undefined {
  return ctx.state === "ready"
    ? ctx.numbers?.find((n) => n.key === key)
    : undefined;
}

/** Read a key's value for layout (a slider range); undefined means not computed. */
export function useNumber(key: string): StageNumber | undefined {
  return findNumber(useContext(NumbersContext), key);
}

type KeyProps = { k: string; width?: number };
type LiveProps = {
  value: number | null;
  display: string;
  prov: Provenance;
  source: string;
  /** Why a null value is unavailable. */
  reason?: string;
  asOf?: string;
  width?: number;
};

function Frame({
  state,
  prov,
  keyName,
  width,
  children,
}: {
  state: "ok" | "loading" | "not-computed" | "unavailable" | "failed";
  prov?: Provenance;
  keyName?: string;
  width: number;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`num num-${state}`}
      data-num={keyName ?? "live"}
      data-prov={prov ?? "none"}
      data-num-state={state}
      style={{ minWidth: `${width}ch` }}
    >
      {children}
    </span>
  );
}

/**
 * <Num k="key" /> renders a numbers.json entry; <Num value display prov source /> renders a
 * live engine value. A missing key renders "not computed", never 0.
 */
export function Num(props: KeyProps | LiveProps) {
  const ctx = useContext(NumbersContext);
  const width = props.width ?? 6;
  if ("k" in props) {
    if (ctx.state === "loading")
      return (
        <Frame state="loading" keyName={props.k} width={width}>
          <span className="num-placeholder" aria-label={COPY.loading} />
        </Frame>
      );
    if (ctx.state === "failed")
      return (
        <Frame state="failed" keyName={props.k} width={width}>
          {COPY.failed}: {ctx.file}
        </Frame>
      );
    const n = findNumber(ctx, props.k);
    if (!n)
      return (
        <Frame state="not-computed" keyName={props.k} width={width}>
          <span title={`${props.k} is not in ${NUMBERS_FILE}`}>
            {COPY.notComputed}
          </span>
        </Frame>
      );
    return (
      <Frame state="ok" prov={n.prov} keyName={props.k} width={width}>
        <span className="figure">{n.display}</span>
        <Chip
          prov={n.prov}
          source={n.source}
          asOf={n.as_of_mt}
          numKey={n.key}
          display={n.display}
        />
      </Frame>
    );
  }
  if (props.value === null || !Number.isFinite(props.value))
    return (
      <Frame state="unavailable" prov={props.prov} width={width}>
        {COPY.unavailable}
        {props.reason ? `: ${props.reason}` : ""}
      </Frame>
    );
  return (
    <Frame state="ok" prov={props.prov} width={width}>
      <span className="figure">{props.display}</span>
      <Chip
        prov={props.prov}
        source={props.source}
        asOf={props.asOf}
        display={props.display}
      />
    </Frame>
  );
}
