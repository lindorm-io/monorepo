import { MessageScanner } from "./MessageScanner";
import { IrisScannerError } from "../errors/IrisScannerError";
import type { IScanData } from "@lindorm/scanner";

// TODO: add integration test with real fixture directory to validate end-to-end file scanning and pattern exclusion

// --- Mock @lindorm/scanner ----

const mockScan = jest.fn();
const mockRequire = jest.fn();
const mockScannerInstance = { scan: mockScan, require: mockRequire };

jest.mock("@lindorm/scanner", () => ({
  Scanner: jest.fn(() => mockScannerInstance),
}));

import { Scanner } from "@lindorm/scanner";
const MockScanner = Scanner as unknown as jest.Mock;

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
    mockRequire.mockReset();
    MockScanner.mockClear();
  });

  // --- Constructor input (no strings) ---

  describe("constructor input (no strings)", () => {
    test("returns constructor elements directly from input array", () => {
      const result = MessageScanner.scan([MessageA, MessageB]);
      expect(result).toMatchSnapshot();
      expect(result).toContain(MessageA);
      expect(result).toContain(MessageB);
    });

    test("returns empty array for empty input", () => {
      const result = MessageScanner.scan([]);
      expect(result).toMatchSnapshot();
    });

    test("filters out plain objects from input", () => {
      const plainObj = { id: "not-a-class" } as any;
      const result = MessageScanner.scan([MessageA, plainObj]);
      expect(result).toContain(MessageA);
      expect(result).not.toContain(plainObj);
    });

    test("does not invoke scanner when input contains only constructors", () => {
      MessageScanner.scan([MessageA]);
      expect(mockScan).not.toHaveBeenCalled();
    });
  });

  // --- String path - file ---

  describe("string path input - file", () => {
    test("calls scanner.scan for string path", () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockRequire.mockReturnValue({ MessageA });

      MessageScanner.scan(["/some/path/MessageA.ts"]);

      expect(mockScan).toHaveBeenCalledWith("/some/path/MessageA.ts");
    });

    test("returns messages discovered in a file", () => {
      const fileScanData = makeScanData({
        isFile: true,
        isDirectory: false,
        fullPath: "/path/MessageA.ts",
      });
      mockScan.mockReturnValue(fileScanData);
      mockRequire.mockReturnValue({ MessageA });

      const result = MessageScanner.scan(["/path/MessageA.ts"]);

      expect(result).toContain(MessageA);
    });

    test("returns multiple messages from a single file", () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockRequire.mockReturnValue({ MessageA, MessageB });

      const result = MessageScanner.scan(["/path/messages.ts"]);

      expect(result).toContain(MessageA);
      expect(result).toContain(MessageB);
    });

    test("skips values without a prototype (non-class exports)", () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      const helper = () => {};
      mockRequire.mockReturnValue({ MessageA, helper });

      const result = MessageScanner.scan(["/path/file.ts"]);

      expect(result).toContain(MessageA);
      expect(result).not.toContain(helper);
    });

    test("throws IrisScannerError when file module exports nothing", () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockRequire.mockReturnValue({});

      expect(() => MessageScanner.scan(["/path/empty.ts"])).toThrow(IrisScannerError);
    });

    test("throws IrisScannerError when file module has no class exports", () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockRequire.mockReturnValue({ helper: () => "nope", CONSTANT: 42 });

      expect(() => MessageScanner.scan(["/path/no-class.ts"])).toThrow(IrisScannerError);
    });

    test("error message includes file path when no messages found", () => {
      const fileScanData = makeScanData({
        isFile: true,
        isDirectory: false,
        fullPath: "/my/path/empty.ts",
      });
      mockScan.mockReturnValue(fileScanData);
      mockRequire.mockReturnValue({});

      expect(() => MessageScanner.scan(["/my/path/empty.ts"])).toThrow(
        /No messages found in file: \/my\/path\/empty\.ts/,
      );
    });

    test("merges constructor input with file-scanned messages", () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockRequire.mockReturnValue({ MessageB });

      const result = MessageScanner.scan([MessageA, "/path/MessageB.ts"]);

      expect(result).toContain(MessageA);
      expect(result).toContain(MessageB);
    });
  });

  // --- String path - directory ---

  describe("string path input - directory", () => {
    test("recursively discovers messages inside a directory", () => {
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
      mockRequire.mockReturnValue({ MessageA });

      const result = MessageScanner.scan(["/dir"]);

      expect(result).toContain(MessageA);
    });

    test("recursively discovers messages in nested subdirectories", () => {
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
      mockRequire.mockReturnValue({ MessageB });

      const result = MessageScanner.scan(["/dir"]);

      expect(result).toContain(MessageB);
    });

    test("discovers messages from both files and subdirectories in same dir", () => {
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
      mockRequire.mockReturnValueOnce({ MessageA }).mockReturnValueOnce({ MessageB });

      const result = MessageScanner.scan(["/dir"]);

      expect(result).toContain(MessageA);
      expect(result).toContain(MessageB);
    });

    test("returns empty array for empty directory", () => {
      const dirData = makeScanData({
        isFile: false,
        isDirectory: true,
        children: [],
        fullPath: "/empty-dir",
      });
      mockScan.mockReturnValue(dirData);

      const result = MessageScanner.scan(["/empty-dir"]);

      expect(result).toMatchSnapshot();
      expect(result).toHaveLength(0);
    });
  });

  // --- Scanner instantiation ---

  describe("Scanner construction", () => {
    test("creates a new Scanner instance per scan() invocation with string path", () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockRequire.mockReturnValue({ MessageA });

      MessageScanner.scan(["/path/file.ts"]);

      expect(MockScanner).toHaveBeenCalledWith(
        expect.objectContaining({
          deniedFilenames: expect.any(Array),
          deniedTypes: expect.any(Array),
        }),
      );
    });

    test("Scanner is constructed with denied filenames and types", () => {
      const fileScanData = makeScanData({ isFile: true, isDirectory: false });
      mockScan.mockReturnValue(fileScanData);
      mockRequire.mockReturnValue({ MessageA });

      MessageScanner.scan(["/path/file.ts"]);

      const constructorCall = MockScanner.mock.calls[0][0];
      expect(constructorCall.deniedFilenames).toMatchSnapshot();
      expect(constructorCall.deniedTypes).toMatchSnapshot();
    });
  });
});
