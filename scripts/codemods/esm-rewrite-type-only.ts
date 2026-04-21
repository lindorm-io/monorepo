/**
 * Type-only import detection + inline-annotation pass — Spike 0 v2b.
 *
 * The AST pass in `esm-rewrite.ts` cannot tell a value-only specifier from a
 * type-only specifier from a single-file walk alone: deciding whether
 * `import { Foo } from "@lindorm/x"` is a value or a type requires resolving
 * `Foo` through the TypeScript type-checker. Under `verbatimModuleSyntax`,
 * mixed imports that leave type-only specifiers unmarked produce TS1484.
 *
 * This module adds an opt-in second pass:
 *
 *   1. `findTypeOnlyImports` builds a `ts.Program` for a tsconfig and set of
 *      files, runs the checker against each import/export specifier, and
 *      returns a list of "this specifier is actually a type" fixes per file.
 *   2. `applyTypeOnlyFixes` takes a single file's source text + its fix record
 *      and returns the rewritten source with inline `type` markers added (or
 *      an `import type` / `export type` statement promotion when every
 *      specifier in the statement is type-only).
 *
 * The pure string-transform half is unit-testable in isolation. The checker
 * half is exercised end-to-end against a small fixture.
 */

import * as path from "node:path";

import ts from "typescript";

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export type TypeOnlySpecifierFix = {
  /** 1-based line number of the import/export specifier in the source file. */
  line: number;
  /** Name as it appears on the right-hand side of `foo as Bar` (the imported name). */
  importedName: string;
  /** Local binding name. Equal to importedName when there is no alias. */
  localName: string;
  /**
   * Whether this specifier sits in an `import ...` or `export ... from` statement.
   * Re-exports reuse the same inline-`type` syntax, but the surrounding keyword
   * is `export` instead of `import` when the whole statement is promoted.
   */
  kind: "import-named" | "import-default" | "export-named";
};

export type TypeOnlyFix = {
  /** Absolute path of the file this fix applies to. */
  filePath: string;
  specifiers: TypeOnlySpecifierFix[];
};

export type FindTypeOnlyImportsOptions = {
  tsconfigPath: string;
  /** Absolute file paths to analyse. Only these files are inspected for fixes. */
  files: string[];
};

export type FindTypeOnlyImportsResult = {
  fixes: TypeOnlyFix[];
  diagnostics: readonly ts.Diagnostic[];
  /** Warnings produced while analysing — not TS diagnostics, just codemod notes. */
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Program construction
// ---------------------------------------------------------------------------

const loadProgram = (tsconfigPath: string, extraRootNames: string[]): ts.Program => {
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(
      `Failed to read tsconfig at ${tsconfigPath}: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")}`,
    );
  }
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsconfigPath),
  );
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(
      `Failed to parse tsconfig at ${tsconfigPath}: ${ts.flattenDiagnosticMessageText(first.messageText, "\n")}`,
    );
  }
  // Force-add the caller's target files as root names. Without this, any file
  // outside the tsconfig's include/rootDir (e.g. a sibling package's source
  // when running a cross-package rewrite) is only visible to the Program as a
  // published .d.ts from node_modules — its source file is not iterated, so
  // no type-only fix is ever produced for it. Injecting as a root name forces
  // the source file into the Program; TS preferentially uses source over an
  // adjacent .d.ts when a file is explicitly added.
  const rootNames = Array.from(new Set([...parsed.fileNames, ...extraRootNames]));
  return ts.createProgram({
    rootNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
  });
};

// ---------------------------------------------------------------------------
// Symbol inspection
// ---------------------------------------------------------------------------

const VALUE_FLAGS =
  ts.SymbolFlags.Value |
  ts.SymbolFlags.Function |
  ts.SymbolFlags.Class |
  ts.SymbolFlags.Enum |
  ts.SymbolFlags.ValueModule |
  ts.SymbolFlags.Variable;

/**
 * Is the symbol at this node "type-only" in the sense that it has no runtime
 * value? Aliases (import bindings) are unwrapped through
 * `getAliasedSymbol` before checking flags, because the import-specifier
 * symbol itself carries `SymbolFlags.Alias` and looks value-like until
 * resolved.
 */
const isSymbolTypeOnly = (
  checker: ts.TypeChecker,
  node: ts.Node,
): { typeOnly: boolean; resolved: boolean } => {
  const symbol = checker.getSymbolAtLocation(node);
  if (!symbol) return { typeOnly: false, resolved: false };

  let resolved: ts.Symbol = symbol;
  if (symbol.flags & ts.SymbolFlags.Alias) {
    try {
      resolved = checker.getAliasedSymbol(symbol);
    } catch {
      return { typeOnly: false, resolved: false };
    }
  }

  const hasValue = (resolved.flags & VALUE_FLAGS) !== 0;
  const hasType =
    (resolved.flags &
      (ts.SymbolFlags.Type | ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias)) !==
    0;

  return { typeOnly: hasType && !hasValue, resolved: true };
};

// ---------------------------------------------------------------------------
// Per-file analysis
// ---------------------------------------------------------------------------

const lineOf = (sourceFile: ts.SourceFile, node: ts.Node): number =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

const collectImportFixes = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  warnings: string[],
): TypeOnlySpecifierFix[] => {
  const fixes: TypeOnlySpecifierFix[] = [];

  for (const statement of sourceFile.statements) {
    // ---- import declarations ---------------------------------------------
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (!clause) continue;
      // If already `import type { ... }`, nothing to do — every member is
      // already type-only.
      if (clause.isTypeOnly) continue;

      // Default import binding.
      if (clause.name) {
        const { typeOnly, resolved } = isSymbolTypeOnly(checker, clause.name);
        if (resolved && typeOnly) {
          fixes.push({
            line: lineOf(sourceFile, clause.name),
            importedName: clause.name.text,
            localName: clause.name.text,
            kind: "import-default",
          });
        }
      }

      // Named bindings.
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          // `import { type X }` — already type-only, skip.
          if (element.isTypeOnly) continue;
          const { typeOnly, resolved } = isSymbolTypeOnly(checker, element.name);
          if (!resolved || !typeOnly) continue;
          const importedName = element.propertyName?.text ?? element.name.text;
          fixes.push({
            line: lineOf(sourceFile, element),
            importedName,
            localName: element.name.text,
            kind: "import-named",
          });
        }
      } else if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        // `import * as X from "foo"` — never rewrite. A namespace import can
        // alias both value and type members transparently. Only emit a
        // warning when the checker reports the whole namespace as type-only.
        const { typeOnly, resolved } = isSymbolTypeOnly(
          checker,
          clause.namedBindings.name,
        );
        if (resolved && typeOnly) {
          warnings.push(
            `${sourceFile.fileName}:${lineOf(sourceFile, clause.namedBindings)} namespace import '${clause.namedBindings.name.text}' resolves to a type-only namespace; left untouched`,
          );
        }
      }
    }

    // ---- export declarations (re-exports) --------------------------------
    if (ts.isExportDeclaration(statement)) {
      if (!statement.moduleSpecifier) continue; // local re-export, no fix.
      if (statement.isTypeOnly) continue;
      if (!statement.exportClause) continue;
      if (!ts.isNamedExports(statement.exportClause)) continue;
      for (const element of statement.exportClause.elements) {
        if (element.isTypeOnly) continue;
        // For re-exports, the local identifier binding is what the checker
        // resolves. Use `propertyName` when present (it carries the imported
        // symbol) else fall back to `name`.
        const nameNode = element.propertyName ?? element.name;
        const { typeOnly, resolved } = isSymbolTypeOnly(checker, nameNode);
        if (!resolved || !typeOnly) continue;
        fixes.push({
          line: lineOf(sourceFile, element),
          importedName: element.propertyName?.text ?? element.name.text,
          localName: element.name.text,
          kind: "export-named",
        });
      }
    }
  }

  return fixes;
};

// ---------------------------------------------------------------------------
// Public: findTypeOnlyImports
// ---------------------------------------------------------------------------

export const findTypeOnlyImports = (
  opts: FindTypeOnlyImportsOptions,
): FindTypeOnlyImportsResult => {
  const absFiles = opts.files.map((f) => path.resolve(f));
  const program = loadProgram(opts.tsconfigPath, absFiles);
  const checker = program.getTypeChecker();
  const fixes: TypeOnlyFix[] = [];
  const warnings: string[] = [];

  const wanted = new Set(absFiles);

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    const abs = path.resolve(sourceFile.fileName);
    if (!wanted.has(abs)) continue;
    const specs = collectImportFixes(sourceFile, checker, warnings);
    if (specs.length === 0) continue;
    fixes.push({ filePath: abs, specifiers: specs });
  }

  // Non-blocking diagnostics — surface them so a caller can print/warn.
  const diagnostics = ts.getPreEmitDiagnostics(program);

  return { fixes, diagnostics, warnings };
};

// ---------------------------------------------------------------------------
// Public: applyTypeOnlyFixes
// ---------------------------------------------------------------------------

/**
 * Apply a single file's TypeOnlyFix to its source text. Pure string + AST
 * transform — no disk I/O, no checker, safe to unit test.
 *
 * Strategy: re-parse the source with the TS AST, walk each import/export
 * statement, match specifiers by `(line, localName, importedName)` against
 * the fix, then emit the replacement text. Prefer inline `type` annotation;
 * promote the whole statement to `import type` / `export type` only when
 * every named specifier is type-only (and there is no companion default
 * import, for imports).
 */
export const applyTypeOnlyFixes = (sourceText: string, fix: TypeOnlyFix): string => {
  if (fix.specifiers.length === 0) return sourceText;

  const sourceFile = ts.createSourceFile(
    fix.filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  // Build quick-lookup keyed by line → spec fixes.
  const byLine = new Map<number, TypeOnlySpecifierFix[]>();
  for (const spec of fix.specifiers) {
    const list = byLine.get(spec.line);
    if (list) list.push(spec);
    else byLine.set(spec.line, [spec]);
  }

  type Edit = { start: number; end: number; replacement: string };
  const edits: Edit[] = [];

  const lineAt = (node: ts.Node): number =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

  const isFixed = (node: ts.Node, localName: string, importedName: string): boolean => {
    const line = lineAt(node);
    const list = byLine.get(line);
    if (!list) return false;
    return list.some((s) => s.localName === localName && s.importedName === importedName);
  };

  for (const statement of sourceFile.statements) {
    // --- import declarations ---------------------------------------------
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (!clause || clause.isTypeOnly) continue;

      // Default-only: `import X from "./foo"` where X is type-only.
      if (
        clause.name &&
        !clause.namedBindings &&
        isFixed(clause.name, clause.name.text, clause.name.text)
      ) {
        // Promote whole statement to `import type X from "./foo"`.
        // Edit: insert `type ` right after the `import` keyword.
        const importKeyword = statement.getFirstToken(sourceFile);
        if (importKeyword) {
          edits.push({
            start: importKeyword.getEnd(),
            end: importKeyword.getEnd(),
            replacement: " type",
          });
        }
        continue;
      }

      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        const elements = clause.namedBindings.elements;
        const elementFixed: boolean[] = elements.map((el) =>
          el.isTypeOnly
            ? true
            : isFixed(el, el.name.text, el.propertyName?.text ?? el.name.text),
        );
        const allFixed = elements.every((_, i) => elementFixed[i]);
        const defaultIsFixed =
          clause.name && isFixed(clause.name, clause.name.text, clause.name.text);

        // Promote statement only when there is no default binding AND every
        // named element is type-only (either already marked or a fix target).
        if (!clause.name && allFixed) {
          const importKeyword = statement.getFirstToken(sourceFile);
          if (importKeyword) {
            edits.push({
              start: importKeyword.getEnd(),
              end: importKeyword.getEnd(),
              replacement: " type",
            });
            // And strip any existing inline `type ` modifiers to avoid
            // redundant `import type { type X }` which tsc rejects.
            for (const el of elements) {
              if (el.isTypeOnly) {
                const typeKw = el
                  .getChildren(sourceFile)
                  .find((c) => c.kind === ts.SyntaxKind.TypeKeyword);
                if (typeKw) {
                  edits.push({
                    start: typeKw.getStart(),
                    end: typeKw.getEnd() + 1, // include trailing space
                    replacement: "",
                  });
                }
              }
            }
          }
          continue;
        }

        // Inline-annotate each named element needing a fix. Default binding
        // (if any) stays as-is unless it too is a fix target.
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          if (!elementFixed[i] || el.isTypeOnly) continue;
          edits.push({
            start: el.getStart(),
            end: el.getStart(),
            replacement: "type ",
          });
        }

        if (defaultIsFixed && clause.name) {
          // A mixed default+named import where the default is type-only but
          // some named members are values is pathological. We cannot express
          // `import type X, { Value } from "foo"`. Emit no fix for the
          // default binding in this case; leaving it untouched is safer than
          // producing invalid syntax.
          // (findTypeOnlyImports normally will not emit a default fix here —
          // this branch is defensive.)
        }
        continue;
      }
    }

    // --- export declarations (re-exports) --------------------------------
    if (ts.isExportDeclaration(statement)) {
      if (!statement.moduleSpecifier) continue;
      if (statement.isTypeOnly) continue;
      if (!statement.exportClause) continue;
      if (!ts.isNamedExports(statement.exportClause)) continue;

      const elements = statement.exportClause.elements;
      const elementFixed = elements.map((el) =>
        el.isTypeOnly
          ? true
          : isFixed(el, el.name.text, el.propertyName?.text ?? el.name.text),
      );
      const allFixed = elements.every((_, i) => elementFixed[i]);

      if (allFixed) {
        const exportKeyword = statement.getFirstToken(sourceFile);
        if (exportKeyword) {
          edits.push({
            start: exportKeyword.getEnd(),
            end: exportKeyword.getEnd(),
            replacement: " type",
          });
          for (const el of elements) {
            if (el.isTypeOnly) {
              const typeKw = el
                .getChildren(sourceFile)
                .find((c) => c.kind === ts.SyntaxKind.TypeKeyword);
              if (typeKw) {
                edits.push({
                  start: typeKw.getStart(),
                  end: typeKw.getEnd() + 1,
                  replacement: "",
                });
              }
            }
          }
        }
        continue;
      }

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (!elementFixed[i] || el.isTypeOnly) continue;
        edits.push({
          start: el.getStart(),
          end: el.getStart(),
          replacement: "type ",
        });
      }
    }
  }

  if (edits.length === 0) return sourceText;
  edits.sort((a, b) => b.start - a.start);
  let out = sourceText;
  for (const edit of edits) {
    out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end);
  }
  return out;
};
