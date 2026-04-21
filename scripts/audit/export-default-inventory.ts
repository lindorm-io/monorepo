#!/usr/bin/env tsx
/**
 * export-default-inventory — Phase 0a audit script.
 *
 * AST-based walk over `packages/{name}/src/**\/*.ts` that records every
 * `export default` site. The output is a markdown file at
 * `.plan/spike-results/export-default-inventory.md`.
 *
 * Recorded kinds:
 *   - function   — `export default function …`
 *   - class      — `export default class …`
 *   - expression — `export default <any other expression>` (object literal,
 *                  identifier, call expression, arrow, etc.)
 *   - aliased    — `export { X as default }` (with or without `from "…"`)
 *
 * Excluded: `*.test.ts`, `*.spec.ts`, `__tests__/**`, `__spike__/**`, `*.d.ts`.
 *
 *   npx tsx scripts/audit/export-default-inventory.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

import ts from "typescript";

import { parseTypeScript } from "../codemods/esm-rewrite";

type DefaultKind = "function" | "class" | "expression" | "aliased";

type Hit = {
  pkg: string;
  file: string; // repo-relative
  line: number;
  kind: DefaultKind;
  detail: string;
};

// ---------------------------------------------------------------------------
// File enumeration
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, "..", "..");

const EXCLUDE_SEGMENTS = new Set(["__tests__", "__spike__", "node_modules", "dist"]);

const walk = (dir: string, out: string[]): void => {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (EXCLUDE_SEGMENTS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
    if (entry.name.endsWith(".d.ts")) continue;
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) continue;
    if (entry.name.endsWith(".spec.ts") || entry.name.endsWith(".spec.tsx")) continue;
    out.push(full);
  }
};

const collectSourceFiles = (): { pkg: string; abs: string }[] => {
  const packagesDir = path.join(REPO_ROOT, "packages");
  const packageNames = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const results: { pkg: string; abs: string }[] = [];
  for (const pkg of packageNames) {
    const srcDir = path.join(packagesDir, pkg, "src");
    if (!fs.existsSync(srcDir)) continue;
    const files: string[] = [];
    walk(srcDir, files);
    for (const abs of files) {
      results.push({ pkg, abs });
    }
  }
  return results;
};

// ---------------------------------------------------------------------------
// AST inspection
// ---------------------------------------------------------------------------

const lineOf = (sourceFile: ts.SourceFile, node: ts.Node): number =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

const firstLineOf = (text: string): string => {
  const trimmed = text.split("\n")[0]?.trim() ?? "";
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
};

const inspectFile = (pkg: string, abs: string, hits: Hit[]): void => {
  const text = fs.readFileSync(abs, "utf8");
  const sourceFile = parseTypeScript(abs, text);
  const relFile = path.relative(REPO_ROOT, abs);

  for (const statement of sourceFile.statements) {
    // `export default function …` / `export default class …`
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      const modifiers = ts.canHaveModifiers(statement)
        ? ts.getModifiers(statement)
        : undefined;
      if (!modifiers) continue;
      const hasExport = modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const hasDefault = modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
      if (!hasExport || !hasDefault) continue;
      const kind: DefaultKind = ts.isFunctionDeclaration(statement)
        ? "function"
        : "class";
      const name = statement.name?.text ?? "<anonymous>";
      hits.push({
        pkg,
        file: relFile,
        line: lineOf(sourceFile, statement),
        kind,
        detail: `${kind} ${name}`,
      });
      continue;
    }

    // `export default <expression>;`
    if (ts.isExportAssignment(statement)) {
      if (statement.isExportEquals) continue; // `export = …` — CJS only, not a default
      const expr = statement.expression;
      let kind: DefaultKind = "expression";
      if (ts.isFunctionExpression(expr)) kind = "function";
      else if (ts.isClassExpression(expr)) kind = "class";
      hits.push({
        pkg,
        file: relFile,
        line: lineOf(sourceFile, statement),
        kind,
        detail: firstLineOf(statement.getText()),
      });
      continue;
    }

    // `export { X as default }` (with or without `from "…"`)
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        if (element.name.text !== "default") continue;
        hits.push({
          pkg,
          file: relFile,
          line: lineOf(sourceFile, element),
          kind: "aliased",
          detail: firstLineOf(statement.getText()),
        });
      }
    }
  }
};

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

const renderReport = (hits: Hit[]): string => {
  const lines: string[] = [];
  lines.push("# `export default` inventory");
  lines.push("");
  lines.push(
    "AST-based inventory of every `export default` site in `packages/*/src` (test/spec/spike files excluded).",
  );
  lines.push("");
  lines.push("Regenerate with:");
  lines.push("");
  lines.push("```");
  lines.push("npx tsx scripts/audit/export-default-inventory.ts");
  lines.push("```");
  lines.push("");
  lines.push(`Total sites: **${hits.length}**`);
  lines.push("");

  const byKind = new Map<DefaultKind, number>();
  for (const hit of hits) byKind.set(hit.kind, (byKind.get(hit.kind) ?? 0) + 1);
  lines.push("## Counts by kind");
  lines.push("");
  lines.push("| kind | count |");
  lines.push("| --- | ---: |");
  for (const kind of ["function", "class", "expression", "aliased"] as DefaultKind[]) {
    lines.push(`| ${kind} | ${byKind.get(kind) ?? 0} |`);
  }
  lines.push("");

  const byPkg = new Map<string, Hit[]>();
  for (const hit of hits) {
    const arr = byPkg.get(hit.pkg) ?? [];
    arr.push(hit);
    byPkg.set(hit.pkg, arr);
  }
  const pkgNames = Array.from(byPkg.keys()).sort();

  lines.push("## Counts by package");
  lines.push("");
  lines.push("| package | count |");
  lines.push("| --- | ---: |");
  for (const pkg of pkgNames) {
    lines.push(`| ${pkg} | ${byPkg.get(pkg)!.length} |`);
  }
  lines.push("");

  lines.push("## Sites");
  lines.push("");
  for (const pkg of pkgNames) {
    const pkgHits = byPkg
      .get(pkg)!
      .slice()
      .sort((a, b) => {
        if (a.file !== b.file) return a.file.localeCompare(b.file);
        return a.line - b.line;
      });
    lines.push(`### ${pkg} (${pkgHits.length})`);
    lines.push("");
    lines.push("| file:line | kind | detail |");
    lines.push("| --- | --- | --- |");
    for (const hit of pkgHits) {
      const detail = hit.detail.replace(/\|/g, "\\|");
      lines.push(`| \`${hit.file}:${hit.line}\` | ${hit.kind} | \`${detail}\` |`);
    }
    lines.push("");
  }

  return lines.join("\n");
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = (): void => {
  const files = collectSourceFiles();
  const hits: Hit[] = [];
  for (const { pkg, abs } of files) {
    inspectFile(pkg, abs, hits);
  }

  const reportPath = path.join(
    REPO_ROOT,
    ".plan",
    "spike-results",
    "export-default-inventory.md",
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, renderReport(hits), "utf8");

  console.log(
    `Scanned ${files.length} files across ${new Set(files.map((f) => f.pkg)).size} packages.`,
  );
  console.log(`Found ${hits.length} export-default sites.`);
  console.log(`Wrote ${path.relative(REPO_ROOT, reportPath)}`);
};

main();
