import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  applyTypeOnlyFixes,
  findTypeOnlyImports,
  type TypeOnlyFix,
} from "./esm-rewrite-type-only";

// ---------------------------------------------------------------------------
// applyTypeOnlyFixes — pure string transform
// ---------------------------------------------------------------------------

const FILE = "/fake/src/index.ts";

const fixFor = (specifiers: TypeOnlyFix["specifiers"]): TypeOnlyFix => ({
  filePath: FILE,
  specifiers,
});

describe("applyTypeOnlyFixes", () => {
  test("inline-annotates a single type-only specifier in a mixed import", () => {
    const source = `import { A, B } from "./foo";\n`;
    const out = applyTypeOnlyFixes(
      source,
      fixFor([{ line: 1, importedName: "B", localName: "B", kind: "import-named" }]),
    );
    expect(out).toMatchSnapshot();
    expect(out).toContain("import { A, type B } from");
  });

  test("promotes whole statement to import type when every specifier is type-only", () => {
    const source = `import { B } from "./foo";\n`;
    const out = applyTypeOnlyFixes(
      source,
      fixFor([{ line: 1, importedName: "B", localName: "B", kind: "import-named" }]),
    );
    expect(out).toMatchSnapshot();
    expect(out).toContain("import type { B } from");
  });

  test("promotes multi-specifier statement when all are type-only", () => {
    const source = `import { A, B } from "./foo";\n`;
    const out = applyTypeOnlyFixes(
      source,
      fixFor([
        { line: 1, importedName: "A", localName: "A", kind: "import-named" },
        { line: 1, importedName: "B", localName: "B", kind: "import-named" },
      ]),
    );
    expect(out).toMatchSnapshot();
    expect(out).toContain("import type { A, B } from");
  });

  test("promotes default-only import to import type", () => {
    const source = `import X from "./foo";\n`;
    const out = applyTypeOnlyFixes(
      source,
      fixFor([{ line: 1, importedName: "X", localName: "X", kind: "import-default" }]),
    );
    expect(out).toMatchSnapshot();
    expect(out).toContain("import type X from");
  });

  test("idempotent: no-op when specifier is already inline type-marked", () => {
    const source = `import { A, type B } from "./foo";\n`;
    const out = applyTypeOnlyFixes(
      source,
      fixFor([{ line: 1, importedName: "B", localName: "B", kind: "import-named" }]),
    );
    expect(out).toBe(source);
  });

  test("idempotent: no-op when whole import is already import type", () => {
    const source = `import type { B } from "./foo";\n`;
    const out = applyTypeOnlyFixes(
      source,
      fixFor([{ line: 1, importedName: "B", localName: "B", kind: "import-named" }]),
    );
    expect(out).toBe(source);
  });

  test("namespace import: no fix produced, source untouched", () => {
    // applyTypeOnlyFixes is given an empty fix record (findTypeOnlyImports
    // never produces fixes for namespace imports), so this is equivalent.
    const source = `import * as X from "./foo";\n`;
    const out = applyTypeOnlyFixes(source, fixFor([]));
    expect(out).toBe(source);
  });

  test("preserves single quotes on mixed import rewrite", () => {
    const source = `import { A, B } from './foo';\n`;
    const out = applyTypeOnlyFixes(
      source,
      fixFor([{ line: 1, importedName: "B", localName: "B", kind: "import-named" }]),
    );
    expect(out).toContain("'./foo'");
    expect(out).toContain("type B");
  });

  test("preserves trailing comma in specifier list", () => {
    const source = `import { A, B, } from "./foo";\n`;
    const out = applyTypeOnlyFixes(
      source,
      fixFor([{ line: 1, importedName: "B", localName: "B", kind: "import-named" }]),
    );
    expect(out).toContain("type B,");
  });

  test("handles aliased named import (foo as Bar)", () => {
    const source = `import { foo as Bar } from "./foo";\n`;
    const out = applyTypeOnlyFixes(
      source,
      fixFor([{ line: 1, importedName: "foo", localName: "Bar", kind: "import-named" }]),
    );
    expect(out).toMatchSnapshot();
    expect(out).toContain("import type { foo as Bar }");
  });

  test("inline-annotates type-only specifier in re-export", () => {
    const source = `export { A, B } from "./foo";\n`;
    const out = applyTypeOnlyFixes(
      source,
      fixFor([{ line: 1, importedName: "B", localName: "B", kind: "export-named" }]),
    );
    expect(out).toMatchSnapshot();
    expect(out).toContain("export { A, type B }");
  });

  test("promotes re-export to export type when all specifiers are type-only", () => {
    const source = `export { A, B } from "./foo";\n`;
    const out = applyTypeOnlyFixes(
      source,
      fixFor([
        { line: 1, importedName: "A", localName: "A", kind: "export-named" },
        { line: 1, importedName: "B", localName: "B", kind: "export-named" },
      ]),
    );
    expect(out).toMatchSnapshot();
    expect(out).toContain("export type { A, B }");
  });

  test("multi-line import formatting preserved", () => {
    const source = `import {\n  A,\n  B,\n} from "./foo";\n`;
    // B lives on line 3 in this source.
    const out = applyTypeOnlyFixes(
      source,
      fixFor([{ line: 3, importedName: "B", localName: "B", kind: "import-named" }]),
    );
    expect(out).toMatchSnapshot();
    expect(out).toContain("type B");
  });

  test("empty fix list returns source unchanged", () => {
    const source = `import { A } from "./foo";\n`;
    expect(applyTypeOnlyFixes(source, fixFor([]))).toBe(source);
  });
});

// ---------------------------------------------------------------------------
// findTypeOnlyImports — end-to-end with a real ts.Program
// ---------------------------------------------------------------------------

describe("findTypeOnlyImports", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "esm-type-only-"));

    fs.writeFileSync(
      path.join(tmpDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "ES2022",
            moduleResolution: "Bundler",
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            verbatimModuleSyntax: true,
          },
          include: ["*.ts"],
        },
        null,
        2,
      ),
    );

    fs.writeFileSync(
      path.join(tmpDir, "lib.ts"),
      `export class Foo {}\nexport type Bar = { id: string };\nexport interface Baz { n: number }\nexport const value = 1;\n`,
    );

    fs.writeFileSync(
      path.join(tmpDir, "entry.ts"),
      `import { Foo, type Bar, Baz } from "./lib";\nexport const f = (b: Bar, z: Baz) => new Foo();\n`,
    );
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("detects Baz as type-only while leaving Foo and Bar alone", () => {
    const result = findTypeOnlyImports({
      tsconfigPath: path.join(tmpDir, "tsconfig.json"),
      files: [path.join(tmpDir, "entry.ts")],
    });

    expect(result.fixes).toHaveLength(1);
    const [fix] = result.fixes;
    expect(fix.filePath).toBe(path.resolve(path.join(tmpDir, "entry.ts")));

    const names = fix.specifiers.map((s) => s.localName).sort();
    expect(names).toEqual(["Baz"]);
    expect(fix.specifiers[0].kind).toBe("import-named");
  });

  test("applying the fix clears TS1484 in the entry file", () => {
    const result = findTypeOnlyImports({
      tsconfigPath: path.join(tmpDir, "tsconfig.json"),
      files: [path.join(tmpDir, "entry.ts")],
    });
    const source = fs.readFileSync(path.join(tmpDir, "entry.ts"), "utf8");
    const rewritten = applyTypeOnlyFixes(source, result.fixes[0]);
    expect(rewritten).toMatchSnapshot();
    expect(rewritten).toContain("type Baz");
  });
});

// ---------------------------------------------------------------------------
// findTypeOnlyImports — regression: globals-colliding & plain type-only exports
// ---------------------------------------------------------------------------

describe("findTypeOnlyImports — cross-package dist-d.ts resolution regression", () => {
  let tmpDir: string;

  beforeAll(() => {
    // Layout (mirrors a monorepo where `@lib/types` is resolved by `@lib/is`
    // through a published `dist/*.d.ts` because the consumer tsconfig only
    // includes its own src/, not the producer's src/):
    //
    //   tmp/
    //     packages/
    //       types/
    //         src/index.ts       (type-only exports: Dict, Function)
    //         dist/index.d.ts    (mirror of the above — what node resolves)
    //         package.json
    //       is/
    //         src/is-function.ts (value-imports Function)
    //         src/is-object.ts   (value-imports Dict)
    //         src/parse.ts       (value-imports Dict)
    //         tsconfig.json      (include ./src)
    //         package.json
    //       hermes/
    //         src/index.ts       (value-imports isFunction — unrelated, just
    //                             drives pivot selection in multi-file runs)
    //         tsconfig.json      (include ./src)
    //         package.json
    //     node_modules/@lib/types  -> symlink to packages/types
    //     node_modules/@lib/is     -> symlink to packages/is
    //
    // The critical bit: when findTypeOnlyImports is given hermes/tsconfig.json
    // and asked about files inside packages/is/src, those files are NOT part
    // of hermes's include list. Before the fix, the Program loaded @lib/is
    // only via its dist/index.d.ts, so the is/src sources were never iterated
    // and no fix was emitted.
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "esm-type-only-xpkg-"));
    const mk = (rel: string, content: string) => {
      const abs = path.join(tmpDir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    };

    const tsconfigBase = {
      target: "ES2022",
      module: "ES2022",
      moduleResolution: "Node",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      verbatimModuleSyntax: true,
      esModuleInterop: true,
    };

    // @lib/types — a source file plus a matching dist/.d.ts. Both declare
    // Dict and Function as type-only. @lib/is consumer will resolve through
    // dist/index.d.ts via node_modules.
    mk(
      "packages/types/src/index.ts",
      `export type Dict<T = any> = Record<string, T>;\nexport type Function<T = any> = (...args: any[]) => T;\n`,
    );
    mk(
      "packages/types/dist/index.d.ts",
      `export type Dict<T = any> = Record<string, T>;\nexport type Function<T = any> = (...args: any[]) => T;\n`,
    );
    mk("packages/types/dist/index.js", `export {};\n`);
    mk(
      "packages/types/package.json",
      JSON.stringify(
        {
          name: "@lib/types",
          version: "0.0.0",
          main: "dist/index.js",
          types: "dist/index.d.ts",
        },
        null,
        2,
      ),
    );

    // @lib/is — three files that value-import from @lib/types.
    mk(
      "packages/is/src/is-function.ts",
      `import { Function } from "@lib/types";\nexport const isFunction = (x: unknown): x is Function => typeof x === "function";\n`,
    );
    mk(
      "packages/is/src/is-object.ts",
      `import { Dict } from "@lib/types";\nexport const isObject = (x: unknown): x is Dict => typeof x === "object" && x !== null;\n`,
    );
    mk(
      "packages/is/src/parse.ts",
      `import { Dict } from "@lib/types";\nexport const parse = (_: string): Dict | null => null;\n`,
    );
    mk(
      "packages/is/src/index.ts",
      `export { isFunction } from "./is-function";\nexport { isObject } from "./is-object";\nexport { parse } from "./parse";\n`,
    );
    mk(
      "packages/is/dist/index.d.ts",
      `export declare const isFunction: (x: unknown) => x is (...args: any[]) => any;\nexport declare const isObject: (x: unknown) => x is Record<string, any>;\nexport declare const parse: (s: string) => Record<string, any> | null;\n`,
    );
    mk("packages/is/dist/index.js", `export {};\n`);
    mk(
      "packages/is/tsconfig.json",
      JSON.stringify(
        { compilerOptions: { ...tsconfigBase, rootDir: "./src" }, include: ["src/**/*"] },
        null,
        2,
      ),
    );
    mk(
      "packages/is/package.json",
      JSON.stringify(
        {
          name: "@lib/is",
          version: "0.0.0",
          main: "dist/index.js",
          types: "dist/index.d.ts",
        },
        null,
        2,
      ),
    );

    // @lib/hermes — drives the "pivot" in a multi-package run.
    mk(
      "packages/hermes/src/index.ts",
      `import { isFunction } from "@lib/is";\nexport const run = (x: unknown) => isFunction(x);\n`,
    );
    mk(
      "packages/hermes/tsconfig.json",
      JSON.stringify(
        { compilerOptions: { ...tsconfigBase, rootDir: "./src" }, include: ["src/**/*"] },
        null,
        2,
      ),
    );
    mk(
      "packages/hermes/package.json",
      JSON.stringify({ name: "@lib/hermes", version: "0.0.0" }, null, 2),
    );

    // node_modules symlinks so Node resolution sees @lib/types and @lib/is.
    fs.mkdirSync(path.join(tmpDir, "node_modules/@lib"), { recursive: true });
    fs.symlinkSync(
      path.join(tmpDir, "packages/types"),
      path.join(tmpDir, "node_modules/@lib/types"),
      "dir",
    );
    fs.symlinkSync(
      path.join(tmpDir, "packages/is"),
      path.join(tmpDir, "node_modules/@lib/is"),
      "dir",
    );
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("same-package run: detects Function and Dict as type-only", () => {
    // Sanity check: with is/tsconfig.json as pivot, the existing code path
    // already works because all is/src files are in the Program's include.
    const result = findTypeOnlyImports({
      tsconfigPath: path.join(tmpDir, "packages/is/tsconfig.json"),
      files: [
        path.join(tmpDir, "packages/is/src/is-function.ts"),
        path.join(tmpDir, "packages/is/src/is-object.ts"),
        path.join(tmpDir, "packages/is/src/parse.ts"),
      ],
    });
    expect(result.fixes).toHaveLength(3);
    const all = result.fixes.flatMap((f) => f.specifiers.map((s) => s.importedName));
    expect(all.sort()).toEqual(["Dict", "Dict", "Function"]);
  });

  test("cross-package run: detects Function and Dict when pivot tsconfig does not include is/src", () => {
    // The original Spike 5 gap: hermes/tsconfig.json is the pivot, and the
    // is/src files live outside its include list. Previously the Program only
    // knew about @lib/is through dist/*.d.ts and the is/src sources were
    // never iterated -> zero fixes.
    const result = findTypeOnlyImports({
      tsconfigPath: path.join(tmpDir, "packages/hermes/tsconfig.json"),
      files: [
        path.join(tmpDir, "packages/is/src/is-function.ts"),
        path.join(tmpDir, "packages/is/src/is-object.ts"),
        path.join(tmpDir, "packages/is/src/parse.ts"),
      ],
    });
    expect(result.fixes).toHaveLength(3);
    const all = result.fixes
      .flatMap((f) => f.specifiers.map((s) => s.importedName))
      .sort();
    expect(all).toEqual(["Dict", "Dict", "Function"]);
  });

  test("applying the cross-package fix promotes the Function import to import type", () => {
    const result = findTypeOnlyImports({
      tsconfigPath: path.join(tmpDir, "packages/hermes/tsconfig.json"),
      files: [path.join(tmpDir, "packages/is/src/is-function.ts")],
    });
    const [fix] = result.fixes;
    const source = fs.readFileSync(
      path.join(tmpDir, "packages/is/src/is-function.ts"),
      "utf8",
    );
    const rewritten = applyTypeOnlyFixes(source, fix);
    expect(rewritten).toContain('import type { Function } from "@lib/types"');
  });
});
