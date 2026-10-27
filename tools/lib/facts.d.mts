import type { StageNumber } from "../../contracts/types";

export type FactStatus = "VERIFIED" | "UNCHECKED" | "CONFLICT" | "PENDING-ENGINE" | "OTHER";

export interface FactRow {
  key: string;
  claim: string;
  value: string;
  cls: string;
  source: string;
  rederive: string;
  lvl: string;
  status: FactStatus;
  statusText: string;
  sayInstead?: string;
}

export interface Finding {
  level: "FAIL" | "WARN";
  /** 1 to 5 per integration.md section 6.9; 0 for numbers.json missing. */
  check: number;
  key: string;
  message: string;
}

export class CouldNotRun extends Error {}

export function parseFacts(markdown: string): Map<string, FactRow>;
export function extractCopyKeys(text: string): string[];
export function extractStageKeys(text: string): string[];
export function checkFacts(input: {
  facts: Map<string, FactRow>;
  numbers: Pick<StageNumber, "key" | "display">[] | null;
  uses: Map<string, string[]>;
  allowPending?: boolean;
}): Finding[];
export function judgeCopyFiles(root: string): string[];
export function runFactsCheck(input: { root: string; numbersFile?: string; allowPending?: boolean }): {
  findings: Finding[];
};
export function formatReport(findings: Finding[]): { lines: string[]; exitCode: 0 | 1 };
