#!/usr/bin/env tsx
/**
 * cjs-named-imports — ESM migration audit script.
 *
 * AST-based walk over `packages/{name}/src/**\/*.{ts,tsx}` (including test
 * files) that reports every named import from a third-party CJS package.
 *
 * Under strict ESM, Node's resolver cannot statically see named exports from
 * CJS modules — only the default import works. Every `import { X } from "cjs"`
 * site is a hazard that must be rewritten by hand to:
 *
 *     import pkg from "cjs";
 *     // ... rest of imports ...
 *
 *     const { X } = pkg;
 *
 * The output markdown lives at
 * `.plan/spike-results/audit-cjs-named-imports.md` (local, gitignored) and is
 * intended as a checklist the user works through file-by-file.
 *
 *   npx tsx scripts/audit/cjs-named-imports.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

import ts from "typescript";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RuntimeSpecifier = {
  importedName: string;
  localName: string;
};

type CjsNamedImportSite = {
  file: string; // repo-relative
  line: number;
  packageName: string;
  runtimeSpecifiers: RuntimeSpecifier[];
  hasDefaultBinding: boolean;
};

type PackageJson = {
  type?: string;
  exports?: unknown;
};

type Classification = { kind: "skip" } | { kind: "cjs" };

// ---------------------------------------------------------------------------
// File enumeration
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PACKAGES_DIR = path.join(REPO_ROOT, "packages");

const EXCLUDE_DIRS = new Set(["__snapshots__", "node_modules", "dist"]);

const walk = (dir: string, out: string[]): void => {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
    if (name.endsWith(".d.ts")) continue;
    out.push(full);
  }
};

const collectSourceFiles = (): string[] => {
  const results: string[] = [];
  let pkgDirs: fs.Dirent[];
  try {
    pkgDirs = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const pkg of pkgDirs) {
    if (!pkg.isDirectory()) continue;
    const srcDir = path.join(PACKAGES_DIR, pkg.name, "src");
    if (!fs.existsSync(srcDir)) continue;
    walk(srcDir, results);
  }
  return results;
};

// ---------------------------------------------------------------------------
// Package specifier → package name + package.json resolution
// ---------------------------------------------------------------------------

const parsePackageName = (specifier: string): string | null => {
  if (specifier.length === 0) return null;
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  }
  const slash = specifier.indexOf("/");
  return slash === -1 ? specifier : specifier.slice(0, slash);
};

// Cache: package.json path → parsed content (or null if not found / unreadable)
const pkgJsonCache = new Map<string, PackageJson | null>();

// Cache: (fromDir + "\0" + packageName) → resolved package.json path or null
const resolveCache = new Map<string, string | null>();

const readPackageJson = (jsonPath: string): PackageJson | null => {
  const cached = pkgJsonCache.get(jsonPath);
  if (cached !== undefined) return cached;
  try {
    const text = fs.readFileSync(jsonPath, "utf8");
    const parsed = JSON.parse(text) as PackageJson;
    pkgJsonCache.set(jsonPath, parsed);
    return parsed;
  } catch {
    pkgJsonCache.set(jsonPath, null);
    return null;
  }
};

const resolvePackageJsonPath = (fromFile: string, packageName: string): string | null => {
  let dir = path.dirname(fromFile);
  while (true) {
    const key = `${dir}\u0000${packageName}`;
    const cached = resolveCache.get(key);
    if (cached !== undefined) return cached;

    const candidate = path.join(dir, "node_modules", packageName, "package.json");
    if (fs.existsSync(candidate)) {
      resolveCache.set(key, candidate);
      return candidate;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      // Walked off the top without finding anything.
      resolveCache.set(key, null);
      return null;
    }
    resolveCache.set(key, null); // stamp this level — will re-check parent on next hop
    dir = parent;
  }
};

// ---------------------------------------------------------------------------
// CJS classification
// ---------------------------------------------------------------------------

const hasDualExports = (exportsField: unknown): boolean => {
  if (exportsField === null || typeof exportsField !== "object") return false;
  // Shallow walk — if any conditional object anywhere in the exports map has
  // both "import" and "require" keys, treat the package as dual-emit.
  const stack: unknown[] = [exportsField];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === null || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    const obj = current as Record<string, unknown>;
    if ("import" in obj && "require" in obj) return true;
    for (const value of Object.values(obj)) stack.push(value);
  }
  return false;
};

const classifyPackage = (fromFile: string, packageName: string): Classification => {
  const jsonPath = resolvePackageJsonPath(fromFile, packageName);
  if (!jsonPath) return { kind: "skip" }; // unresolved — can't prove it's CJS, skip conservatively
  const pkg = readPackageJson(jsonPath);
  if (!pkg) return { kind: "skip" };
  if (pkg.type === "module") return { kind: "skip" };
  if (hasDualExports(pkg.exports)) return { kind: "skip" };
  return { kind: "cjs" };
};

const shouldSkipSpecifier = (specifier: string): boolean => {
  if (specifier.startsWith("./") || specifier.startsWith("../")) return true;
  if (specifier.startsWith("#")) return true;
  if (specifier.startsWith("node:")) return true;
  if (specifier.startsWith("@lindorm/")) return true;
  if (specifier.startsWith("@types/")) return true;
  return false;
};

// ---------------------------------------------------------------------------
// AST inspection
// ---------------------------------------------------------------------------

const inspectFile = (abs: string, sites: CjsNamedImportSite[]): void => {
  let text: string;
  try {
    text = fs.readFileSync(abs, "utf8");
  } catch {
    return;
  }

  const sourceFile = ts.createSourceFile(
    abs,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    abs.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const relFile = path.relative(REPO_ROOT, abs);

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;

    const specifier = statement.moduleSpecifier.text;
    if (shouldSkipSpecifier(specifier)) continue;

    const clause = statement.importClause;
    if (!clause) continue; // side-effect import, no runtime named bindings
    if (clause.isTypeOnly) continue; // whole-statement `import type { ... }`

    const namedBindings = clause.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) continue; // default-only or namespace

    const runtimeSpecifiers: RuntimeSpecifier[] = [];
    for (const element of namedBindings.elements) {
      if (element.isTypeOnly) continue; // inline `type X` — compile-time only
      runtimeSpecifiers.push({
        importedName: (element.propertyName ?? element.name).text,
        localName: element.name.text,
      });
    }
    if (runtimeSpecifiers.length === 0) continue;

    const packageName = parsePackageName(specifier);
    if (!packageName) continue;

    const classification = classifyPackage(abs, packageName);
    if (classification.kind === "skip") continue;

    const { line } = sourceFile.getLineAndCharacterOfPosition(
      statement.getStart(sourceFile),
    );
    sites.push({
      file: relFile,
      line: line + 1,
      packageName,
      runtimeSpecifiers,
      hasDefaultBinding: clause.name !== undefined,
    });
  }
};

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

const renderImportSnippet = (site: CjsNamedImportSite): string => {
  const named = site.runtimeSpecifiers
    .map((s) =>
      s.importedName === s.localName
        ? s.importedName
        : `${s.importedName} as ${s.localName}`,
    )
    .join(", ");
  const clause = site.hasDefaultBinding ? `pkg, { ${named} }` : `{ ${named} }`;
  return `import ${clause} from "${site.packageName}"`;
};

const renderRuntimeList = (site: CjsNamedImportSite): string =>
  site.runtimeSpecifiers.map((s) => `\`${s.importedName}\``).join(", ");

const renderReport = (sites: CjsNamedImportSite[]): string => {
  const lines: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const uniquePackages = new Set(sites.map((s) => s.packageName));

  lines.push("# CJS Named-Import Audit");
  lines.push("");
  lines.push("**Scope:** packages/*/src/**/*.{ts,tsx} including test files");
  lines.push(`**Date:** ${today}`);
  lines.push(`**Total sites:** ${sites.length}`);
  lines.push(`**Unique packages affected:** ${uniquePackages.size}`);
  lines.push("");
  lines.push(
    "Regenerate with `npx tsx scripts/audit/cjs-named-imports.ts`. Each site is a strict-ESM " +
      "hazard: Node's ESM resolver cannot statically see named exports from CJS modules. Rewrite " +
      "by default-importing the package and destructuring below the import block.",
  );
  lines.push("");

  // --- Hit counts by package ---
  const pkgCounts = new Map<string, number>();
  for (const site of sites) {
    pkgCounts.set(site.packageName, (pkgCounts.get(site.packageName) ?? 0) + 1);
  }
  const sortedPackages = Array.from(pkgCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  lines.push("## Hit counts by package (sorted descending)");
  lines.push("");
  lines.push("| Package | Sites |");
  lines.push("| --- | ---: |");
  for (const [pkg, count] of sortedPackages) {
    lines.push(`| ${pkg} | ${count} |`);
  }
  lines.push("");

  // --- Per-file breakdown, grouped by package, files sorted ---
  lines.push("## Per-file breakdown");
  lines.push("");

  const byPackage = new Map<string, CjsNamedImportSite[]>();
  for (const site of sites) {
    const arr = byPackage.get(site.packageName) ?? [];
    arr.push(site);
    byPackage.set(site.packageName, arr);
  }

  for (const [pkg] of sortedPackages) {
    const pkgSites = byPackage.get(pkg)!;
    lines.push(`### ${pkg} (${pkgSites.length})`);
    lines.push("");

    const byFile = new Map<string, CjsNamedImportSite[]>();
    for (const site of pkgSites) {
      const arr = byFile.get(site.file) ?? [];
      arr.push(site);
      byFile.set(site.file, arr);
    }
    const sortedFiles = Array.from(byFile.keys()).sort();

    for (const file of sortedFiles) {
      lines.push(`#### ${file}`);
      const fileSites = byFile
        .get(file)!
        .slice()
        .sort((a, b) => a.line - b.line);
      for (const site of fileSites) {
        const snippet = renderImportSnippet(site);
        const runtime = renderRuntimeList(site);
        const defaultNote = site.hasDefaultBinding ? " (with default binding)" : "";
        lines.push(
          `- Line ${site.line}: \`${snippet}\` — runtime: ${runtime}${defaultNote}`,
        );
      }
      lines.push("");
    }
  }

  return lines.join("\n");
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = (): void => {
  const files = collectSourceFiles();
  const sites: CjsNamedImportSite[] = [];
  for (const abs of files) {
    inspectFile(abs, sites);
  }

  const reportPath = path.join(
    REPO_ROOT,
    ".plan",
    "spike-results",
    "audit-cjs-named-imports.md",
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, renderReport(sites), "utf8");

  const uniquePackages = new Set(sites.map((s) => s.packageName));
  console.log(
    `Scanned ${files.length} files. Found ${sites.length} CJS named-import sites ` +
      `across ${uniquePackages.size} packages.`,
  );
  console.log(`Wrote ${path.relative(REPO_ROOT, reportPath)}`);
};

main();
