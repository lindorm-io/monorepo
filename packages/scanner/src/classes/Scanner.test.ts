import { join } from "path";
import { Scanner } from "./Scanner.js";
import { describe, expect, test } from "vitest";

describe("Scanner", () => {
  const path = join(__dirname, "..", "..", "example");

  test("should resolve all files in classes", () => {
    const scanner = new Scanner();

    expect(scanner.scan(__dirname)).toEqual({
      baseName: "classes",
      basePath: "classes",
      children: [
        {
          baseName: "ScanData",
          basePath: "classes/ScanData",
          children: [],
          extension: "ts",
          fullName: "ScanData.ts",
          fullPath: expect.stringContaining("/classes/ScanData.ts"),
          isDirectory: false,
          isFile: true,
          parents: ["classes"],
          relativePath: "classes/ScanData.ts",
          types: [],
        },
        {
          baseName: "Scanner",
          basePath: "classes/Scanner.test",
          children: [],
          extension: "ts",
          fullName: "Scanner.test.ts",
          fullPath: expect.stringContaining("/classes/Scanner.test.ts"),
          isDirectory: false,
          isFile: true,
          parents: ["classes"],
          relativePath: "classes/Scanner.test.ts",
          types: ["test"],
        },
        {
          baseName: "Scanner",
          basePath: "classes/Scanner",
          children: [],
          extension: "ts",
          fullName: "Scanner.ts",
          fullPath: expect.stringContaining("/classes/Scanner.ts"),
          isDirectory: false,
          isFile: true,
          parents: ["classes"],
          relativePath: "classes/Scanner.ts",
          types: [],
        },
        {
          baseName: "index",
          basePath: "classes/index",
          children: [],
          extension: "ts",
          fullName: "index.ts",
          fullPath: expect.stringContaining("/classes/index.ts"),
          isDirectory: false,
          isFile: true,
          parents: ["classes"],
          relativePath: "classes/index.ts",
          types: [],
        },
      ],
      extension: null,
      fullName: "classes",
      fullPath: expect.stringContaining("/classes"),
      isDirectory: true,
      isFile: false,
      parents: [],
      relativePath: "classes",
      types: [],
    });
  });

  test("should resolve with denied extensions", () => {
    const scanner = new Scanner({
      deniedExtensions: [/js$/, /ts$/, /txt$/],
    });

    expect(Scanner.flatten(scanner.scan(path))).toEqual([
      {
        baseName: "[file9]",
        basePath: "example/files/[parent4]/[file9]",
        children: [],
        extension: "json",
        fullName: "[file9].json",
        fullPath: expect.stringContaining("/example/files/[parent4]/[file9].json"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files", "[parent4]"],
        relativePath: "example/files/[parent4]/[file9].json",
        types: [],
      },
      {
        baseName: "file4",
        basePath: "example/files/file4",
        children: [],
        extension: "json",
        fullName: "file4.json",
        fullPath: expect.stringContaining("/example/files/file4.json"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files"],
        relativePath: "example/files/file4.json",
        types: [],
      },
    ]);
  });

  test("should resolve with denied directories", () => {
    const scanner = new Scanner({
      deniedDirectories: [/parent/],
      deniedFilenames: [/^worker-/],
    });

    expect(Scanner.flatten(scanner.scan(path))).toEqual([
      {
        baseName: "file1",
        basePath: "example/files/file1",
        children: [],
        extension: "ts",
        fullName: "file1.ts",
        fullPath: expect.stringContaining("/example/files/file1.ts"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files"],
        relativePath: "example/files/file1.ts",
        types: [],
      },
      {
        baseName: "file10",
        basePath: "example/files/file10.test-type",
        children: [],
        extension: "ts",
        fullName: "file10.test-type.ts",
        fullPath: expect.stringContaining("/example/files/file10.test-type.ts"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files"],
        relativePath: "example/files/file10.test-type.ts",
        types: ["test-type"],
      },
      {
        baseName: "file11",
        basePath: "example/files/file11.other.type",
        children: [],
        extension: "ts",
        fullName: "file11.other.type.ts",
        fullPath: expect.stringContaining("/example/files/file11.other.type.ts"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files"],
        relativePath: "example/files/file11.other.type.ts",
        types: ["type", "other"],
      },
      {
        baseName: "file2",
        basePath: "example/files/file2",
        children: [],
        extension: "txt",
        fullName: "file2.txt",
        fullPath: expect.stringContaining("/example/files/file2.txt"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files"],
        relativePath: "example/files/file2.txt",
        types: [],
      },
      {
        baseName: "file3",
        basePath: "example/files/file3",
        children: [],
        extension: "js",
        fullName: "file3.js",
        fullPath: expect.stringContaining("/example/files/file3.js"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files"],
        relativePath: "example/files/file3.js",
        types: [],
      },
      {
        baseName: "file4",
        basePath: "example/files/file4",
        children: [],
        extension: "json",
        fullName: "file4.json",
        fullPath: expect.stringContaining("/example/files/file4.json"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files"],
        relativePath: "example/files/file4.json",
        types: [],
      },
      {
        baseName: "index",
        basePath: "example/index",
        children: [],
        extension: "ts",
        fullName: "index.ts",
        fullPath: expect.stringContaining("/example/index.ts"),
        isDirectory: false,
        isFile: true,
        parents: ["example"],
        relativePath: "example/index.ts",
        types: [],
      },
    ]);
  });

  test("should resolve with denied file names", () => {
    const scanner = new Scanner({
      deniedDirectories: [/files/],
      deniedFilenames: [/^worker-/],
    });

    expect(Scanner.flatten(scanner.scan(path))).toEqual([
      {
        baseName: "index",
        basePath: "example/index",
        children: [],
        extension: "ts",
        fullName: "index.ts",
        fullPath: expect.stringContaining("/example/index.ts"),
        isDirectory: false,
        isFile: true,
        parents: ["example"],
        relativePath: "example/index.ts",
        types: [],
      },
    ]);
  });

  describe("import", () => {
    const fixturePath = join(__dirname, "..", "__fixtures__", "import-fixture.ts");
    const decoratorFixturePath = join(
      __dirname,
      "..",
      "__fixtures__",
      "decorator-fixture.ts",
    );

    test("should import a file", async () => {
      const scanner = new Scanner();
      const result = await scanner.import<{ fixture: { foo: string } }>(fixturePath);

      expect(result).toEqual({ fixture: { foo: "bar" } });
    });

    test("should accept IScanData", async () => {
      const scanner = new Scanner();
      const scanData = { fullPath: fixturePath };
      const result = await scanner.import<{ fixture: { foo: string } }>(scanData as any);

      expect(result).toEqual({ fixture: { foo: "bar" } });
    });

    test("should propagate MODULE_NOT_FOUND error", async () => {
      const scanner = new Scanner();

      await expect(scanner.import("/missing/module.ts")).rejects.toThrow();
    });

    // Exercises the tsx-fallback path: vitest's default oxc transformer does
    // not lower TC39 stage-3 decorators, so native dynamic import throws a
    // SyntaxError. Scanner catches it and re-imports via tsx/esm/api.
    test("should fall back to tsx for files the host transformer rejects", async () => {
      const scanner = new Scanner();
      const result = await scanner.import<{
        Decorated: new () => { alias: string };
        created: { alias: string };
      }>(decoratorFixturePath);

      expect(result.created).toBeInstanceOf(result.Decorated);
      expect(result.created.alias).toBe("decorated-fixture");
      expect((result.Decorated as any)[Symbol.metadata]?.tag).toBe("decorated-fallback");
    });
  });

  test("should resolve with denied file types", () => {
    const scanner = new Scanner({
      deniedTypes: [/^test$/, /^type$/],
      deniedFilenames: [/^worker-/],
    });

    expect(Scanner.flatten(scanner.scan(path))).toEqual([
      {
        baseName: "[file9]",
        basePath: "example/files/[parent4]/[file9]",
        children: [],
        extension: "json",
        fullName: "[file9].json",
        fullPath: expect.stringContaining("/example/files/[parent4]/[file9].json"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files", "[parent4]"],
        relativePath: "example/files/[parent4]/[file9].json",
        types: [],
      },
      {
        baseName: "file1",
        basePath: "example/files/file1",
        children: [],
        extension: "ts",
        fullName: "file1.ts",
        fullPath: expect.stringContaining("/example/files/file1.ts"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files"],
        relativePath: "example/files/file1.ts",
        types: [],
      },
      {
        baseName: "file10",
        basePath: "example/files/file10.test-type",
        children: [],
        extension: "ts",
        fullName: "file10.test-type.ts",
        fullPath: expect.stringContaining("/example/files/file10.test-type.ts"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files"],
        relativePath: "example/files/file10.test-type.ts",
        types: ["test-type"],
      },
      {
        baseName: "file2",
        basePath: "example/files/file2",
        children: [],
        extension: "txt",
        fullName: "file2.txt",
        fullPath: expect.stringContaining("/example/files/file2.txt"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files"],
        relativePath: "example/files/file2.txt",
        types: [],
      },
      {
        baseName: "file3",
        basePath: "example/files/file3",
        children: [],
        extension: "js",
        fullName: "file3.js",
        fullPath: expect.stringContaining("/example/files/file3.js"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files"],
        relativePath: "example/files/file3.js",
        types: [],
      },
      {
        baseName: "file4",
        basePath: "example/files/file4",
        children: [],
        extension: "json",
        fullName: "file4.json",
        fullPath: expect.stringContaining("/example/files/file4.json"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files"],
        relativePath: "example/files/file4.json",
        types: [],
      },
      {
        baseName: "file5",
        basePath: "example/files/parent1/file5",
        children: [],
        extension: "ts",
        fullName: "file5.ts",
        fullPath: expect.stringContaining("/example/files/parent1/file5.ts"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files", "parent1"],
        relativePath: "example/files/parent1/file5.ts",
        types: [],
      },
      {
        baseName: "file6",
        basePath: "example/files/parent1/parent2/file6",
        children: [],
        extension: "js",
        fullName: "file6.js",
        fullPath: expect.stringContaining("/example/files/parent1/parent2/file6.js"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files", "parent1", "parent2"],
        relativePath: "example/files/parent1/parent2/file6.js",
        types: [],
      },
      {
        baseName: "file7",
        basePath: "example/files/parent3/file7",
        children: [],
        extension: "txt",
        fullName: "file7.txt",
        fullPath: expect.stringContaining("/example/files/parent3/file7.txt"),
        isDirectory: false,
        isFile: true,
        parents: ["example", "files", "parent3"],
        relativePath: "example/files/parent3/file7.txt",
        types: [],
      },
      {
        baseName: "index",
        basePath: "example/index",
        children: [],
        extension: "ts",
        fullName: "index.ts",
        fullPath: expect.stringContaining("/example/index.ts"),
        isDirectory: false,
        isFile: true,
        parents: ["example"],
        relativePath: "example/index.ts",
        types: [],
      },
    ]);
  });
});
