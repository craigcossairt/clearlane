// Pure rules for the offline guard (offline.test.tsx). Snapshot mode makes no network request.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * data.ts bundles every file at build time, so no request is expected at all. If it ever adds a
 * same-origin fetch fallback, only relative paths under data/ and derived/ may pass.
 */
export function isAllowedRequest(url: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//") || url.startsWith("/")) return false;
  const clean = url.replace(/^\.\//, "");
  if (clean.split(/[/?#]/).includes("..")) return false;
  return /^(data|derived)\/[^?#]+$/.test(clean);
}

/** Every absolute http or https URL in a file's text, with its line number. */
export function findExternalUrls(text: string): { line: number; url: string }[] {
  const out: { line: number; url: string }[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const m of line.matchAll(/https?:\/\/[^\s"'`)<>]*/gi)) out.push({ line: i + 1, url: m[0] });
  });
  return out;
}

/** Tests, the test fixtures and the stored snapshots are not stage source. */
export function isScannedSource(rel: string): boolean {
  const p = rel.split(path.sep).join("/");
  if (/\.test\.(ts|tsx)$/.test(p)) return false;
  if (p.startsWith("app/src/test/fixtures/")) return false;
  if (p.startsWith("app/src/__snapshots__/")) return false;
  return true;
}

/** app/index.html plus every scanned file under app/src, as repo-relative paths. */
export function stageSourceFiles(repoRoot: string): string[] {
  const out = ["app/index.html"];
  const walk = (dir: string) => {
    for (const e of readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (isScannedSource(rel)) out.push(rel);
    }
  };
  walk("app/src");
  return out;
}

/** "file:line url" for every external URL in stage source. */
export function scanStageSource(repoRoot: string): string[] {
  return stageSourceFiles(repoRoot).flatMap((rel) =>
    findExternalUrls(readFileSync(path.join(repoRoot, rel), "utf8")).map(
      (hit) => `${rel}:${hit.line} ${hit.url}`,
    ),
  );
}
