#!/usr/bin/env tsx
/**
 * CLI wrapper for `rewriteSource`. Runs the codemod against one or more files
 * on disk, writing changes in place. `.cts`, `.mts`, and `.d.ts` files are
 * skipped at the file-type level.
 *
 *   tsx scripts/codemods/esm-rewrite-cli.ts path/to/file.ts [...more]
 *
 * For each file, the wrapper walks up the directory tree to find the owning
 * package's `package.json`, extracts any `imports` field, and resolves subpath
 * patterns (e.g. `#internal/*`) to an absolute source base directory. That map
 * is passed to `rewriteSource` so subpath specifiers receive the same
 * file-vs-directory treatment as relative specifiers.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  rewriteSource,
  type SubpathImportsMap,
  type SubpathImportEntry,
} from "./esm-rewrite";
import { applyTypeOnlyFixes, findTypeOnlyImports } from "./esm-rewrite-type-only";

const SKIPPED_BASENAMES = new Set([".cts", ".mts"]);

const rawArgs = process.argv.slice(2);
const flagSet = new Set<string>();
const args: string[] = [];
for (const a of rawArgs) {
  if (a === "--type-only" || a === "--with-program") {
    flagSet.add("type-only");
    continue;
  }
  args.push(a);
}
const typeOnlyMode = flagSet.has("type-only");

if (args.length === 0) {
  console.error(
    "usage: tsx scripts/codemods/esm-rewrite-cli.ts [--type-only] <file.ts> [...more]",
  );
  process.exit(2);
}

const existsCache = new Map<string, boolean>();
const dirCache = new Map<string, boolean>();

const fileExists = (absPath: string): boolean => {
  let v = existsCache.get(absPath);
  if (v === undefined) {
    try {
      v = fs.statSync(absPath).isFile();
    } catch {
      v = false;
    }
    existsCache.set(absPath, v);
  }
  return v;
};

const isDirectory = (absPath: string): boolean => {
  let v = dirCache.get(absPath);
  if (v === undefined) {
    try {
      v = fs.statSync(absPath).isDirectory();
    } catch {
      v = false;
    }
    dirCache.set(absPath, v);
  }
  return v;
};

// ---------------------------------------------------------------------------
// Subpath imports discovery
// ---------------------------------------------------------------------------

type PackageJson = {
  imports?: Record<string, unknown>;
};

const pkgRootCache = new Map<string, string | null>();
const subpathCache = new Map<string, SubpathImportsMap | undefined>();

const findPackageRoot = (fromDir: string): string | null => {
  const cached = pkgRootCache.get(fromDir);
  if (cached !== undefined) return cached;

  let current = fromDir;
  while (true) {
    const candidate = path.join(current, "package.json");
    if (fileExists(candidate)) {
      pkgRootCache.set(fromDir, current);
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      pkgRootCache.set(fromDir, null);
      return null;
    }
    current = parent;
  }
};

/**
 * Check whether a pattern's resolved value already provides a file extension.
 * E.g. `"./dist/internal/*.js"` — the `*` maps to a `.js` file, so Node
 * resolves `#internal/foo` → `./dist/internal/foo.js` directly. The codemod
 * should NOT append `.js` to the specifier in this case.
 */
const patternProvidesExtension = (value: unknown): boolean => {
  const checkLeg = (leg: string): boolean => {
    const starIdx = leg.lastIndexOf("*");
    if (starIdx === -1) return false;
    const afterStar = leg.slice(starIdx + 1);
    return KNOWN_DIST_EXTENSIONS.some((ext) => afterStar === ext);
  };

  if (typeof value === "string") return checkLeg(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    // Check `default` leg (the one Node uses at runtime).
    const def = record.default;
    if (typeof def === "string") return checkLeg(def);
  }
  return false;
};

const KNOWN_DIST_EXTENSIONS = [".js", ".mjs", ".cjs", ".json"];

/**
 * Extract the absolute source base directory from a `package.json` imports map
 * value. Handles three shapes:
 *   1. Conditional object with `types` / `source` / `default` legs — pick
 *      `types`, else `source`, else the first string value.
 *   2. Flat string (`"./dist/internal/*.js"`) — infer source path by replacing
 *      a leading `./dist/` with `./src/` and `.js` with `.ts`, then verify the
 *      inferred directory exists. If ambiguous, skip with a warning.
 *
 * Returns the entry for the subpath imports map. When the pattern value already
 * provides a file extension, `providesExtension` is set so the codemod leaves
 * the specifier untouched.
 */
const extractBaseDir = (
  pkgRoot: string,
  pattern: string,
  value: unknown,
): SubpathImportEntry | null => {
  const providesExt = patternProvidesExtension(value);

  const resolveLeg = (leg: string): string | null => {
    // leg must contain "*" and point at a .ts/.tsx file for source typecheck.
    const starIndex = leg.indexOf("*");
    if (starIndex === -1) return null;
    const prefix = leg.slice(0, starIndex); // e.g. "./src/internal/"
    const absPrefix = path.resolve(pkgRoot, prefix);
    // absPrefix may end in "/"; strip trailing separator.
    return absPrefix.replace(/[/\\]+$/, "");
  };

  const wrapResult = (baseDir: string): SubpathImportEntry =>
    providesExt ? { baseDir, providesExtension: true } : baseDir;

  if (typeof value === "string") {
    // Flat string — try to infer a source leg.
    const inferred = value.replace(/^\.\/dist\//, "./src/").replace(/\.js$/, ".ts");
    const base = resolveLeg(inferred);
    if (base && isDirectory(base)) return wrapResult(base);
    console.warn(
      `warn[subpath-imports] could not infer source base for pattern "${pattern}" in ${pkgRoot}; skipping subpath rewrites for this package`,
    );
    return null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const legs: Array<unknown> = [record.types, record.source, ...Object.values(record)];
    for (const leg of legs) {
      if (typeof leg !== "string") continue;
      if (!/\.(ts|tsx)$/.test(leg)) continue;
      const base = resolveLeg(leg);
      if (base && isDirectory(base)) return wrapResult(base);
    }
    // Fall back: try the default leg as a dist string and infer.
    const def = record.default;
    if (typeof def === "string") {
      return extractBaseDir(pkgRoot, pattern, def);
    }
  }

  return null;
};

const getSubpathImports = (pkgRoot: string): SubpathImportsMap | undefined => {
  if (subpathCache.has(pkgRoot)) return subpathCache.get(pkgRoot);

  const pkgJsonPath = path.join(pkgRoot, "package.json");
  let pkg: PackageJson;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  } catch {
    subpathCache.set(pkgRoot, undefined);
    return undefined;
  }

  if (!pkg.imports || typeof pkg.imports !== "object") {
    subpathCache.set(pkgRoot, undefined);
    return undefined;
  }

  const out: SubpathImportsMap = {};
  for (const [pattern, value] of Object.entries(pkg.imports)) {
    if (!pattern.endsWith("/*")) continue;
    const entry = extractBaseDir(pkgRoot, pattern, value);
    if (entry) out[pattern] = entry;
  }
  const result = Object.keys(out).length > 0 ? out : undefined;
  subpathCache.set(pkgRoot, result);
  return result;
};

const subpathImportsForFile = (absFile: string): SubpathImportsMap | undefined => {
  const pkgRoot = findPackageRoot(path.dirname(absFile));
  if (!pkgRoot) return undefined;
  return getSubpathImports(pkgRoot);
};

let changedCount = 0;
let warnCount = 0;

for (const arg of args) {
  const abs = path.resolve(arg);
  const ext = path.extname(abs);
  if (SKIPPED_BASENAMES.has(ext) || abs.endsWith(".d.ts")) {
    console.log(`skip: ${arg}`);
    continue;
  }
  const text = fs.readFileSync(abs, "utf8");
  const subpathImports = subpathImportsForFile(abs);
  const result = rewriteSource(text, {
    filePath: abs,
    fileExists,
    isDirectory,
    subpathImports,
  });
  if (result.changed) {
    fs.writeFileSync(abs, result.source, "utf8");
    changedCount++;
    console.log(`rewrote: ${arg}`);
  }
  for (const w of result.warnings) {
    warnCount++;
    console.warn(`warn[${w.kind}] ${arg}:${w.line} ${w.message}`);
  }
}

console.log(`done. changed=${changedCount} warnings=${warnCount}`);

// ---------------------------------------------------------------------------
// Optional second pass: type-only import analysis via ts.Program
// ---------------------------------------------------------------------------

if (typeOnlyMode) {
  const absFiles = args.map((a) => path.resolve(a));
  const firstSrcFile = absFiles.find(
    (p) => !SKIPPED_BASENAMES.has(path.extname(p)) && !p.endsWith(".d.ts"),
  );
  if (!firstSrcFile) {
    console.log("type-only: no eligible files, skipping");
    process.exit(0);
  }
  const pkgRoot = findPackageRoot(path.dirname(firstSrcFile));
  if (!pkgRoot) {
    console.error(
      `type-only: could not locate a package.json walking up from ${firstSrcFile}`,
    );
    process.exit(1);
  }
  const tsconfigPath = path.join(pkgRoot, "tsconfig.json");
  if (!fileExists(tsconfigPath)) {
    console.error(`type-only: no tsconfig.json at ${pkgRoot}`);
    process.exit(1);
  }

  console.log(`type-only: analysing ${absFiles.length} files against ${tsconfigPath}`);
  const { fixes, warnings } = findTypeOnlyImports({
    tsconfigPath,
    files: absFiles,
  });
  let typeOnlyChanged = 0;
  let typeOnlySpecifiers = 0;
  for (const fix of fixes) {
    typeOnlySpecifiers += fix.specifiers.length;
    const text = fs.readFileSync(fix.filePath, "utf8");
    const out = applyTypeOnlyFixes(text, fix);
    if (out !== text) {
      fs.writeFileSync(fix.filePath, out, "utf8");
      typeOnlyChanged++;
      console.log(
        `type-only: rewrote ${path.relative(process.cwd(), fix.filePath)} (${fix.specifiers.length} spec${fix.specifiers.length === 1 ? "" : "s"})`,
      );
    }
  }
  for (const w of warnings) {
    console.warn(`type-only-warn: ${w}`);
  }
  console.log(
    `type-only: done. files=${typeOnlyChanged} specifiers=${typeOnlySpecifiers} warnings=${warnings.length}`,
  );
}
