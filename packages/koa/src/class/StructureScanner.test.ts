import { StructureScanner } from "./StructureScanner";

describe("StructureScanner", () => {
  const scanner = new StructureScanner(__dirname, {
    includeExtensions: [".js", ".ts"],
    excludeExtensions: [".spec.ts", ".test.ts"],
    omitFileNamesFromRoute: ["index"],
  });

  test("should scan directory", () => {
    expect(scanner.scan()).toStrictEqual([
      {
        name: "IntervalWorker",
        parents: [],
        path: expect.stringContaining("/src/class/IntervalWorker.ts"),
        relative: "IntervalWorker.ts",
      },
      {
        name: "KoaApp",
        parents: [],
        path: expect.stringContaining("/src/class/KoaApp.ts"),
        relative: "KoaApp.ts",
      },
      {
        name: "Metric",
        parents: [],
        path: expect.stringContaining("/src/class/Metric.ts"),
        relative: "Metric.ts",
      },
      {
        name: "StructureScanner",
        parents: [],
        path: expect.stringContaining("/src/class/StructureScanner.ts"),
        relative: "StructureScanner.ts",
      },
      {
        name: "index",
        parents: [],
        path: expect.stringContaining("/src/class/index.ts"),
        relative: "index.ts",
      },
    ]);
  });

  test("should resolve that directory has items", () => {
    expect(StructureScanner.hasItems(__dirname)).toBe(true);
  });

  test("should resolve route names", () => {
    expect(scanner.scan().map((item) => scanner.getRoute(item))).toStrictEqual([
      "/IntervalWorker",
      "/KoaApp",
      "/Metric",
      "/StructureScanner",
      "/",
    ]);
  });

  test("should rename specific routes", () => {
    const scanner = new StructureScanner(__dirname, {
      includeExtensions: [".js", ".ts"],
      excludeExtensions: [".spec.ts", ".test.ts"],
      omitFileNamesFromRoute: ["index"],
      renameRoutes: {
        "/KoaApp": "/koa-app",
        "/IntervalWorker": "/interval-worker",
      },
    });

    expect(scanner.scan().map((item) => scanner.getRoute(item))).toStrictEqual(
      expect.arrayContaining(["/interval-worker", "/koa-app"]),
    );
  });
});
