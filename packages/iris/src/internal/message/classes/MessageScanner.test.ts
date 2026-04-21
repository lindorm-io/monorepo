import { MessageScanner } from "./MessageScanner.js";
import { IrisScannerError } from "../errors/IrisScannerError.js";
import type { IScanData } from "@lindorm/scanner";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

// TODO: add integration test with real fixture directory to validate end-to-end file scanning and pattern exclusion

// --- Mock @lindorm/scanner ----

const mockScan = vi.fn();
const mockImport = vi.fn();
const mockScannerInstance = { scan: mockScan, import: mockImport };

vi.mock("@lindorm/scanner", async () => ({
  Scanner: vi.fn(function () {
    return mockScannerInstance;
  }),
}));

import { Scanner } from "@lindorm/scanner";
const MockScanner = Scanner as unknown as Mock;

// --- Fixture constructors ---

class MessageA {
  id!: string;
}
class MessageB {
  id!: string;
}

const makeScanData = (overrides: Partial<IScanData> = {}): IScanData => ({
  baseName: "MyMessage",
  basePath: "/some/path",
  children: [],
  extension: ".ts",
  fullName: "MyMessage.ts",
  fullPath: "/some/path/MyMessage.ts",
  isDirectory: false,
  isFile: true,
  parents: [],
  relativePath: "MyMessage.ts",
  types: [],
  ...overrides,
});

// --- Tests ---

describe("MessageScanner.scan", () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockImport.mockReset();
    MockScanner.mockClear();
  });

  // --- Constructor input (no strings) ---

  describe("constructor input (no strings)", () => {
    test("returns constructor elements directly from input array", async () => {
      const result = await MessageScanner.scan([MessageA, MessageB]);
      expect(result).toMatchSnapshot();
      expect(result).toContain(MessageA);
      expect(result).toContain(MessageB);
    });

    test("returns empty array for empty input", async () => {
      const result = await MessageScanner.scan([]);
      expect(result).toMatchSnapshot();
    });

    test("filters out plain objects from input", async () => {
      const plainObj = { id: "not-a-class" } as any;
      const result = await MessageScanner.scan([MessageA, plainObj]);
      expect(result).toContain(MessageA);
      expect(result).not.toContain(plainObj);
    });

    test("does not invoke scanner when input contains only constructors", async () => {
      await MessageScanner.scan([MessageA]);
      expect(mockScan).not.toHaveBeenCalled();
    });
  });

  // --- String path - file ---

  describe("string path input - file", () => {
    test("calls scanner.scan for string path", async () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({ MessageA });

      await MessageScanner.scan(["/some/path/MessageA.ts"]);

      expect(mockScan).toHaveBeenCalledWith("/some/path/MessageA.ts");
    });

    test("returns messages discovered in a file", async () => {
      const fileScanData = makeScanData({
        isFile: true,
        isDirectory: false,
        fullPath: "/path/MessageA.ts",
      });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({ MessageA });

      const result = await MessageScanner.scan(["/path/MessageA.ts"]);

      expect(result).toContain(MessageA);
    });

    test("returns multiple messages from a single file", async () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({ MessageA, MessageB });

      const result = await MessageScanner.scan(["/path/messages.ts"]);

      expect(result).toContain(MessageA);
      expect(result).toContain(MessageB);
    });

    test("skips values without a prototype (non-class exports)", async () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      const helper = () => {};
      mockImport.mockResolvedValue({ MessageA, helper });

      const result = await MessageScanner.scan(["/path/file.ts"]);

      expect(result).toContain(MessageA);
      expect(result).not.toContain(helper);
    });

    test("throws IrisScannerError when file module exports nothing", async () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({});

      await expect(MessageScanner.scan(["/path/empty.ts"])).rejects.toThrow(
        IrisScannerError,
      );
    });

    test("throws IrisScannerError when file module has no class exports", async () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({ helper: () => "nope", CONSTANT: 42 });

      await expect(MessageScanner.scan(["/path/no-class.ts"])).rejects.toThrow(
        IrisScannerError,
      );
    });

    test("error message includes file path when no messages found", async () => {
      const fileScanData = makeScanData({
        isFile: true,
        isDirectory: false,
        fullPath: "/my/path/empty.ts",
      });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({});

      await expect(MessageScanner.scan(["/my/path/empty.ts"])).rejects.toThrow(
        /No messages found in file: \/my\/path\/empty\.ts/,
      );
    });

    test("merges constructor input with file-scanned messages", async () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({ MessageB });

      const result = await MessageScanner.scan([MessageA, "/path/MessageB.ts"]);

      expect(result).toContain(MessageA);
      expect(result).toContain(MessageB);
    });
  });

  // --- String path - directory ---

  describe("string path input - directory", () => {
    test("recursively discovers messages inside a directory", async () => {
      const fileData = makeScanData({
        isFile: true,
        isDirectory: false,
        fullPath: "/dir/MessageA.ts",
      });
      const dirData = makeScanData({
        isFile: false,
        isDirectory: true,
        children: [fileData],
        fullPath: "/dir",
      });
      mockScan.mockReturnValue(dirData);
      mockImport.mockResolvedValue({ MessageA });

      const result = await MessageScanner.scan(["/dir"]);

      expect(result).toContain(MessageA);
    });

    test("recursively discovers messages in nested subdirectories", async () => {
      const deepFile = makeScanData({
        isFile: true,
        isDirectory: false,
        fullPath: "/dir/sub/MessageB.ts",
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
      mockImport.mockResolvedValue({ MessageB });

      const result = await MessageScanner.scan(["/dir"]);

      expect(result).toContain(MessageB);
    });

    test("discovers messages from both files and subdirectories in same dir", async () => {
      const fileDataA = makeScanData({
        isFile: true,
        isDirectory: false,
        fullPath: "/dir/MessageA.ts",
      });
      const subFile = makeScanData({
        isFile: true,
        isDirectory: false,
        fullPath: "/dir/sub/MessageB.ts",
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
      mockImport.mockResolvedValueOnce({ MessageA }).mockReturnValueOnce({ MessageB });

      const result = await MessageScanner.scan(["/dir"]);

      expect(result).toContain(MessageA);
      expect(result).toContain(MessageB);
    });

    test("returns empty array for empty directory", async () => {
      const dirData = makeScanData({
        isFile: false,
        isDirectory: true,
        children: [],
        fullPath: "/empty-dir",
      });
      mockScan.mockReturnValue(dirData);

      const result = await MessageScanner.scan(["/empty-dir"]);

      expect(result).toMatchSnapshot();
      expect(result).toHaveLength(0);
    });
  });

  // --- Scanner instantiation ---

  describe("Scanner construction", () => {
    test("creates a new Scanner instance per scan() invocation with string path", async () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockImport.mockResolvedValue({ MessageA });

      await MessageScanner.scan(["/path/file.ts"]);

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
      mockImport.mockResolvedValue({ MessageA });

      await MessageScanner.scan(["/path/file.ts"]);

      const constructorCall = MockScanner.mock.calls[0][0];
      expect(constructorCall.deniedFilenames).toMatchSnapshot();
      expect(constructorCall.deniedTypes).toMatchSnapshot();
    });
  });
});
