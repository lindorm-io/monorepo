#!/usr/bin/env tsx
/**
 * cycle-check — Spike 10 cycle detector.
 *
 * Walks every .ts file under packages/{name}/src (excluding tests, fixtures,
 * spikes and .d.ts), parses each file with the TypeScript AST, collects
 * relative-path imports / exports, resolves them to concrete files, and
 * detects circular dependency chains using Tarjan-style SCC.
 *
 * Edges are tagged as "type" (any import-type / export-type / type-only
 * specifier list) or "runtime". A cycle is classified:
 *   - type-only    — every edge in the cycle is "type"
 *   - runtime      — at least one runtime edge
 *
 * Scope: intra-package cycles only (cross-package imports are ignored —
 * those are resolved via npm and can't create ESM TDZ traps the same way).
 *
 *   npx tsx scripts/audit/cycle-check.ts                # all packages
 *   npx tsx scripts/audit/cycle-check.ts hermes         # single package
 *   npx tsx scripts/audit/cycle-check.ts --json         # machine-readable
 */

import * as fs from "node:fs";
import * as path from "node:path";

import ts from "typescript";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Edge = {
  from: string; // absolute file path
  to: string; // absolute file path
  typeOnly: boolean;
};

type Cycle = {
  files: string[]; // absolute paths, loop order
  runtime: boolean; // true if any edge in cycle is runtime
};

type PackageReport = {
  pkg: string;
  fileCount: number;
  edgeCount: number;
  cycles: Cycle[];
  runtimeCycleCount: number;
  typeOnlyCycleCount: number;
};

// ---------------------------------------------------------------------------
// File enumeration
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PACKAGES_DIR = path.join(REPO_ROOT, "packages");

const EXCLUDE_DIRS = new Set([
  "__tests__",
  "__fixtures__",
  "__mocks__",
  "__snapshots__",
  "__spike__",
  "node_modules",
  "dist",
]);

const listPackages = (): string[] =>
  fs
    .readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(PACKAGES_DIR, name, "src")));

const walkSrc = (srcDir: string): string[] => {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.has(entry.name)) continue;
        visit(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const name = entry.name;
      if (!name.endsWith(".ts")) continue;
      if (name.endsWith(".d.ts")) continue;
      if (name.endsWith(".test.ts")) continue;
      if (name.endsWith(".spec.ts")) continue;
      out.push(path.join(dir, name));
    }
  };
  visit(srcDir);
  return out;
};

// ---------------------------------------------------------------------------
// Import extraction
// ---------------------------------------------------------------------------

const parseFile = (file: string): ts.SourceFile =>
  ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);

type RawImport = { specifier: string; typeOnly: boolean };

const extractImports = (sf: ts.SourceFile): RawImport[] => {
  const out: RawImport[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const spec = (node.moduleSpecifier as ts.StringLiteral).text;
      const clause = node.importClause;
      let typeOnly = false;
      if (clause) {
        if (clause.isTypeOnly) {
          typeOnly = true;
        } else if (
          clause.namedBindings &&
          ts.isNamedImports(clause.namedBindings) &&
          clause.namedBindings.elements.length > 0 &&
          clause.namedBindings.elements.every((e) => e.isTypeOnly)
        ) {
          typeOnly = true;
        }
      } else {
        // side-effect import: `import "foo"` — always runtime
        typeOnly = false;
      }
      out.push({ specifier: spec, typeOnly });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const spec = (node.moduleSpecifier as ts.StringLiteral).text;
      let typeOnly = node.isTypeOnly;
      if (
        !typeOnly &&
        node.exportClause &&
        ts.isNamedExports(node.exportClause) &&
        node.exportClause.elements.length > 0 &&
        node.exportClause.elements.every((e) => e.isTypeOnly)
      ) {
        typeOnly = true;
      }
      out.push({ specifier: spec, typeOnly });
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  return out;
};

// ---------------------------------------------------------------------------
// Specifier → file resolution (intra-package, relative only)
// ---------------------------------------------------------------------------

const CANDIDATE_SUFFIXES = [".ts", ".tsx", "/index.ts", "/index.tsx"];

const resolveRelative = (fromFile: string, spec: string): string | null => {
  if (!spec.startsWith(".")) return null; // cross-package or node builtin — ignored
  const base = path.resolve(path.dirname(fromFile), spec);
  // Try base itself (with rewrite of .js extension to .ts if present)
  const candidates: string[] = [];
  if (/\.(jsx?|mjs|cjs)$/.test(base)) {
    candidates.push(base.replace(/\.(jsx?|mjs|cjs)$/, ".ts"));
    candidates.push(base.replace(/\.(jsx?|mjs|cjs)$/, ".tsx"));
  }
  if (/\.tsx?$/.test(base)) candidates.push(base);
  for (const suffix of CANDIDATE_SUFFIXES) candidates.push(base + suffix);
  for (const c of candidates) {
    try {
      const stat = fs.statSync(c);
      if (stat.isFile()) return c;
    } catch {
      /* not found */
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Tarjan's SCC
// ---------------------------------------------------------------------------

const tarjan = (nodes: string[], adj: Map<string, string[]>): string[][] => {
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indexOf = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const sccs: string[][] = [];

  const strongconnect = (v: string) => {
    indexOf.set(v, index);
    lowlink.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!indexOf.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indexOf.get(w)!));
      }
    }
    if (lowlink.get(v) === indexOf.get(v)) {
      const comp: string[] = [];
      for (;;) {
        const w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
        if (w === v) break;
      }
      sccs.push(comp);
    }
  };

  for (const n of nodes) if (!indexOf.has(n)) strongconnect(n);
  return sccs;
};

// ---------------------------------------------------------------------------
// Per-package analysis
// ---------------------------------------------------------------------------

const analyzePackage = (pkg: string): PackageReport => {
  const srcDir = path.join(PACKAGES_DIR, pkg, "src");
  const files = walkSrc(srcDir);
  const fileSet = new Set(files);

  // edgeKey → typeOnly (if any parallel edge is runtime, runtime wins)
  const edgeType = new Map<string, boolean>();

  for (const file of files) {
    let sf: ts.SourceFile;
    try {
      sf = parseFile(file);
    } catch {
      continue;
    }
    const imports = extractImports(sf);
    for (const imp of imports) {
      const resolved = resolveRelative(file, imp.specifier);
      if (!resolved) continue;
      if (!fileSet.has(resolved)) continue;
      if (resolved === file) continue;
      const key = `${file}\u0000${resolved}`;
      const prev = edgeType.get(key);
      if (prev === undefined) {
        edgeType.set(key, imp.typeOnly);
      } else if (prev && !imp.typeOnly) {
        edgeType.set(key, false);
      }
    }
  }

  const edges: Edge[] = [];
  const adjAll = new Map<string, string[]>();
  const adjRuntime = new Map<string, string[]>();
  for (const f of files) {
    adjAll.set(f, []);
    adjRuntime.set(f, []);
  }
  for (const [key, typeOnly] of edgeType) {
    const [from, to] = key.split("\u0000");
    edges.push({ from, to, typeOnly });
    adjAll.get(from)!.push(to);
    if (!typeOnly) adjRuntime.get(from)!.push(to);
  }

  // Two SCC passes: full graph (syntactic) and runtime-only graph.
  const sccsAll = tarjan(files, adjAll).filter((s) => s.length >= 2);
  const sccsRuntime = tarjan(files, adjRuntime).filter((s) => s.length >= 2);

  // A file is "runtime-cyclic" if it appears in any runtime SCC.
  const runtimeCyclicFiles = new Set(sccsRuntime.flat());

  const cycles: Cycle[] = sccsAll.map((scc) => ({
    files: scc,
    runtime: scc.every((f) => runtimeCyclicFiles.has(f)) && scc.length >= 2,
  }));

  const runtimeCycleCount = sccsRuntime.length;
  const typeOnlyCycleCount = Math.max(0, sccsAll.length - runtimeCycleCount);

  return {
    pkg,
    fileCount: files.length,
    edgeCount: edges.length,
    cycles,
    runtimeCycleCount,
    typeOnlyCycleCount,
  };
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const rel = (abs: string): string => path.relative(REPO_ROOT, abs);

const printReport = (
  reports: PackageReport[],
  opts: { json: boolean; verbose: boolean },
) => {
  if (opts.json) {
    process.stdout.write(
      JSON.stringify(
        reports.map((r) => ({
          pkg: r.pkg,
          fileCount: r.fileCount,
          edgeCount: r.edgeCount,
          runtimeCycles: r.runtimeCycleCount,
          typeOnlyCycles: r.typeOnlyCycleCount,
          cycles: r.cycles.map((c) => ({
            runtime: c.runtime,
            files: c.files.map(rel),
          })),
        })),
        null,
        2,
      ) + "\n",
    );
    return;
  }

  const rows = [
    ["package", "files", "edges", "runtime", "type-only"],
    ...reports.map((r) => [
      r.pkg,
      String(r.fileCount),
      String(r.edgeCount),
      String(r.runtimeCycleCount),
      String(r.typeOnlyCycleCount),
    ]),
  ];
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  for (const r of rows) {
    process.stdout.write(r.map((c, i) => c.padEnd(widths[i])).join("  ") + "\n");
  }

  if (opts.verbose) {
    for (const r of reports) {
      if (r.cycles.length === 0) continue;
      process.stdout.write(`\n=== ${r.pkg} ===\n`);
      for (const c of r.cycles) {
        process.stdout.write(
          `  [${c.runtime ? "RUNTIME" : "type-only"}] ${c.files.length} files\n`,
        );
        for (const f of c.files) process.stdout.write(`    ${rel(f)}\n`);
      }
    }
  }
};

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

const main = () => {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const verbose = args.includes("--verbose") || args.includes("-v");
  const pkgFilter = args.filter((a) => !a.startsWith("-"));
  const allPkgs = listPackages();
  const pkgs =
    pkgFilter.length > 0 ? allPkgs.filter((p) => pkgFilter.includes(p)) : allPkgs;

  const reports: PackageReport[] = [];
  for (const pkg of pkgs) {
    reports.push(analyzePackage(pkg));
  }

  printReport(reports, { json, verbose });
};

main();
