/**
 * ESM import rewriter — Spike 0 v1.
 *
 * AST-based rewrite of a single TypeScript source file. Converts extensionless
 * relative import/export specifiers into explicit `.js` / `/index.js` form so
 * the emitted JavaScript resolves under Node's strict ESM (`NodeNext`) resolver.
 *
 * See `.plan/esm-migration-plan.md` "Extension codemod" for scope. Spike 0 v1:
 *   - Relative file/directory imports (with on-disk probing)
 *   - Static-string dynamic import()
 *   - Template-literal dynamic import()            → warn, untouched
 *   - Re-exports (`export *`, `export { … }`, `export type`)
 *   - `jest.mock(...)` / `jest.unstable_mockModule(...)` string literals
 *   - `require.resolve("...")` relative paths → rewrite + inject createRequire
 *   - Type-only specifier splits under verbatimModuleSyntax — NOT inferred here;
 *     inline `type` modifiers are preserved verbatim
 *   - Package subpath imports (`#internal/*`) when a `subpathImports` map is
 *     supplied — same file-vs-directory probing as relative imports
 *   - `.json` imports, package imports, non-matching `#foo` subpaths, non-import
 *     strings → untouched
 *   - `.cts` / `.mts` files skipped by the CLI wrapper, not this function
 *
 * NEVER double-suffixes. If a relative specifier already ends in a known
 * extension (.js, .ts, .tsx, .mjs, .cjs, .mts, .cts, .json) it is left alone.
 */

import * as path from "node:path";

import ts from "typescript";

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export type RewriteWarningKind =
  | "unresolved-relative"
  | "unresolved-subpath-import"
  | "dynamic-template-import"
  | "dynamic-jest-mock"
  | "dynamic-require-resolve";

export type RewriteWarning = {
  kind: RewriteWarningKind;
  line: number;
  message: string;
};

/**
 * Map from subpath-import pattern (e.g. `#internal/*`) to resolution info.
 *
 * - `string` — absolute source base directory the `*` substitutes into
 *   (e.g. `/abs/packages/foo/src/internal`). The codemod probes the FS and
 *   appends `.js` / `/index.js` as needed.
 * - `{ baseDir: string; providesExtension: true }` — the `imports` map value
 *   already contains the extension (e.g. `"./dist/internal/*.js"`), so the
 *   specifier is left untouched. Node resolves via the `imports` map directly.
 *
 * Only patterns ending in `/*` are supported — the `*` is the tail.
 */
export type SubpathImportEntry = string | { baseDir: string; providesExtension: true };
export type SubpathImportsMap = Record<string, SubpathImportEntry>;

export type RewriteOptions = {
  filePath: string;
  fileExists: (absPath: string) => boolean;
  isDirectory: (absPath: string) => boolean;
  subpathImports?: SubpathImportsMap;
};

export type RewriteResult = {
  source: string;
  changed: boolean;
  warnings: RewriteWarning[];
};

type Edit = {
  start: number;
  end: number;
  replacement: string;
};

type Resolved =
  | { kind: "keep"; newSpecifier: string }
  | { kind: "warn"; warning: RewriteWarning };

const KNOWN_EXTENSIONS = [".js", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts", ".json"];

const hasKnownExtension = (specifier: string): boolean =>
  KNOWN_EXTENSIONS.some((ext) => specifier.endsWith(ext));

const isRelativeSpecifier = (specifier: string): boolean =>
  specifier.startsWith("./") ||
  specifier.startsWith("../") ||
  specifier === "." ||
  specifier === "..";

const isSubpathSpecifier = (specifier: string): boolean => specifier.startsWith("#");

/**
 * Match a specifier against a subpath-imports map. Patterns must end in `/*`.
 * Returns the absolute base directory and the `*` tail, or null when no
 * pattern matches. The specifier prefix MUST include the `/` so that `#foo`
 * does not accidentally match `#foobar/*`.
 */
const matchSubpathPattern = (
  specifier: string,
  subpathImports: SubpathImportsMap,
): { baseDir: string; tail: string; providesExtension: boolean } | null => {
  for (const [pattern, entry] of Object.entries(subpathImports)) {
    if (!pattern.endsWith("/*")) continue;
    const prefix = pattern.slice(0, -1); // keep trailing '/'
    const baseDir = typeof entry === "string" ? entry : entry.baseDir;
    const providesExtension = typeof entry === "object" && entry.providesExtension;
    if (specifier === prefix.slice(0, -1)) {
      // bare prefix (e.g. "#internal") with no tail — not resolvable as file
      return { baseDir, tail: "", providesExtension };
    }
    if (specifier.startsWith(prefix)) {
      return { baseDir, tail: specifier.slice(prefix.length), providesExtension };
    }
  }
  return null;
};

const RESOLUTION_ORDER: Array<{ fileSuffix?: string; indexFile?: string; emit: string }> =
  [
    { fileSuffix: ".ts", emit: ".js" },
    { fileSuffix: ".tsx", emit: ".js" },
    { indexFile: "index.ts", emit: "/index.js" },
    { indexFile: "index.tsx", emit: "/index.js" },
  ];

// ---------------------------------------------------------------------------
// Specifier resolution
// ---------------------------------------------------------------------------

const resolveRelativeSpecifier = (
  specifier: string,
  opts: RewriteOptions,
  lineForWarning: number,
): Resolved => {
  if (hasKnownExtension(specifier)) {
    return { kind: "keep", newSpecifier: specifier };
  }

  const sourceDir = path.dirname(opts.filePath);
  // Strip trailing slash so `./foo/` and `./foo` resolve consistently.
  const trimmed = specifier.replace(/\/+$/, "");
  const absBase = path.resolve(sourceDir, trimmed);

  for (const attempt of RESOLUTION_ORDER) {
    if (attempt.fileSuffix) {
      const candidate = `${absBase}${attempt.fileSuffix}`;
      if (opts.fileExists(candidate)) {
        return { kind: "keep", newSpecifier: `${trimmed}${attempt.emit}` };
      }
      continue;
    }
    if (attempt.indexFile) {
      if (opts.isDirectory(absBase)) {
        const indexAbs = path.join(absBase, attempt.indexFile);
        if (opts.fileExists(indexAbs)) {
          return { kind: "keep", newSpecifier: `${trimmed}${attempt.emit}` };
        }
      }
    }
  }

  return {
    kind: "warn",
    warning: {
      kind: "unresolved-relative",
      line: lineForWarning,
      message: `Could not resolve relative specifier "${specifier}" from "${opts.filePath}"`,
    },
  };
};

const resolveSubpathSpecifier = (
  specifier: string,
  opts: RewriteOptions,
  lineForWarning: number,
): Resolved | null => {
  if (!opts.subpathImports) return null;
  const match = matchSubpathPattern(specifier, opts.subpathImports);
  if (!match) return null;

  // When the imports map value already provides the extension (e.g.
  // `"#internal/*": "./dist/internal/*.js"`), Node resolves the specifier
  // through the map — the codemod must NOT append `.js` to the specifier.
  if (match.providesExtension) {
    return { kind: "keep", newSpecifier: specifier };
  }

  if (hasKnownExtension(specifier)) {
    return { kind: "keep", newSpecifier: specifier };
  }

  if (match.tail === "") {
    return {
      kind: "warn",
      warning: {
        kind: "unresolved-subpath-import",
        line: lineForWarning,
        message: `Could not resolve subpath specifier "${specifier}" from "${opts.filePath}" (no tail)`,
      },
    };
  }

  const trimmedTail = match.tail.replace(/\/+$/, "");
  const absBase = path.resolve(match.baseDir, trimmedTail);

  for (const attempt of RESOLUTION_ORDER) {
    if (attempt.fileSuffix) {
      const candidate = `${absBase}${attempt.fileSuffix}`;
      if (opts.fileExists(candidate)) {
        // Re-assemble the new specifier from the matched prefix + updated tail.
        const prefix = specifier.slice(0, specifier.length - match.tail.length);
        return { kind: "keep", newSpecifier: `${prefix}${trimmedTail}${attempt.emit}` };
      }
      continue;
    }
    if (attempt.indexFile) {
      if (opts.isDirectory(absBase)) {
        const indexAbs = path.join(absBase, attempt.indexFile);
        if (opts.fileExists(indexAbs)) {
          const prefix = specifier.slice(0, specifier.length - match.tail.length);
          return {
            kind: "keep",
            newSpecifier: `${prefix}${trimmedTail}${attempt.emit}`,
          };
        }
      }
    }
  }

  return {
    kind: "warn",
    warning: {
      kind: "unresolved-subpath-import",
      line: lineForWarning,
      message: `Could not resolve subpath specifier "${specifier}" from "${opts.filePath}"`,
    },
  };
};

// ---------------------------------------------------------------------------
// Edit helpers
// ---------------------------------------------------------------------------

/**
 * Replace the inside of a string-literal node with the given specifier,
 * preserving the surrounding quote characters. Works for both single and
 * double quoted string literals as well as no-substitution template literals.
 */
const replaceStringLiteralBody = (
  edits: Edit[],
  node: ts.StringLiteralLike,
  newSpecifier: string,
): void => {
  // node.getStart() excludes leading trivia; node.getEnd() is past the closing quote.
  const start = node.getStart();
  const end = node.getEnd();
  // Preserve the original quote style (first and last chars of the raw text).
  const raw = node.getText();
  if (raw.length < 2) return;
  const open = raw[0];
  const close = raw[raw.length - 1];
  edits.push({ start, end, replacement: `${open}${newSpecifier}${close}` });
};

const lineOf = (sourceFile: ts.SourceFile, node: ts.Node): number =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

// ---------------------------------------------------------------------------
// Node handlers
// ---------------------------------------------------------------------------

const handleSpecifierNode = (
  specifierNode: ts.StringLiteralLike | undefined,
  sourceFile: ts.SourceFile,
  opts: RewriteOptions,
  edits: Edit[],
  warnings: RewriteWarning[],
): void => {
  if (!specifierNode) return;
  if (
    !ts.isStringLiteral(specifierNode) &&
    !ts.isNoSubstitutionTemplateLiteral(specifierNode)
  ) {
    return;
  }

  const specifier = specifierNode.text;
  let resolved: Resolved | null = null;
  if (isRelativeSpecifier(specifier)) {
    resolved = resolveRelativeSpecifier(
      specifier,
      opts,
      lineOf(sourceFile, specifierNode),
    );
  } else if (isSubpathSpecifier(specifier)) {
    resolved = resolveSubpathSpecifier(
      specifier,
      opts,
      lineOf(sourceFile, specifierNode),
    );
  }
  if (!resolved) return;

  if (resolved.kind === "warn") {
    warnings.push(resolved.warning);
    return;
  }
  if (resolved.newSpecifier === specifier) return;

  replaceStringLiteralBody(edits, specifierNode, resolved.newSpecifier);
};

const isRequireResolveCall = (node: ts.CallExpression): boolean => {
  const expr = node.expression;
  if (!ts.isPropertyAccessExpression(expr)) return false;
  if (!ts.isIdentifier(expr.expression) || expr.expression.text !== "require")
    return false;
  if (!ts.isIdentifier(expr.name) || expr.name.text !== "resolve") return false;
  return true;
};

const isMockCall = (node: ts.CallExpression): boolean => {
  const expr = node.expression;
  if (!ts.isPropertyAccessExpression(expr)) return false;
  if (!ts.isIdentifier(expr.expression)) return false;
  const obj = expr.expression.text;
  if (obj !== "jest" && obj !== "vi") return false;
  if (!ts.isIdentifier(expr.name)) return false;
  return (
    expr.name.text === "mock" ||
    expr.name.text === "unstable_mockModule" ||
    expr.name.text === "doMock"
  );
};

// ---------------------------------------------------------------------------
// createRequire injection
// ---------------------------------------------------------------------------

const hasCreateRequireImport = (sourceFile: ts.SourceFile): boolean => {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const moduleText = (statement.moduleSpecifier as ts.StringLiteral).text;
    if (moduleText !== "node:module" && moduleText !== "module") continue;
    const clause = statement.importClause;
    if (!clause || !clause.namedBindings) continue;
    if (!ts.isNamedImports(clause.namedBindings)) continue;
    for (const element of clause.namedBindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      if (imported === "createRequire") return true;
    }
  }
  return false;
};

const hasCreateRequireCall = (sourceFile: ts.SourceFile): boolean => {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (!decl.initializer || !ts.isCallExpression(decl.initializer)) continue;
      const callee = decl.initializer.expression;
      if (ts.isIdentifier(callee) && callee.text === "createRequire") return true;
    }
  }
  return false;
};

const computeInjectionOffset = (sourceFile: ts.SourceFile): number => {
  let lastImportEnd = -1;
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      lastImportEnd = statement.getEnd();
    }
  }
  if (lastImportEnd >= 0) return lastImportEnd;

  // No imports: inject at position 0 (after any leading trivia is tricky, but
  // inserting at 0 keeps the leading comments above our injection, which is fine).
  return 0;
};

const buildCreateRequireBoilerplate = (sourceFile: ts.SourceFile): string => {
  const needsImport = !hasCreateRequireImport(sourceFile);
  const needsCall = !hasCreateRequireCall(sourceFile);
  const parts: string[] = [];
  if (needsImport) parts.push(`import { createRequire } from "node:module";`);
  if (needsCall) parts.push(`const require = createRequire(import.meta.url);`);
  if (parts.length === 0) return "";
  return `\n${parts.join("\n")}\n`;
};

// ---------------------------------------------------------------------------
// Main rewrite function
// ---------------------------------------------------------------------------

export const rewriteSource = (
  sourceText: string,
  opts: RewriteOptions,
): RewriteResult => {
  const sourceFile = ts.createSourceFile(
    opts.filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  const edits: Edit[] = [];
  const warnings: RewriteWarning[] = [];
  let needsCreateRequireInjection = false;

  const visit = (node: ts.Node): void => {
    // --- import / export declarations -------------------------------------
    if (ts.isImportDeclaration(node)) {
      handleSpecifierNode(
        node.moduleSpecifier as ts.StringLiteralLike,
        sourceFile,
        opts,
        edits,
        warnings,
      );
    } else if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) {
        handleSpecifierNode(
          node.moduleSpecifier as ts.StringLiteralLike,
          sourceFile,
          opts,
          edits,
          warnings,
        );
      }
    } else if (ts.isCallExpression(node)) {
      // --- dynamic import() -----------------------------------------------
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const [arg] = node.arguments;
        if (arg) {
          if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
            handleSpecifierNode(arg, sourceFile, opts, edits, warnings);
          } else if (ts.isTemplateExpression(arg)) {
            warnings.push({
              kind: "dynamic-template-import",
              line: lineOf(sourceFile, arg),
              message: `Template-literal dynamic import() left untouched; human audit required`,
            });
          }
        }
      } else if (isMockCall(node)) {
        // --- jest.mock / jest.unstable_mockModule / vi.mock / vi.doMock ---
        const [arg] = node.arguments;
        if (arg) {
          if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
            handleSpecifierNode(arg, sourceFile, opts, edits, warnings);
          } else {
            warnings.push({
              kind: "dynamic-jest-mock",
              line: lineOf(sourceFile, arg),
              message: `Non-literal mock module argument left untouched`,
            });
          }
        }
      } else if (isRequireResolveCall(node)) {
        // --- require.resolve("./foo") -------------------------------------
        const [arg] = node.arguments;
        if (arg) {
          if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
            const specifier = arg.text;
            if (
              isRelativeSpecifier(specifier) ||
              (isSubpathSpecifier(specifier) &&
                opts.subpathImports &&
                matchSubpathPattern(specifier, opts.subpathImports) !== null)
            ) {
              const before = edits.length;
              handleSpecifierNode(arg, sourceFile, opts, edits, warnings);
              if (edits.length > before) {
                needsCreateRequireInjection = true;
              }
            }
          } else {
            warnings.push({
              kind: "dynamic-require-resolve",
              line: lineOf(sourceFile, arg),
              message: `Non-literal require.resolve argument left untouched`,
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  // --- createRequire injection ------------------------------------------
  if (needsCreateRequireInjection) {
    const boilerplate = buildCreateRequireBoilerplate(sourceFile);
    if (boilerplate.length > 0) {
      const offset = computeInjectionOffset(sourceFile);
      edits.push({ start: offset, end: offset, replacement: boilerplate });
    }
  }

  if (edits.length === 0) {
    return { source: sourceText, changed: false, warnings };
  }

  // Apply edits from the end of the file backwards so offsets remain valid.
  edits.sort((a, b) => b.start - a.start);
  let out = sourceText;
  for (const edit of edits) {
    out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end);
  }

  return { source: out, changed: out !== sourceText, warnings };
};

// ---------------------------------------------------------------------------
// AST walker helper (exported for the audit script to reuse)
// ---------------------------------------------------------------------------

export const parseTypeScript = (filePath: string, sourceText: string): ts.SourceFile =>
  ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

export { ts };

// CLI wrapper lives in `./esm-rewrite-cli.ts` so this module stays free of
// top-level await and `import.meta`, and can be tested under a plain CJS Jest.
