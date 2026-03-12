import { join } from "path";
import { Scanner } from "./Scanner";

jest.mock("tsx/cjs/api", () => ({
  require: jest.fn((id: string) => jest.requireActual(id)),
}));

describe("Scanner", () => {
  const path = join(__dirname, "..", "..", "example");

  test("should resolve all files in classes", () => {
    const scanner = new Scanner();

    expect(scanner.scan(__dirname)).toEqual({
      _baseName: "classes",
      _basePath: "classes",
      _children: [
        {
          _baseName: "ScanData",
          _basePath: "classes/ScanData",
          _children: [],
          _extension: "ts",
          _fullName: "ScanData.ts",
          _fullPath: expect.stringContaining("/classes/ScanData.ts"),
          _isDirectory: false,
          _isFile: true,
          _parents: ["classes"],
          _relativePath: "classes/ScanData.ts",
          _types: [],
        },
        {
          _baseName: "Scanner",
          _basePath: "classes/Scanner.test",
          _children: [],
          _extension: "ts",
          _fullName: "Scanner.test.ts",
          _fullPath: expect.stringContaining("/classes/Scanner.test.ts"),
          _isDirectory: false,
          _isFile: true,
          _parents: ["classes"],
          _relativePath: "classes/Scanner.test.ts",
          _types: ["test"],
        },
        {
          _baseName: "Scanner",
          _basePath: "classes/Scanner",
          _children: [],
          _extension: "ts",
          _fullName: "Scanner.ts",
          _fullPath: expect.stringContaining("/classes/Scanner.ts"),
          _isDirectory: false,
          _isFile: true,
          _parents: ["classes"],
          _relativePath: "classes/Scanner.ts",
          _types: [],
        },
        {
          _baseName: "index",
          _basePath: "classes/index",
          _children: [],
          _extension: "ts",
          _fullName: "index.ts",
          _fullPath: expect.stringContaining("/classes/index.ts"),
          _isDirectory: false,
          _isFile: true,
          _parents: ["classes"],
          _relativePath: "classes/index.ts",
          _types: [],
        },
      ],
      _extension: null,
      _fullName: "classes",
      _fullPath: expect.stringContaining("/classes"),
      _isDirectory: true,
      _isFile: false,
      _parents: [],
      _relativePath: "classes",
      _types: [],
    });
  });

  test("should resolve with denied extensions", () => {
    const scanner = new Scanner({
      deniedExtensions: [/js$/, /ts$/, /txt$/],
    });

    expect(Scanner.flatten(scanner.scan(path))).toEqual([
      {
        _baseName: "[file9]",
        _basePath: "example/files/[parent4]/[file9]",
        _children: [],
        _extension: "json",
        _fullName: "[file9].json",
        _fullPath: expect.stringContaining("/example/files/[parent4]/[file9].json"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files", "[parent4]"],
        _relativePath: "example/files/[parent4]/[file9].json",
        _types: [],
      },
      {
        _baseName: "file4",
        _basePath: "example/files/file4",
        _children: [],
        _extension: "json",
        _fullName: "file4.json",
        _fullPath: expect.stringContaining("/example/files/file4.json"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files"],
        _relativePath: "example/files/file4.json",
        _types: [],
      },
    ]);
  });

  test("should resolve with denied directories", () => {
    const scanner = new Scanner({
      deniedDirectories: [/parent/],
    });

    expect(Scanner.flatten(scanner.scan(path))).toEqual([
      {
        _baseName: "file1",
        _basePath: "example/files/file1",
        _children: [],
        _extension: "ts",
        _fullName: "file1.ts",
        _fullPath: expect.stringContaining("/example/files/file1.ts"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files"],
        _relativePath: "example/files/file1.ts",
        _types: [],
      },
      {
        _baseName: "file10",
        _basePath: "example/files/file10.test-type",
        _children: [],
        _extension: "ts",
        _fullName: "file10.test-type.ts",
        _fullPath: expect.stringContaining("/example/files/file10.test-type.ts"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files"],
        _relativePath: "example/files/file10.test-type.ts",
        _types: ["test-type"],
      },
      {
        _baseName: "file11",
        _basePath: "example/files/file11.other.type",
        _children: [],
        _extension: "ts",
        _fullName: "file11.other.type.ts",
        _fullPath: expect.stringContaining("/example/files/file11.other.type.ts"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files"],
        _relativePath: "example/files/file11.other.type.ts",
        _types: ["type", "other"],
      },
      {
        _baseName: "file2",
        _basePath: "example/files/file2",
        _children: [],
        _extension: "txt",
        _fullName: "file2.txt",
        _fullPath: expect.stringContaining("/example/files/file2.txt"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files"],
        _relativePath: "example/files/file2.txt",
        _types: [],
      },
      {
        _baseName: "file3",
        _basePath: "example/files/file3",
        _children: [],
        _extension: "js",
        _fullName: "file3.js",
        _fullPath: expect.stringContaining("/example/files/file3.js"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files"],
        _relativePath: "example/files/file3.js",
        _types: [],
      },
      {
        _baseName: "file4",
        _basePath: "example/files/file4",
        _children: [],
        _extension: "json",
        _fullName: "file4.json",
        _fullPath: expect.stringContaining("/example/files/file4.json"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files"],
        _relativePath: "example/files/file4.json",
        _types: [],
      },
      {
        _baseName: "index",
        _basePath: "example/index",
        _children: [],
        _extension: "ts",
        _fullName: "index.ts",
        _fullPath: expect.stringContaining("/example/index.ts"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example"],
        _relativePath: "example/index.ts",
        _types: [],
      },
    ]);
  });

  test("should resolve with denied file names", () => {
    const scanner = new Scanner({
      deniedDirectories: [/files/],
    });

    expect(Scanner.flatten(scanner.scan(path))).toEqual([
      {
        _baseName: "index",
        _basePath: "example/index",
        _children: [],
        _extension: "ts",
        _fullName: "index.ts",
        _fullPath: expect.stringContaining("/example/index.ts"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example"],
        _relativePath: "example/index.ts",
        _types: [],
      },
    ]);
  });

  describe("import", () => {
    const fixturePath = join(__dirname, "..", "__fixtures__", "require-fixture.ts");

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
  });

  describe("require", () => {
    const fixturePath = join(__dirname, "..", "__fixtures__", "require-fixture.ts");

    test("should require a file", () => {
      const scanner = new Scanner();
      const result = scanner.require<{ fixture: { foo: string } }>(fixturePath);

      expect(result).toEqual({ fixture: { foo: "bar" } });
    });

    test("should accept IScanData", () => {
      const scanner = new Scanner();
      const scanData = { fullPath: fixturePath };
      const result = scanner.require<{ fixture: { foo: string } }>(scanData as any);

      expect(result).toEqual({ fixture: { foo: "bar" } });
    });

    test("should propagate MODULE_NOT_FOUND error", () => {
      const scanner = new Scanner();

      expect(() => scanner.require("/missing/module.ts")).toThrow();
    });
  });

  test("should resolve with denied file types", () => {
    const scanner = new Scanner({
      deniedTypes: [/^test$/, /^type$/],
    });

    expect(Scanner.flatten(scanner.scan(path))).toEqual([
      {
        _baseName: "[file9]",
        _basePath: "example/files/[parent4]/[file9]",
        _children: [],
        _extension: "json",
        _fullName: "[file9].json",
        _fullPath: expect.stringContaining("/example/files/[parent4]/[file9].json"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files", "[parent4]"],
        _relativePath: "example/files/[parent4]/[file9].json",
        _types: [],
      },
      {
        _baseName: "file1",
        _basePath: "example/files/file1",
        _children: [],
        _extension: "ts",
        _fullName: "file1.ts",
        _fullPath: expect.stringContaining("/example/files/file1.ts"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files"],
        _relativePath: "example/files/file1.ts",
        _types: [],
      },
      {
        _baseName: "file10",
        _basePath: "example/files/file10.test-type",
        _children: [],
        _extension: "ts",
        _fullName: "file10.test-type.ts",
        _fullPath: expect.stringContaining("/example/files/file10.test-type.ts"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files"],
        _relativePath: "example/files/file10.test-type.ts",
        _types: ["test-type"],
      },
      {
        _baseName: "file2",
        _basePath: "example/files/file2",
        _children: [],
        _extension: "txt",
        _fullName: "file2.txt",
        _fullPath: expect.stringContaining("/example/files/file2.txt"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files"],
        _relativePath: "example/files/file2.txt",
        _types: [],
      },
      {
        _baseName: "file3",
        _basePath: "example/files/file3",
        _children: [],
        _extension: "js",
        _fullName: "file3.js",
        _fullPath: expect.stringContaining("/example/files/file3.js"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files"],
        _relativePath: "example/files/file3.js",
        _types: [],
      },
      {
        _baseName: "file4",
        _basePath: "example/files/file4",
        _children: [],
        _extension: "json",
        _fullName: "file4.json",
        _fullPath: expect.stringContaining("/example/files/file4.json"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files"],
        _relativePath: "example/files/file4.json",
        _types: [],
      },
      {
        _baseName: "file5",
        _basePath: "example/files/parent1/file5",
        _children: [],
        _extension: "ts",
        _fullName: "file5.ts",
        _fullPath: expect.stringContaining("/example/files/parent1/file5.ts"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files", "parent1"],
        _relativePath: "example/files/parent1/file5.ts",
        _types: [],
      },
      {
        _baseName: "file6",
        _basePath: "example/files/parent1/parent2/file6",
        _children: [],
        _extension: "js",
        _fullName: "file6.js",
        _fullPath: expect.stringContaining("/example/files/parent1/parent2/file6.js"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files", "parent1", "parent2"],
        _relativePath: "example/files/parent1/parent2/file6.js",
        _types: [],
      },
      {
        _baseName: "file7",
        _basePath: "example/files/parent3/file7",
        _children: [],
        _extension: "txt",
        _fullName: "file7.txt",
        _fullPath: expect.stringContaining("/example/files/parent3/file7.txt"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example", "files", "parent3"],
        _relativePath: "example/files/parent3/file7.txt",
        _types: [],
      },
      {
        _baseName: "index",
        _basePath: "example/index",
        _children: [],
        _extension: "ts",
        _fullName: "index.ts",
        _fullPath: expect.stringContaining("/example/index.ts"),
        _isDirectory: false,
        _isFile: true,
        _parents: ["example"],
        _relativePath: "example/index.ts",
        _types: [],
      },
    ]);
  });
});
