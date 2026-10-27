import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  extractCopyKeys,
  extractStageKeys,
  formatReport,
  parseFacts,
  runFactsCheck,
  type Finding,
} from "./lib/facts.mjs";

const repo = fileURLToPath(new URL("./fixtures/facts/repo", import.meta.url));
const cli = fileURLToPath(new URL("./facts-check.mjs", import.meta.url));
const noNumbers = fileURLToPath(
  new URL("./fixtures/facts/repo/public/derived/absent.json", import.meta.url),
);

const find = (
  findings: Finding[],
  level: "FAIL" | "WARN",
  check: number,
  key: string,
) =>
  findings.filter(
    (f) => f.level === level && f.check === check && f.key === key,
  );

describe("parseFacts", () => {
  const facts = parseFacts(readFileSync(`${repo}/docs/FACTS.md`, "utf8"));

  it("reads only 8-cell rows whose first cell is a snake_case key", () => {
    expect([...facts.keys()].sort()).toEqual(
      [
        "alpha_verified",
        "beta_verified",
        "delta_pending",
        "eps_conflict",
        "gamma_pending",
        "iota_conflict",
        "verified_only",
        "zeta_unchecked",
      ].sort(),
    );
  });

  it("reads the status word before any notes", () => {
    expect(facts.get("beta_verified")?.status).toBe("VERIFIED");
    expect(facts.get("beta_verified")?.statusText).toMatch(
      /^VERIFIED\. Checked by verifier/,
    );
    expect(facts.get("gamma_pending")?.status).toBe("PENDING-ENGINE");
    expect(facts.get("eps_conflict")?.status).toBe("CONFLICT");
    expect(facts.get("zeta_unchecked")?.status).toBe("UNCHECKED");
    expect(facts.get("alpha_verified")?.value).toBe("$1.00");
  });

  it("takes the say-instead wording from the claim, else from the Do not say table", () => {
    expect(facts.get("eps_conflict")?.sayInstead).toBe(
      'Say "about five and a half minutes" or "under six".',
    );
    expect(facts.get("iota_conflict")?.sayInstead).toBe(
      '"three, per the case study".',
    );
  });
});

describe("parseFacts wording fallback", () => {
  it("uses a Show or Use sentence when the claim has no Say sentence", () => {
    const md = '| net_climb | Rehearsed "[3,654]". Show "3,655" or "about 3,650". | 3,654.5 MW | DERIVED | s | C2 | 4 | CONFLICT |';
    expect(parseFacts(md).get("net_climb")?.sayInstead).toBe('Show "3,655" or "about 3,650".');
  });
});

describe("extractCopyKeys and extractStageKeys", () => {
  it("finds {key} placeholders like pitch/resolve.mjs and skips the literal {key}", () => {
    expect(
      extractCopyKeys("a {alpha_verified} b {key} c {beta_2} {Not_A_Key}"),
    ).toEqual(["alpha_verified", "beta_2"]);
  });

  it("finds quoted snake_case keys in stageKeys.ts", () => {
    expect(
      extractStageKeys(
        `export const K = ["alpha_verified", 'theta_stage'] as const;`,
      ),
    ).toEqual(["alpha_verified", "theta_stage"]);
  });
});

describe("runFactsCheck with numbers.json", () => {
  const { findings } = runFactsCheck({ root: repo });

  it("check 1: FAIL when a numbers.json key has no FACTS row", () => {
    expect(find(findings, "FAIL", 1, "orphan_key")).toHaveLength(1);
  });

  it("check 2: FAIL when a copy or stage key resolves in neither numbers.json nor a VERIFIED row", () => {
    for (const key of [
      "delta_pending",
      "iota_conflict",
      "zeta_unchecked",
      "unknown_key",
      "theta_stage",
    ]) {
      expect(find(findings, "FAIL", 2, key), key).toHaveLength(1);
    }
    expect(find(findings, "FAIL", 2, "delta_pending")[0]?.message).toContain(
      "pitch/deck.md",
    );
    expect(find(findings, "FAIL", 2, "delta_pending")[0]?.message).toContain(
      "demo/stage-script.md",
    );
    expect(find(findings, "FAIL", 2, "theta_stage")[0]?.message).toContain(
      "app/src/stageKeys.ts",
    );
  });

  it("check 2: passes keys in numbers.json or in a VERIFIED row, and skips non-judge pitch files", () => {
    for (const key of [
      "alpha_verified",
      "beta_verified",
      "eps_conflict",
      "verified_only",
      "skipped_key",
      "key",
    ]) {
      expect(find(findings, "FAIL", 2, key), key).toHaveLength(0);
    }
  });

  it("check 3: WARN when a VERIFIED value differs from numbers.json display, listing both", () => {
    const [w] = find(findings, "WARN", 3, "beta_verified");
    expect(w?.message).toContain("$2.00");
    expect(w?.message).toContain("$2.50");
    expect(find(findings, "WARN", 3, "alpha_verified")).toHaveLength(0);
  });

  it("check 4: WARN when a PENDING-ENGINE key now exists in numbers.json", () => {
    expect(find(findings, "WARN", 4, "gamma_pending")).toHaveLength(1);
    expect(find(findings, "WARN", 4, "delta_pending")).toHaveLength(0);
  });

  it("check 5: WARN when a CONFLICT key is used in judge copy, quoting the say-instead wording", () => {
    expect(find(findings, "WARN", 5, "eps_conflict")[0]?.message).toContain(
      '"about five and a half minutes"',
    );
    expect(find(findings, "WARN", 5, "iota_conflict")[0]?.message).toContain(
      '"three, per the case study"',
    );
  });

  it("counts exactly the expected findings", () => {
    expect(findings.filter((f) => f.level === "FAIL")).toHaveLength(6);
    expect(findings.filter((f) => f.level === "WARN")).toHaveLength(4);
  });
});

describe("runFactsCheck without numbers.json", () => {
  it("warns once, skips the numbers checks and still runs the copy checks", () => {
    const { findings } = runFactsCheck({ root: repo, numbersFile: noNumbers });
    const missing = findings.filter((f) => f.check === 0);
    expect(missing).toHaveLength(1);
    expect(missing[0]?.level).toBe("WARN");
    expect(missing[0]?.message).toContain("numbers.json missing");
    expect(findings.filter((f) => [1, 3, 4].includes(f.check))).toHaveLength(0);
    expect(find(findings, "FAIL", 2, "eps_conflict")).toHaveLength(1);
    expect(find(findings, "FAIL", 2, "beta_verified")).toHaveLength(0);
    expect(find(findings, "FAIL", 2, "delta_pending")).toHaveLength(1);
    expect(find(findings, "WARN", 5, "eps_conflict")).toHaveLength(1);
  });

  it("--allow-pending downgrades only a PENDING-ENGINE copy key to WARN", () => {
    const { findings } = runFactsCheck({
      root: repo,
      numbersFile: noNumbers,
      allowPending: true,
    });
    expect(find(findings, "FAIL", 2, "delta_pending")).toHaveLength(0);
    expect(find(findings, "WARN", 2, "delta_pending")).toHaveLength(1);
    expect(find(findings, "FAIL", 2, "zeta_unchecked")).toHaveLength(1);
  });

  it("--allow-pending does not help when numbers.json exists", () => {
    const { findings } = runFactsCheck({ root: repo, allowPending: true });
    expect(find(findings, "FAIL", 2, "delta_pending")).toHaveLength(1);
  });
});

describe("formatReport", () => {
  it("prints PASS with the WARN count and exit 0 when nothing fails", () => {
    const r = formatReport([
      { level: "WARN", check: 4, key: "k", message: "m" },
    ]);
    expect(r.lines).toEqual(["WARN m", "PASS facts-check (1 WARN)"]);
    expect(r.exitCode).toBe(0);
  });

  it("prints FAIL counts and exit 1", () => {
    const r = formatReport([
      { level: "FAIL", check: 1, key: "a", message: "x" },
      { level: "WARN", check: 3, key: "b", message: "y" },
    ]);
    expect(r.lines.at(-1)).toBe("FAIL facts-check: 1 failures, 1 WARN");
    expect(r.exitCode).toBe(1);
  });
});

describe("facts-check.mjs CLI", () => {
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });

  it("exits 1 on the fixture and prints one line per finding", () => {
    const r = run("--root", repo);
    expect(r.status).toBe(1);
    const lines = r.stdout.trim().split(/\r?\n/);
    expect(lines.at(-1)).toBe("FAIL facts-check: 6 failures, 4 WARN");
    expect(lines.filter((l) => l.startsWith("FAIL ")).length).toBe(7);
    expect(lines.filter((l) => l.startsWith("WARN ")).length).toBe(4);
  });

  it("exits 2 when FACTS.md is missing", () => {
    const r = run(
      "--root",
      fileURLToPath(new URL("./fixtures/facts/nowhere", import.meta.url)),
    );
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/FACTS\.md/);
  });
});
