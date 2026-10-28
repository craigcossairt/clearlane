export interface RequestVerdict {
  ok: boolean;
  reason: string;
}
export interface BundleFinding {
  level: "FAIL" | "INFO";
  url: string;
  reason: string;
}
export function isSameOrigin(url: string, origin: string): boolean;
export function classifyRequest(url: string, origin: string, opts?: { dataMode?: string }): RequestVerdict;
export function scanBundleText(text: string): BundleFinding[];
export const BEAT_KEYS: Record<1 | 2 | 3 | 4 | 5 | 6, string[]>;
export const RESET_KEY: string;
export function summaryLine(r: { violations: number; sameOrigin: number; beatsDriven: number }): string;
export const PRESENTER_NEXT_KEY: string;
export const PRESENTER_MAX_PRESSES: number;
export function presenterWalkDone(
  before: { screen?: string; actions?: string; state?: string },
  after: { screen?: string; actions?: string; state?: string },
): boolean;
export function presenterSummaryLine(r: { violations: number; sameOrigin: number; screens: number; actions: number }): string;
