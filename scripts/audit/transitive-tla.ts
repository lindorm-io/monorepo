#!/usr/bin/env tsx
/**
 * transitive-tla — ESM migration audit script.
 *
 * AST-based walk over `node_modules/**\/dist/**\/*.{js,mjs}` that reports any
 * top-level `await` at module scope. Uses the TypeScript compiler API to parse
 * each file as JavaScript and detect `AwaitExpression` nodes whose parent chain
 * does NOT include a function/method — i.e. `await` that would only be legal
 * under the top-level-await proposal.
 *
 * A non-zero hit count flags a per-dependency risk for the ESM migration:
 * any such package requires its consumers to support TLA, which cascades
 * constraints onto our own build targets.
 *
 *   npx tsx scripts/audit/transitive-tla.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

import ts from "typescript";

type Hit = {
  pkg: string;
  file: string; // repo-relative
  line: number;
  snippet: string;
};

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const NODE_MODULES = path.join(REPO_ROOT, "node_modules");

// ---------------------------------------------------------------------------
// File enumeration
// ---------------------------------------------------------------------------

const isJsFile = (name: string): boolean => name.endsWith(".js") || name.endsWith(".mjs");

const walkDist = (dir: string, out: string[]): void => {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walkDist(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!isJsFile(entry.name)) continue;
    out.push(full);
  }
};

const collectPackageDists = (): { pkg: string; distDir: string }[] => {
  const results: { pkg: string; distDir: string }[] = [];
  let topEntries: fs.Dirent[];
  try {
    topEntries = fs.readdirSync(NODE_MODULES, { withFileTypes: true });
  } catch {
    return results;
  }

  const considerPkg = (pkg: string, pkgRoot: string): void => {
    const distDir = path.join(pkgRoot, "dist");
    if (!fs.existsSync(distDir)) return;
    try {
      if (!fs.statSync(distDir).isDirectory()) return;
    } catch {
      return;
    }
    results.push({ pkg, distDir });
  };

  for (const entry of topEntries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === ".bin" || entry.name === ".cache") continue;
    if (entry.name.startsWith("@")) {
      const scopeDir = path.join(NODE_MODULES, entry.name);
      let scoped: fs.Dirent[];
      try {
        scoped = fs.readdirSync(scopeDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const sub of scoped) {
        if (!sub.isDirectory()) continue;
        considerPkg(`${entry.name}/${sub.name}`, path.join(scopeDir, sub.name));
      }
      continue;
    }
    considerPkg(entry.name, path.join(NODE_MODULES, entry.name));
  }
  return results;
};

// ---------------------------------------------------------------------------
// AST inspection
// ---------------------------------------------------------------------------

const FUNCTION_LIKE_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
  ts.SyntaxKind.Constructor,
]);

const isAtModuleScope = (node: ts.Node): boolean => {
  let parent = node.parent;
  while (parent) {
    if (FUNCTION_LIKE_KINDS.has(parent.kind)) return false;
    parent = parent.parent;
  }
  return true;
};

const inspectFile = (pkg: string, abs: string, hits: Hit[]): void => {
  let text: string;
  try {
    text = fs.readFileSync(abs, "utf8");
  } catch {
    return;
  }
  if (!text.includes("await")) return; // cheap pre-filter

  const sourceFile = ts.createSourceFile(
    abs,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.JS,
  );

  const relFile = path.relative(REPO_ROOT, abs);

  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.AwaitExpression && isAtModuleScope(node)) {
      const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const lineText = text.split("\n")[pos.line] ?? "";
      const snippet =
        lineText.trim().length > 160
          ? `${lineText.trim().slice(0, 157)}...`
          : lineText.trim();
      hits.push({ pkg, file: relFile, line: pos.line + 1, snippet });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
};

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const renderReport = (hits: Hit[], scannedFiles: number, scannedPkgs: number): string => {
  const lines: string[] = [];
  lines.push("# Transitive top-level await audit");
  lines.push("");
  lines.push(
    "AST-based scan of `node_modules/**/dist/**/*.{js,mjs}` for top-level `await` at module scope.",
  );
  lines.push("");
  lines.push(`- Packages scanned: **${scannedPkgs}**`);
  lines.push(`- Files scanned:    **${scannedFiles}**`);
  lines.push(`- Hits:             **${hits.length}**`);
  lines.push("");

  if (hits.length === 0) {
    lines.push("## Result");
    lines.push("");
    lines.push("Zero top-level await hits. ESM migration is safe from this angle.");
    lines.push("");
    return lines.join("\n");
  }

  const byPkg = new Map<string, Hit[]>();
  for (const hit of hits) {
    const arr = byPkg.get(hit.pkg) ?? [];
    arr.push(hit);
    byPkg.set(hit.pkg, arr);
  }
  const pkgNames = Array.from(byPkg.keys()).sort();

  lines.push("## Hits by package");
  lines.push("");
  for (const pkg of pkgNames) {
    const pkgHits = byPkg.get(pkg)!;
    lines.push(`### ${pkg} (${pkgHits.length})`);
    lines.push("");
    lines.push("| file:line | snippet |");
    lines.push("| --- | --- |");
    for (const hit of pkgHits.sort((a, b) =>
      a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file),
    )) {
      const snippet = hit.snippet.replace(/\|/g, "\\|");
      lines.push(`| \`${hit.file}:${hit.line}\` | \`${snippet}\` |`);
    }
    lines.push("");
  }
  return lines.join("\n");
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = (): void => {
  const pkgs = collectPackageDists();
  const hits: Hit[] = [];
  let scannedFiles = 0;

  for (const { pkg, distDir } of pkgs) {
    const files: string[] = [];
    walkDist(distDir, files);
    scannedFiles += files.length;
    for (const abs of files) {
      inspectFile(pkg, abs, hits);
    }
  }

  const report = renderReport(hits, scannedFiles, pkgs.length);
  process.stdout.write(report);

  console.error(
    `Scanned ${scannedFiles} files across ${pkgs.length} packages. Found ${hits.length} TLA hits.`,
  );
};

main();
