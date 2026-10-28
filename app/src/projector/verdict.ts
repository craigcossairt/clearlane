// Pure rules and the exit code for app/scripts/projector-check.mjs (docs/lanes/ui.md section 4,
// core 12). The script measures the page in a browser; everything that decides PASS, FAIL or
// could-not-run lives here, so vitest can pin it without a browser.

export type ExitCode = 0 | 1 | 2;

export interface CheckRun {
  /** Why the check could not run (Playwright missing, server unreachable, browser launch failed). */
  couldNotRun: string | null;
  /** How many page states were measured. Zero measured states is never a PASS. */
  statesChecked: number;
  violations: string[];
}

export interface Verdict {
  code: ExitCode;
  lines: string[];
}

/** 0 PASS, 1 FAIL with each violation listed, 2 could not run. A could-not-run is never 1. */
export function verdict(run: CheckRun): Verdict {
  if (run.couldNotRun !== null)
    return { code: 2, lines: [`COULD NOT RUN projector-check: ${run.couldNotRun}`] };
  if (run.statesChecked <= 0)
    return { code: 2, lines: ["COULD NOT RUN projector-check: no page state was measured"] };
  if (run.violations.length > 0)
    return {
      code: 1,
      lines: [
        ...run.violations.map((v) => `FAIL ${v}`),
        `FAIL projector-check: ${run.violations.length} violation(s) in ${run.statesChecked} states`,
      ],
    };
  return { code: 0, lines: [`PASS projector-check: ${run.statesChecked} states, 0 violations`] };
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Layout noise below half a pixel is not a moved slot. */
export const BOX_TOLERANCE_PX = 0.5;

export function boxesDiffer(a: Box, b: Box, tol = BOX_TOLERANCE_PX): boolean {
  return (
    Math.abs(a.x - b.x) > tol ||
    Math.abs(a.y - b.y) > tol ||
    Math.abs(a.width - b.width) > tol ||
    Math.abs(a.height - b.height) > tol
  );
}

const fmt = (b: Box) =>
  `${b.width.toFixed(1)}x${b.height.toFixed(1)} at ${b.x.toFixed(1)},${b.y.toFixed(1)}`;

/**
 * Slots present in both states must keep the same box. A slot that exists in only one state
 * (the close card before Right) is not compared; keys are "name#index".
 */
export function slotChanges(
  label: string,
  before: Record<string, Box>,
  after: Record<string, Box>,
): string[] {
  const out: string[] = [];
  for (const [key, a] of Object.entries(before)) {
    const b = after[key];
    if (b && boxesDiffer(a, b)) out.push(`${label}: [data-slot=${key}] moved from ${fmt(a)} to ${fmt(b)}`);
  }
  return out;
}

export function noSidewaysScroll(label: string, scrollWidth: number, clientWidth: number): string[] {
  return scrollWidth > clientWidth
    ? [`${label}: sideways scroll, scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`]
    : [];
}

export interface NumSample {
  /** The data-num value. */
  key: string;
  box: Box;
  /** The enclosing [data-slot] name and box, if any. */
  slot: { name: string; box: Box } | null;
  scrollWidth: number;
  clientWidth: number;
}

/** Every [data-num] stays inside its [data-slot] and is not clipped. */
export function numFits(label: string, n: NumSample, tol = BOX_TOLERANCE_PX): string[] {
  const out: string[] = [];
  if (n.scrollWidth > n.clientWidth + 1)
    out.push(`${label}: [data-num=${n.key}] overflows (scrollWidth ${n.scrollWidth} > ${n.clientWidth})`);
  if (n.slot) {
    const s = n.slot.box;
    const b = n.box;
    if (
      b.x < s.x - tol ||
      b.y < s.y - tol ||
      b.x + b.width > s.x + s.width + tol ||
      b.y + b.height > s.y + s.height + tol
    )
      out.push(`${label}: [data-num=${n.key}] ${fmt(b)} spills out of [data-slot=${n.slot.name}] ${fmt(s)}`);
  }
  return out;
}

export type TextKind = "num" | "chip" | "text";

/** Minimum on-screen font sizes at 1920x1080. */
export const MIN_FONT_PX: Record<TextKind, number> = { num: 40, chip: 18, text: 24 };

export interface TextSample {
  kind: TextKind;
  /** Effective rendered size in CSS px (SVG text is scaled by its transform). */
  px: number;
  /** A short description for the violation line: tag, slot or key, and the first words. */
  what: string;
}

export function fontTooSmall(label: string, t: TextSample): string[] {
  const min = MIN_FONT_PX[t.kind];
  return t.px + 0.05 < min ? [`${label}: ${t.kind} ${t.px.toFixed(1)}px < ${min}px: ${t.what}`] : [];
}

/** Every request the page makes must be same-origin (data: and blob: never leave the page). */
export function offOrigin(label: string, url: string, base: string): string[] {
  if (/^(data|blob):/i.test(url)) return [];
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return [`${label}: unparseable request URL ${url}`];
  }
  return origin === new URL(base).origin ? [] : [`${label}: request to another origin ${url}`];
}
