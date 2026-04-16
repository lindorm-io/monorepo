#!/usr/bin/env tsx
/**
 * Inject `import { jest } from "@jest/globals"` into ESM test files.
 *
 * Under ts-jest `default-esm` preset, `jest` is NOT a global — every test file
 * that uses `jest.fn()`, `jest.spyOn()`, `jest.mock()`, etc. needs the import.
 * Other globals (`describe`, `test`, `it`, `expect`, `beforeAll`, `afterAll`,
 * `beforeEach`, `afterEach`) are injected by Jest's test environment and do NOT
 * need importing.
 *
 * Usage:
 *   npx tsx scripts/codemods/inject-jest-globals.ts packages/<pkg>/src/**\/*.test.ts
 *
 * The script is idempotent — files that already import `jest` are skipped.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import ts from "typescript";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error(
    "usage: npx tsx scripts/codemods/inject-jest-globals.ts <file.test.ts> [...more]",
  );
  process.exit(2);
}

const JEST_IMPORT = `import { jest } from "@jest/globals";`;

/**
 * Check whether a source file references `jest` as an identifier in a
 * property-access position (e.g. `jest.fn()`, `jest.mock()`).
 */
const usesJestGlobal = (sourceFile: ts.SourceFile): boolean => {
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) return;

    // Match `jest.xxx` property access
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "jest"
    ) {
      found = true;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
};

/**
 * Check whether the file already has `import { jest } from "@jest/globals"`
 * or `import { jest, ... } from "@jest/globals"`.
 */
const hasJestImport = (sourceFile: ts.SourceFile): boolean => {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const moduleText = (statement.moduleSpecifier as ts.StringLiteral).text;
    if (moduleText !== "@jest/globals") continue;
    const clause = statement.importClause;
    if (!clause || !clause.namedBindings) continue;
    if (!ts.isNamedImports(clause.namedBindings)) continue;
    for (const element of clause.namedBindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      if (imported === "jest") return true;
    }
  }
  return false;
};

/**
 * Find the insertion offset — after the last import declaration, or at
 * position 0 if no imports exist.
 */
const findInsertionOffset = (
  sourceFile: ts.SourceFile,
): { offset: number; prefix: string } => {
  let lastImportEnd = -1;
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      lastImportEnd = statement.getEnd();
    }
  }

  if (lastImportEnd >= 0) {
    return { offset: lastImportEnd, prefix: "\n" };
  }

  // No imports — insert at top of file. If there's a leading comment or
  // shebang, insert after it by placing at position 0.
  return { offset: 0, prefix: "" };
};

let modifiedCount = 0;
let skippedCount = 0;

for (const arg of args) {
  const abs = path.resolve(arg);

  // Only process test files
  if (!abs.endsWith(".test.ts") && !abs.endsWith(".spec.ts")) {
    skippedCount++;
    continue;
  }

  const text = fs.readFileSync(abs, "utf8");

  const sourceFile = ts.createSourceFile(
    abs,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  // Skip if jest is already imported
  if (hasJestImport(sourceFile)) {
    skippedCount++;
    continue;
  }

  // Skip if jest.* is never used
  if (!usesJestGlobal(sourceFile)) {
    skippedCount++;
    continue;
  }

  // Insert the import
  const { offset, prefix } = findInsertionOffset(sourceFile);
  const insertion = `${prefix}${JEST_IMPORT}`;
  const out = text.slice(0, offset) + insertion + text.slice(offset);

  fs.writeFileSync(abs, out, "utf8");
  modifiedCount++;
  console.log(`injected: ${arg}`);
}

console.log(`done. modified=${modifiedCount} skipped=${skippedCount}`);
