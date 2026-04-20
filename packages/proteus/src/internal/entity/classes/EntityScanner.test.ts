import { EntityScanner } from "./EntityScanner";
import { EntityScannerError } from "../errors/EntityScannerError";
import type { IScanData } from "@lindorm/scanner";

// ─── Mock @lindorm/scanner ────────────────────────────────────────────────────

// We keep the mock scanner instance stable across tests so we can control
// its return values per-test. jest.resetAllMocks() only resets mock *functions*,
// not the factory implementation, so we re-install the mock in beforeEach.

const mockScan = jest.fn();
const mockImport = jest.fn();
const mockScannerInstance = { scan: mockScan, import: mockImport };

jest.mock("@lindorm/scanner", () => ({
  Scanner: jest.fn(() => mockScannerInstance),
}));

import { Scanner } from "@lindorm/scanner";
const MockScanner = Scanner as unknown as jest.Mock;

// ─── Fixture constructors ─────────────────────────────────────────────────────

class EntityA {
  id!: string;
}
class EntityB {
  id!: string;
}

const makeScanData = (overrides: Partial<IScanData> = {}): IScanData => ({
  baseName: "MyEntity",
  basePath: "/some/path",
  children: [],
  extension: ".ts",
  fullName: "MyEntity.ts",
  fullPath: "/some/path/MyEntity.ts",
  isDirectory: false,
  isFile: true,
  parents: [],
  relativePath: "MyEntity.ts",
  types: [],
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("EntityScanner.scan", () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockImport.mockReset();
    MockScanner.mockClear();
  });

  // ─── Constructor input (no strings) ─────────────────────────────────

  describe("constructor input (no strings)", () => {
    test("returns constructor elements directly from input array", async () => {
      const result = await EntityScanner.scan([EntityA, EntityB]);
      expect(result).toMatchSnapshot();
      expect(result).toContain(EntityA);
      expect(result).toContain(EntityB);
    });

    test("returns empty array for empty input", async () => {
      const result = await EntityScanner.scan([]);
      expect(result).toMatchSnapshot();
    });

    test("filters out plain objects from input", async () => {
      const plainObj = { id: "not-a-class" } as any;
      const result = await EntityScanner.scan([EntityA, plainObj]);
      expect(result).toContain(EntityA);
      expect(result).not.toContain(plainObj);
    });

    test("does not invoke scanner when input contains only constructors", async () => {
      await EntityScanner.scan([EntityA]);
      expect(mockScan).not.toHaveBeenCalled();
    });
  });

  // ─── String path — file ───────────────────────────────────────────────

  describe("string path input — file", () => {
    test("calls scanner.scan for string path", async () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({ EntityA });

      await EntityScanner.scan(["/some/path/EntityA.ts"]);

      expect(mockScan).toHaveBeenCalledWith("/some/path/EntityA.ts");
    });

    test("returns entities discovered in a file", async () => {
      const fileScanData = makeScanData({
        isFile: true,
        isDirectory: false,
        fullPath: "/path/EntityA.ts",
      });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({ EntityA });

      const result = await EntityScanner.scan(["/path/EntityA.ts"]);

      expect(result).toContain(EntityA);
    });

    test("returns multiple entities from a single file", async () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({ EntityA, EntityB });

      const result = await EntityScanner.scan(["/path/entities.ts"]);

      expect(result).toContain(EntityA);
      expect(result).toContain(EntityB);
    });

    test("skips values without a prototype (non-class exports)", async () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      const helper = () => {};
      mockImport.mockResolvedValue({ EntityA, helper });

      const result = await EntityScanner.scan(["/path/file.ts"]);

      expect(result).toContain(EntityA);
      expect(result).not.toContain(helper);
    });

    test("throws EntityScannerError when file module exports nothing", async () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({});

      await expect(EntityScanner.scan(["/path/empty.ts"])).rejects.toThrow(
        EntityScannerError,
      );
    });

    test("throws EntityScannerError when file module has no class exports", async () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      // Arrow functions have no .prototype
      mockImport.mockResolvedValue({ helper: () => "nope", CONSTANT: 42 });

      await expect(EntityScanner.scan(["/path/no-class.ts"])).rejects.toThrow(
        EntityScannerError,
      );
    });

    test("error message includes file path when no entities found", async () => {
      const fileScanData = makeScanData({
        isFile: true,
        isDirectory: false,
        fullPath: "/my/path/empty.ts",
      });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({});

      await expect(EntityScanner.scan(["/my/path/empty.ts"])).rejects.toThrow(
        /No entities found in file: \/my\/path\/empty\.ts/,
      );
    });

    test("merges constructor input with file-scanned entities", async () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({ EntityB });

      const result = await EntityScanner.scan([EntityA, "/path/EntityB.ts"]);

      expect(result).toContain(EntityA);
      expect(result).toContain(EntityB);
    });
  });

  // ─── String path — directory ──────────────────────────────────────────

  describe("string path input — directory", () => {
    test("recursively discovers entities inside a directory", async () => {
      const fileData = makeScanData({
        isFile: true,
        isDirectory: false,
        fullPath: "/dir/EntityA.ts",
      });
      const dirData = makeScanData({
        isFile: false,
        isDirectory: true,
        children: [fileData],
        fullPath: "/dir",
      });
      mockScan.mockReturnValue(dirData);
      mockImport.mockResolvedValue({ EntityA });

      const result = await EntityScanner.scan(["/dir"]);

      expect(result).toContain(EntityA);
    });

    test("recursively discovers entities in nested subdirectories", async () => {
      const deepFile = makeScanData({
        isFile: true,
        isDirectory: false,
        fullPath: "/dir/sub/EntityB.ts",
      });
      const subDir = makeScanData({
        isFile: false,
        isDirectory: true,
        children: [deepFile],
        fullPath: "/dir/sub",
      });
      const rootDir = makeScanData({
        isFile: false,
        isDirectory: true,
        children: [subDir],
        fullPath: "/dir",
      });
      mockScan.mockReturnValue(rootDir);
      mockImport.mockResolvedValue({ EntityB });

      const result = await EntityScanner.scan(["/dir"]);

      expect(result).toContain(EntityB);
    });

    test("discovers entities from both files and subdirectories in same dir", async () => {
      const fileDataA = makeScanData({
        isFile: true,
        isDirectory: false,
        fullPath: "/dir/EntityA.ts",
      });
      const subFile = makeScanData({
        isFile: true,
        isDirectory: false,
        fullPath: "/dir/sub/EntityB.ts",
      });
      const subDir = makeScanData({
        isFile: false,
        isDirectory: true,
        children: [subFile],
        fullPath: "/dir/sub",
      });
      const rootDir = makeScanData({
        isFile: false,
        isDirectory: true,
        children: [fileDataA, subDir],
        fullPath: "/dir",
      });
      mockScan.mockReturnValue(rootDir);
      mockImport.mockResolvedValueOnce({ EntityA }).mockReturnValueOnce({ EntityB });

      const result = await EntityScanner.scan(["/dir"]);

      expect(result).toContain(EntityA);
      expect(result).toContain(EntityB);
    });

    test("returns empty array for empty directory", async () => {
      const dirData = makeScanData({
        isFile: false,
        isDirectory: true,
        children: [],
        fullPath: "/empty-dir",
      });
      mockScan.mockReturnValue(dirData);

      const result = await EntityScanner.scan(["/empty-dir"]);

      expect(result).toMatchSnapshot();
      expect(result).toHaveLength(0);
    });
  });

  // ─── Scanner instantiation ─────────────────────────────────────────────

  describe("Scanner construction", () => {
    test("creates a new Scanner instance per scan() invocation with string path", async () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({ EntityA });

      await EntityScanner.scan(["/path/file.ts"]);

      expect(MockScanner).toHaveBeenCalledWith(
        expect.objectContaining({
          deniedFilenames: expect.any(Array),
          deniedTypes: expect.any(Array),
        }),
      );
    });

    test("Scanner is constructed with denied filenames and types", async () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({ EntityA });

      await EntityScanner.scan(["/path/file.ts"]);

      const constructorCall = MockScanner.mock.calls[0][0];
      expect(constructorCall.deniedFilenames).toMatchSnapshot();
      expect(constructorCall.deniedTypes).toMatchSnapshot();
    });
  });
});
