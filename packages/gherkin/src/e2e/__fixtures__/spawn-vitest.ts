import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isArray, isError, isObject, isString } from "@lindorm/is";

export const META_FIXTURES_DIRECTORY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../meta-fixtures",
);

// ESC via fromCharCode: a literal control character in a regex trips lint.
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

export const stripAnsi = (text: string): string => text.replace(ANSI_PATTERN, "");

/**
 * The vitest bin script named by an installed package.json — resolved from
 * the manifest rather than a PATH lookup, so the child runs the exact vitest
 * this workspace installed.
 */
export const toVitestBinPath = (packageJsonPath: string): string => {
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    bin?: Record<string, unknown>;
  };

  if (isObject(manifest.bin) && isString(manifest.bin.vitest)) {
    return resolve(dirname(packageJsonPath), manifest.bin.vitest);
  }

  throw new Error(`${packageJsonPath} declares no bin.vitest`);
};

const require = createRequire(import.meta.url);

export const resolveVitestBin = (): string =>
  toVitestBinPath(require.resolve("vitest/package.json"));

export type ChildSummary = {
  /** e.g. "9 failed | 1 passed | 2 skipped (12)" */
  testFiles: string;
  /** e.g. "11 failed | 4 passed (15)" */
  tests: string;
};

const TEST_FILES_PATTERN = /^\s*Test Files\s+(.+)$/m;
// "Tests" never matches the "Test Files" line — the anchored word differs.
const TESTS_PATTERN = /^\s*Tests\s+(.+)$/m;

/**
 * The reporter's summary lines — the only trustworthy signal (house rule:
 * printed test counts, never exit codes). A child that died before printing
 * them is a failed run, so their absence throws the full output.
 */
export const readSummary = (output: string): ChildSummary => {
  const testFiles = TEST_FILES_PATTERN.exec(output);
  const tests = TESTS_PATTERN.exec(output);

  if (isArray(testFiles) && isArray(tests)) {
    return { testFiles: testFiles[1].trim(), tests: tests[1].trim() };
  }

  throw new Error(`child output carries no summary lines:\n${output}`);
};

export type MetaRunResult = {
  /** ANSI-stripped stdout followed by stderr. */
  output: string;
  summary: ChildSummary;
};

/**
 * Spawns `vitest run --reporter=verbose [args]` as a CHILD PROCESS with the
 * given directory as cwd — its vitest.config.ts becomes the config (or the
 * one `--config` in args names) and the directory the root. Only the child's
 * PRINTED output is returned: an empty suite is a collection error invisible
 * in exit codes and counts, so the callers assert reporter text, never
 * process status.
 */
export const runVitestChild = (
  directory: string,
  args: Array<string> = [],
): MetaRunResult => {
  const env = Object.fromEntries(
    // The parent IS a vitest worker; its VITEST* vars must not leak into a
    // child that is a fresh vitest CLI of its own.
    Object.entries(process.env).filter(([key]) => key.startsWith("VITEST") === false),
  );

  const result = spawnSync(
    process.execPath,
    [resolveVitestBin(), "run", "--reporter=verbose", ...args],
    {
      cwd: directory,
      encoding: "utf8",
      env: { ...env, CI: "true", NO_COLOR: "1" },
      timeout: 150_000,
    },
  );

  if (isError(result.error)) {
    throw result.error;
  }

  const output = stripAnsi(`${result.stdout}\n${result.stderr}`);

  return { output, summary: readSummary(output) };
};

export const runMetaFixture = (
  fixture: string,
  args: Array<string> = [],
): MetaRunResult => runVitestChild(join(META_FIXTURES_DIRECTORY, fixture), args);
