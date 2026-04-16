/**
 * Tests for the jest-globals injection logic.
 *
 * Since the main script is a CLI that reads/writes files, we extract and test
 * the core logic inline here using the same TypeScript AST utilities.
 */

import ts from "typescript";

// ---------------------------------------------------------------------------
// Extracted helpers (mirroring the script's logic for unit testing)
// ---------------------------------------------------------------------------

const JEST_IMPORT = `import { jest } from "@jest/globals";`;

const usesJestGlobal = (sourceFile: ts.SourceFile): boolean => {
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) return;
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

const findInsertionOffset = (
  sourceFile: ts.SourceFile,
): { offset: number; prefix: string } => {
  let lastImportEnd = -1;
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      lastImportEnd = statement.getEnd();
    }
  }
  if (lastImportEnd >= 0) return { offset: lastImportEnd, prefix: "\n" };
  return { offset: 0, prefix: "" };
};

const parse = (source: string): ts.SourceFile =>
  ts.createSourceFile(
    "/test/file.test.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

/**
 * Simulate the injection pipeline: detect usage, check for existing import,
 * and inject if needed.
 */
const injectIfNeeded = (source: string): { result: string; injected: boolean } => {
  const sf = parse(source);
  if (hasJestImport(sf) || !usesJestGlobal(sf)) {
    return { result: source, injected: false };
  }
  const { offset, prefix } = findInsertionOffset(sf);
  const insertion = `${prefix}${JEST_IMPORT}`;
  return {
    result: source.slice(0, offset) + insertion + source.slice(offset),
    injected: true,
  };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("usesJestGlobal", () => {
  test("detects jest.fn()", () => {
    expect(usesJestGlobal(parse(`const fn = jest.fn();\n`))).toBe(true);
  });

  test("detects jest.spyOn()", () => {
    expect(usesJestGlobal(parse(`jest.spyOn(obj, "method");\n`))).toBe(true);
  });

  test("detects jest.mock()", () => {
    expect(usesJestGlobal(parse(`jest.mock("./foo");\n`))).toBe(true);
  });

  test("detects jest.resetAllMocks()", () => {
    expect(usesJestGlobal(parse(`jest.resetAllMocks();\n`))).toBe(true);
  });

  test("detects jest.useFakeTimers()", () => {
    expect(usesJestGlobal(parse(`jest.useFakeTimers();\n`))).toBe(true);
  });

  test("detects jest.advanceTimersByTime()", () => {
    expect(usesJestGlobal(parse(`jest.advanceTimersByTime(1000);\n`))).toBe(true);
  });

  test("detects jest.setTimeout()", () => {
    expect(usesJestGlobal(parse(`jest.setTimeout(30000);\n`))).toBe(true);
  });

  test("returns false when jest is not used", () => {
    expect(
      usesJestGlobal(parse(`describe("foo", () => { test("bar", () => {}); });\n`)),
    ).toBe(false);
  });

  test("returns false for empty file", () => {
    expect(usesJestGlobal(parse(""))).toBe(false);
  });

  test("does not false-positive on a variable named jest", () => {
    // `const jest = 1;` — no property access, should be false
    expect(usesJestGlobal(parse(`const jest = 1;\n`))).toBe(false);
  });
});

describe("hasJestImport", () => {
  test("detects existing import { jest } from '@jest/globals'", () => {
    const sf = parse(`import { jest } from "@jest/globals";\njest.fn();\n`);
    expect(hasJestImport(sf)).toBe(true);
  });

  test("detects jest among multiple named imports", () => {
    const sf = parse(`import { jest, expect } from "@jest/globals";\n`);
    expect(hasJestImport(sf)).toBe(true);
  });

  test("returns false when @jest/globals is not imported", () => {
    const sf = parse(`import { something } from "other";\n`);
    expect(hasJestImport(sf)).toBe(false);
  });

  test("returns false when @jest/globals imported without jest binding", () => {
    const sf = parse(`import { expect } from "@jest/globals";\n`);
    expect(hasJestImport(sf)).toBe(false);
  });
});

describe("injection pipeline", () => {
  test("injects after last import when jest.fn() is used", () => {
    const source = `import { Foo } from "./foo";\n\nconst fn = jest.fn();\n`;
    const { result, injected } = injectIfNeeded(source);
    expect(injected).toBe(true);
    expect(result).toMatchSnapshot();
    expect(result).toContain(JEST_IMPORT);
  });

  test("injects after multiple imports", () => {
    const source = `import { A } from "./a";\nimport { B } from "./b";\n\njest.mock("./a");\n`;
    const { result, injected } = injectIfNeeded(source);
    expect(injected).toBe(true);
    expect(result).toMatchSnapshot();
  });

  test("injects at position 0 when no imports exist", () => {
    const source = `jest.mock("./foo");\ndescribe("x", () => {});\n`;
    const { result, injected } = injectIfNeeded(source);
    expect(injected).toBe(true);
    expect(result).toMatchSnapshot();
    expect(result.startsWith(JEST_IMPORT)).toBe(true);
  });

  test("skips file that already has jest import", () => {
    const source = `import { jest } from "@jest/globals";\njest.fn();\n`;
    const { result, injected } = injectIfNeeded(source);
    expect(injected).toBe(false);
    expect(result).toBe(source);
  });

  test("skips file that does not use jest", () => {
    const source = `import { Foo } from "./foo";\ndescribe("x", () => { test("y", () => { expect(1).toBe(1); }); });\n`;
    const { result, injected } = injectIfNeeded(source);
    expect(injected).toBe(false);
    expect(result).toBe(source);
  });

  test("handles jest.spyOn deep in nested blocks", () => {
    const source = `import { Foo } from "./foo";\n\ndescribe("x", () => {\n  beforeEach(() => {\n    jest.spyOn(Foo, "bar");\n  });\n});\n`;
    const { result, injected } = injectIfNeeded(source);
    expect(injected).toBe(true);
    expect(result).toMatchSnapshot();
  });

  test("handles multiple jest.* calls — only one import injected", () => {
    const source = `import { X } from "./x";\njest.mock("./x");\nconst fn = jest.fn();\njest.resetAllMocks();\n`;
    const { result, injected } = injectIfNeeded(source);
    expect(injected).toBe(true);
    expect(result).toMatchSnapshot();
    // Verify only one import line
    const matches = result.match(/@jest\/globals/g);
    expect(matches).toHaveLength(1);
  });

  test("idempotent — running twice produces same output", () => {
    const source = `import { Foo } from "./foo";\njest.fn();\n`;
    const first = injectIfNeeded(source);
    expect(first.injected).toBe(true);
    const second = injectIfNeeded(first.result);
    expect(second.injected).toBe(false);
    expect(second.result).toBe(first.result);
  });
});
