import { StructureScanner } from "./StructureScanner";

describe("StructureScanner", () => {
  const path = [__dirname, "..", "..", "example"];

  test("should resolve all files", () => {
    const scanner = new StructureScanner();

    expect(scanner.scan(__dirname)).toStrictEqual([
      {
        baseName: "StructureScanner.test",
        basePath: "StructureScanner.test",
        children: [],
        extension: ".ts",
        fullName: "StructureScanner.test.ts",
        fullPath: expect.stringContaining("/src/class/StructureScanner.test.ts"),
        isDirectory: false,
        isFile: true,
        parents: [],
        relativePath: "StructureScanner.test.ts",
      },
      {
        baseName: "StructureScanner",
        basePath: "StructureScanner",
        children: [],
        extension: ".ts",
        fullName: "StructureScanner.ts",
        fullPath: expect.stringContaining("/src/class/StructureScanner.ts"),
        isDirectory: false,
        isFile: true,
        parents: [],
        relativePath: "StructureScanner.ts",
      },
      {
        baseName: "index",
        basePath: "index",
        children: [],
        extension: ".ts",
        fullName: "index.ts",
        fullPath: expect.stringContaining("/src/class/index.ts"),
        isDirectory: false,
        isFile: true,
        parents: [],
        relativePath: "index.ts",
      },
    ]);
  });

  test("should resolve with denied extensions", () => {
    const scanner = new StructureScanner({
      deniedExtensions: [/[.](js|ts|txt)$/],
    });

    expect(StructureScanner.flatten(scanner.scan(...path))).toStrictEqual([
      {
        baseName: "[file9]",
        basePath: "files/[parent4]/[file9]",
        children: [],
        extension: ".json",
        fullName: "[file9].json",
        fullPath: expect.stringContaining("/example/files/[parent4]/[file9].json"),
        isDirectory: false,
        isFile: true,
        parents: ["files", "[parent4]"],
        relativePath: "files/[parent4]/[file9].json",
      },
      {
        baseName: "file4",
        basePath: "files/file4",
        children: [],
        extension: ".json",
        fullName: "file4.json",
        fullPath: expect.stringContaining("/example/files/file4.json"),
        isDirectory: false,
        isFile: true,
        parents: ["files"],
        relativePath: "files/file4.json",
      },
    ]);
  });

  test("should resolve with denied directories", () => {
    const scanner = new StructureScanner({
      deniedDirectories: [/parent/],
    });

    expect(StructureScanner.flatten(scanner.scan(...path))).toStrictEqual([
      {
        baseName: "file1",
        basePath: "files/file1",
        children: [],
        extension: ".ts",
        fullName: "file1.ts",
        fullPath: expect.stringContaining("/example/files/file1.ts"),
        isDirectory: false,
        isFile: true,
        parents: ["files"],
        relativePath: "files/file1.ts",
      },
      {
        baseName: "file2",
        basePath: "files/file2",
        children: [],
        extension: ".txt",
        fullName: "file2.txt",
        fullPath: expect.stringContaining("/example/files/file2.txt"),
        isDirectory: false,
        isFile: true,
        parents: ["files"],
        relativePath: "files/file2.txt",
      },
      {
        baseName: "file3",
        basePath: "files/file3",
        children: [],
        extension: ".js",
        fullName: "file3.js",
        fullPath: expect.stringContaining("/example/files/file3.js"),
        isDirectory: false,
        isFile: true,
        parents: ["files"],
        relativePath: "files/file3.js",
      },
      {
        baseName: "file4",
        basePath: "files/file4",
        children: [],
        extension: ".json",
        fullName: "file4.json",
        fullPath: expect.stringContaining("/example/files/file4.json"),
        isDirectory: false,
        isFile: true,
        parents: ["files"],
        relativePath: "files/file4.json",
      },
      {
        baseName: "scanner",
        basePath: "scanner",
        children: [],
        extension: ".ts",
        fullName: "scanner.ts",
        fullPath: expect.stringContaining("/example/scanner.ts"),
        isDirectory: false,
        isFile: true,
        parents: [],
        relativePath: "scanner.ts",
      },
    ]);
  });

  test("should resolve with denied file names", () => {
    const scanner = new StructureScanner({
      deniedDirectories: [/file/],
    });

    expect(StructureScanner.flatten(scanner.scan(...path))).toStrictEqual([
      {
        baseName: "scanner",
        basePath: "scanner",
        children: [],
        extension: ".ts",
        fullName: "scanner.ts",
        fullPath: expect.stringContaining("/example/scanner.ts"),
        isDirectory: false,
        isFile: true,
        parents: [],
        relativePath: "scanner.ts",
      },
    ]);
  });
});
