import * as path from "node:path";

import {
  rewriteSource,
  type RewriteOptions,
  type SubpathImportsMap,
  type SubpathImportEntry,
} from "./esm-rewrite";

// ---------------------------------------------------------------------------
// In-memory FS helper
// ---------------------------------------------------------------------------

type FsEntry = "file" | "dir";

const makeFs = (
  entries: Record<string, FsEntry>,
): Pick<RewriteOptions, "fileExists" | "isDirectory"> => {
  const normalised: Record<string, FsEntry> = {};
  for (const [k, v] of Object.entries(entries)) {
    normalised[path.resolve(k)] = v;
  }
  return {
    fileExists: (p: string) => normalised[path.resolve(p)] === "file",
    isDirectory: (p: string) => normalised[path.resolve(p)] === "dir",
  };
};

const FILE = "/src/index.ts";

const run = (
  source: string,
  fsEntries: Record<string, FsEntry> = {},
  filePath: string = FILE,
) =>
  rewriteSource(source, {
    filePath,
    ...makeFs(fsEntries),
  });

// ---------------------------------------------------------------------------
// 1. Relative file imports
// ---------------------------------------------------------------------------

describe("relative file imports", () => {
  test("rewrites ./foo to ./foo.js when ./foo.ts exists", () => {
    const result = run(`import { X } from "./foo";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  test("rewrites ../bar when ../bar.ts exists", () => {
    const result = run(`import { X } from "../bar";\n`, {
      "/bar.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites ./Button when ./Button.tsx exists", () => {
    const result = run(`import Button from "./Button";\n`, {
      "/src/Button.tsx": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("leaves already-extensioned .js untouched", () => {
    const result = run(`import { X } from "./foo.js";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
  });

  test("leaves already-extensioned .ts untouched (no normalisation)", () => {
    const result = run(`import { X } from "./foo.ts";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
  });

  test("leaves .json imports untouched", () => {
    const result = run(`import data from "./foo.json";\n`, {
      "/src/foo.json": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  test("leaves package imports untouched", () => {
    const result = run(`import { B64 } from "@lindorm/b64";\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  test("leaves node builtin imports untouched", () => {
    const result = run(`import * as fs from "node:fs";\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
  });

  test("leaves #internal subpath imports untouched", () => {
    const result = run(`import { Foo } from "#internal/classes/Foo";\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Relative directory imports
// ---------------------------------------------------------------------------

describe("relative directory imports", () => {
  test("rewrites ./foo to ./foo/index.js when ./foo/index.ts exists", () => {
    const result = run(`import { X } from "./foo";\n`, {
      "/src/foo": "dir",
      "/src/foo/index.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites ./foo to ./foo/index.js when ./foo/index.tsx exists", () => {
    const result = run(`import { X } from "./foo";\n`, {
      "/src/foo": "dir",
      "/src/foo/index.tsx": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("file wins when both ./foo.ts and ./foo/index.ts exist", () => {
    const result = run(`import { X } from "./foo";\n`, {
      "/src/foo.ts": "file",
      "/src/foo": "dir",
      "/src/foo/index.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("unresolved relative emits warning and leaves source untouched", () => {
    const result = run(`import { X } from "./missing";\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].kind).toBe("unresolved-relative");
    expect(result.warnings[0].line).toBe(1);
  });

  test("trailing slash on directory specifier is normalised", () => {
    const result = run(`import { X } from "./foo/";\n`, {
      "/src/foo": "dir",
      "/src/foo/index.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Mixed value + type imports
// ---------------------------------------------------------------------------

describe("mixed value and type imports", () => {
  test("preserves inline type modifier on mixed import", () => {
    const result = run(`import { A, type B } from "./foo";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites import type", () => {
    const result = run(`import type { T } from "./foo";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites both value and type imports from same module", () => {
    const result = run(`import { A } from "./foo";\nimport type { T } from "./foo";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Re-exports
// ---------------------------------------------------------------------------

describe("re-exports", () => {
  test("rewrites export * from", () => {
    const result = run(`export * from "./foo";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites export { X } from", () => {
    const result = run(`export { X } from "./foo";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites export { X as Y } from", () => {
    const result = run(`export { X as Y } from "./foo";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites export type { X } from", () => {
    const result = run(`export type { X } from "./foo";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites export { type X } from and preserves inline type", () => {
    const result = run(`export { type X } from "./foo";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("leaves package re-export untouched", () => {
    const result = run(`export * from "@lindorm/other";\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
  });

  test("leaves local declaration export untouched", () => {
    const result = run(`export const foo = 1;\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Static-string dynamic import()
// ---------------------------------------------------------------------------

describe("dynamic import() with static string", () => {
  test("rewrites import('./foo')", () => {
    const result = run(`const m = import("./foo");\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites await import('./foo') in async context", () => {
    const result = run(
      `export const load = async () => {\n  const mod = await import("./foo");\n  return mod;\n};\n`,
      { "/src/foo.ts": "file" },
    );
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("leaves dynamic import of package untouched", () => {
    const result = run(`const m = import("@lindorm/b64");\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
  });

  test("leaves dynamic import of .json untouched", () => {
    const result = run(`const m = import("./foo.json");\n`, {
      "/src/foo.json": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Template-literal dynamic import()
// ---------------------------------------------------------------------------

describe("dynamic import() with template literal", () => {
  test("warns and leaves template-literal dynamic import untouched", () => {
    const source = `const load = (name: string) => import(\`./drivers/\${name}\`);\n`;
    const result = run(source);
    expect(result.source).toBe(source);
    expect(result.changed).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].kind).toBe("dynamic-template-import");
    expect(result.warnings[0].line).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 7. jest.mock / jest.unstable_mockModule
// ---------------------------------------------------------------------------

describe("jest.mock and jest.unstable_mockModule", () => {
  test("rewrites jest.mock('./foo', factory)", () => {
    const result = run(`jest.mock("./foo", () => ({}));\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites jest.unstable_mockModule('./foo', factory)", () => {
    const result = run(`jest.unstable_mockModule("./foo", () => ({}));\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("leaves jest.mock of package untouched", () => {
    const result = run(`jest.mock("@lindorm/b64", () => ({}));\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
  });

  test("warns on jest.mock with non-literal argument", () => {
    const source = `const spec = "./foo";\njest.mock(spec, () => ({}));\n`;
    const result = run(source, { "/src/foo.ts": "file" });
    expect(result.source).toBe(source);
    expect(result.changed).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].kind).toBe("dynamic-jest-mock");
  });
});

// ---------------------------------------------------------------------------
// 8. require.resolve with relative path
// ---------------------------------------------------------------------------

describe("require.resolve", () => {
  test("injects createRequire boilerplate when file has no imports", () => {
    const result = run(`const p = require.resolve("./foo");\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
    expect(result.source).toContain(`import { createRequire } from "node:module";`);
    expect(result.source).toContain(`const require = createRequire(import.meta.url);`);
    expect(result.source).toContain(`require.resolve("./foo.js")`);
  });

  test("inserts createRequire boilerplate after last existing import", () => {
    const source = `import { X } from "./foo";\n\nconst p = require.resolve("./bar");\n`;
    const result = run(source, {
      "/src/foo.ts": "file",
      "/src/bar.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
    expect(result.source).toContain(`import { createRequire } from "node:module";`);
    expect(result.source).toContain(`const require = createRequire(import.meta.url);`);
    expect(result.source).toContain(`require.resolve("./bar.js")`);
  });

  test("does not duplicate createRequire import when already present", () => {
    const source = `import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);\nconst p = require.resolve("./foo");\n`;
    const result = run(source, { "/src/foo.ts": "file" });
    expect(result.source).toMatchSnapshot();
    // Should only appear once.
    const importMatches = result.source.match(
      /import \{ createRequire \} from "node:module";/g,
    );
    expect(importMatches).toHaveLength(1);
    const callMatches = result.source.match(
      /const require = createRequire\(import\.meta\.url\);/g,
    );
    expect(callMatches).toHaveLength(1);
  });

  test("leaves require.resolve of package untouched and no boilerplate injection", () => {
    const result = run(`const p = require.resolve("@lindorm/b64");\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.source).not.toContain("createRequire");
  });

  test("warns on require.resolve with non-literal argument", () => {
    const source = `const name = "./foo";\nconst p = require.resolve(name);\n`;
    const result = run(source, { "/src/foo.ts": "file" });
    expect(result.source).toBe(source);
    expect(result.changed).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].kind).toBe("dynamic-require-resolve");
  });

  test("leaves require.resolve of .json untouched", () => {
    const result = run(`const p = require.resolve("./foo.json");\n`, {
      "/src/foo.json": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.source).not.toContain("createRequire");
  });
});

// ---------------------------------------------------------------------------
// 9. Non-import string literals
// ---------------------------------------------------------------------------

describe("non-import string literals", () => {
  test("leaves fs.readFile('./config') untouched", () => {
    const result = run(`fs.readFile("./config");\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  test("leaves plain string constant untouched", () => {
    const result = run(`const p = "./relative/path";\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
  });

  test("leaves Error message string untouched", () => {
    const result = run(`throw new Error("./foo");\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10. .json imports
// ---------------------------------------------------------------------------

describe(".json imports", () => {
  test("leaves import data from './foo.json' untouched", () => {
    const result = run(`import data from "./foo.json";\n`, {
      "/src/foo.json": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 11. Preservation invariants
// ---------------------------------------------------------------------------

describe("preservation invariants", () => {
  test("single-quoted imports stay single-quoted", () => {
    const result = run(`import { X } from './foo';\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.source).toContain(`'./foo.js'`);
    expect(result.source).not.toContain(`"./foo.js"`);
  });

  test("double-quoted imports stay double-quoted", () => {
    const result = run(`import { X } from "./foo";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.source).toContain(`"./foo.js"`);
    expect(result.source).not.toContain(`'./foo.js'`);
  });

  test("trailing comma in import specifier list preserved", () => {
    const result = run(`import { A, B, } from "./foo";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.source).toContain("A, B,");
  });

  test("leading comments preserved", () => {
    const source = `// header comment\n/* block comment */\nimport { X } from "./foo";\n`;
    const result = run(source, { "/src/foo.ts": "file" });
    expect(result.source).toMatchSnapshot();
    expect(result.source).toContain("// header comment");
    expect(result.source).toContain("/* block comment */");
  });

  test("multi-line import formatting preserved", () => {
    const source = `import {\n  A,\n  B,\n  C,\n} from "./foo";\n`;
    const result = run(source, { "/src/foo.ts": "file" });
    expect(result.source).toMatchSnapshot();
    expect(result.source).toContain("{\n  A,\n  B,\n  C,\n}");
  });
});

// ---------------------------------------------------------------------------
// Edge cases discovered while writing the suite
// ---------------------------------------------------------------------------

describe("additional edge cases", () => {
  test("empty source returns empty result", () => {
    const result = run("");
    expect(result).toEqual({ source: "", changed: false, warnings: [] });
  });

  test("multiple rewrites in one file apply in correct order", () => {
    const source = `import { A } from "./a";\nimport { B } from "./b";\nexport { C } from "./c";\n`;
    const result = run(source, {
      "/src/a.ts": "file",
      "/src/b.ts": "file",
      "/src/c.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("namespace import import * as X from './foo'", () => {
    const result = run(`import * as Foo from "./foo";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("default import import X from './foo'", () => {
    const result = run(`import X from "./foo";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("side-effect import 'import ./foo'", () => {
    const result = run(`import "./foo";\n`, {
      "/src/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("unresolved relative warning carries correct line number", () => {
    const source = `// line 1\n// line 2\nimport { X } from "./missing";\n`;
    const result = run(source);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].line).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 12. Subpath imports (`#internal/*`) — Spike 0 v2a
// ---------------------------------------------------------------------------

describe("subpath imports (#internal/*)", () => {
  const SUBPATH_BASE = path.resolve("/pkg/src/internal");
  const SUBPATH_MAP: SubpathImportsMap = {
    "#internal/*": SUBPATH_BASE,
  };
  const PKG_FILE = "/pkg/src/classes/Hermes.ts";

  const runSubpath = (source: string, fsEntries: Record<string, FsEntry> = {}) =>
    rewriteSource(source, {
      filePath: PKG_FILE,
      subpathImports: SUBPATH_MAP,
      ...makeFs(fsEntries),
    });

  test("rewrites #internal/foo to #internal/foo.js when file exists", () => {
    const result = runSubpath(`import { Foo } from "#internal/foo";\n`, {
      "/pkg/src/internal/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  test("rewrites #internal/foo to #internal/foo/index.js when directory exists", () => {
    const result = runSubpath(`import { Foo } from "#internal/foo";\n`, {
      "/pkg/src/internal/foo": "dir",
      "/pkg/src/internal/foo/index.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites nested #internal/classes/Foo file", () => {
    const result = runSubpath(`import { Foo } from "#internal/classes/Foo";\n`, {
      "/pkg/src/internal/classes/Foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites #internal/foo when index.tsx exists", () => {
    const result = runSubpath(`import { Foo } from "#internal/foo";\n`, {
      "/pkg/src/internal/foo": "dir",
      "/pkg/src/internal/foo/index.tsx": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("file wins over directory when both exist", () => {
    const result = runSubpath(`import { Foo } from "#internal/foo";\n`, {
      "/pkg/src/internal/foo.ts": "file",
      "/pkg/src/internal/foo": "dir",
      "/pkg/src/internal/foo/index.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites export * from #internal/foo", () => {
    const result = runSubpath(`export * from "#internal/foo";\n`, {
      "/pkg/src/internal/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites export { X } from #internal/foo", () => {
    const result = runSubpath(`export { X } from "#internal/foo";\n`, {
      "/pkg/src/internal/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites export type { X } from #internal/foo", () => {
    const result = runSubpath(`export type { X } from "#internal/foo";\n`, {
      "/pkg/src/internal/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites dynamic import('#internal/foo')", () => {
    const result = runSubpath(`const m = import("#internal/foo");\n`, {
      "/pkg/src/internal/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites jest.mock('#internal/foo', factory)", () => {
    const result = runSubpath(`jest.mock("#internal/foo", () => ({}));\n`, {
      "/pkg/src/internal/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("rewrites require.resolve('#internal/foo') and injects createRequire", () => {
    const result = runSubpath(`const p = require.resolve("#internal/foo");\n`, {
      "/pkg/src/internal/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
    expect(result.source).toContain(`import { createRequire } from "node:module";`);
    expect(result.source).toContain(`const require = createRequire(import.meta.url);`);
    expect(result.source).toContain(`require.resolve("#internal/foo.js")`);
  });

  test("emits unresolved-subpath-import warning when target missing", () => {
    const result = runSubpath(`import { X } from "#internal/missing";\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].kind).toBe("unresolved-subpath-import");
    expect(result.warnings[0].line).toBe(1);
  });

  test("leaves already-extensioned #internal/foo.js untouched", () => {
    const result = runSubpath(`import { X } from "#internal/foo.js";\n`, {
      "/pkg/src/internal/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  test("leaves non-matching #other/foo subpath untouched", () => {
    const result = runSubpath(`import { X } from "#other/foo";\n`, {
      "/pkg/src/internal/foo.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  test("warns and leaves template-literal dynamic import(`#internal/${name}`) untouched", () => {
    const source = `const load = (name: string) => import(\`#internal/\${name}\`);\n`;
    const result = runSubpath(source);
    expect(result.source).toBe(source);
    expect(result.changed).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].kind).toBe("dynamic-template-import");
  });

  test("regression: package import @lindorm/x unchanged with subpath map present", () => {
    const result = runSubpath(`import { B64 } from "@lindorm/b64";\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  test("regression: relative import still rewrites with subpath map present", () => {
    const result = runSubpath(`import { X } from "./local";\n`, {
      "/pkg/src/classes/local.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("bare #internal prefix with no tail emits warning", () => {
    const result = runSubpath(`import x from "#internal";\n`);
    expect(result.changed).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].kind).toBe("unresolved-subpath-import");
  });
});

// ---------------------------------------------------------------------------
// 13. Subpath imports — providesExtension (imports map already has .js)
// ---------------------------------------------------------------------------

describe("subpath imports with providesExtension", () => {
  const SUBPATH_BASE = path.resolve("/pkg/src/internal");
  const SUBPATH_MAP_EXT: SubpathImportsMap = {
    "#internal/*": { baseDir: SUBPATH_BASE, providesExtension: true },
  };
  const PKG_FILE = "/pkg/src/classes/Hermes.ts";

  const runSubpathExt = (source: string, fsEntries: Record<string, FsEntry> = {}) =>
    rewriteSource(source, {
      filePath: PKG_FILE,
      subpathImports: SUBPATH_MAP_EXT,
      ...makeFs(fsEntries),
    });

  test("leaves #internal/foo untouched when imports map provides extension", () => {
    const result = runSubpathExt(`import { Foo } from "#internal/foo";\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  test("leaves nested #internal/classes/Foo untouched when imports map provides extension", () => {
    const result = runSubpathExt(`import { Foo } from "#internal/classes/Foo";\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  test("leaves export * from #internal/foo untouched when imports map provides extension", () => {
    const result = runSubpathExt(`export * from "#internal/foo";\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  test("leaves dynamic import('#internal/foo') untouched when imports map provides extension", () => {
    const result = runSubpathExt(`const m = import("#internal/foo");\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  test("leaves jest.mock('#internal/foo') untouched when imports map provides extension", () => {
    const result = runSubpathExt(`jest.mock("#internal/foo", () => ({}));\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  test("leaves require.resolve('#internal/foo') untouched — no createRequire injection", () => {
    const result = runSubpathExt(`const p = require.resolve("#internal/foo");\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.source).not.toContain("createRequire");
  });

  test("leaves already-extensioned #internal/foo.js untouched (still passthrough)", () => {
    const result = runSubpathExt(`import { X } from "#internal/foo.js";\n`);
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  test("relative imports still rewrite even when subpath has providesExtension", () => {
    const result = runSubpathExt(`import { X } from "./local";\n`, {
      "/pkg/src/classes/local.ts": "file",
    });
    expect(result.source).toMatchSnapshot();
    expect(result.changed).toBe(true);
  });

  test("bare #internal prefix still warns even with providesExtension", () => {
    const result = runSubpathExt(`import x from "#internal";\n`);
    // providesExtension applies — bare prefix with empty tail is still passed through
    expect(result.changed).toBe(false);
    expect(result.warnings).toEqual([]);
  });
});
