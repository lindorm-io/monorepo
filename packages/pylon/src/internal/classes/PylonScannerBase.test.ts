import { createMockLogger } from "@lindorm/logger/mocks/jest";
import { PylonScannerBase, ParsedSegment, ScannedFile } from "./PylonScannerBase";

class TestScanner extends PylonScannerBase {
  public constructor() {
    super(createMockLogger());
  }

  public testParseSegment(name: string): ParsedSegment {
    return this.parseSegment(name);
  }

  public testGetBaseName(scan: any): string {
    return this.getBaseName(scan);
  }

  public testIsMiddlewareFile(scan: any): boolean {
    return this.isMiddlewareFile(scan);
  }

  public testLoadMiddleware(scan: any): Promise<Array<unknown>> {
    return this.loadMiddleware(scan);
  }

  public testScanDirectory(directory: string): Promise<Array<ScannedFile>> {
    return this.scanDirectory(directory);
  }
}

describe("PylonScannerBase", () => {
  const scanner = new TestScanner();

  describe("parseSegment", () => {
    test("should parse a plain segment", () => {
      expect(scanner.testParseSegment("users")).toMatchSnapshot();
    });

    test("should parse a parameter segment [id]", () => {
      expect(scanner.testParseSegment("[id]")).toMatchSnapshot();
    });

    test("should parse a parameter segment [userId]", () => {
      expect(scanner.testParseSegment("[userId]")).toMatchSnapshot();
    });

    test("should parse a catch-all segment [...path]", () => {
      expect(scanner.testParseSegment("[...path]")).toMatchSnapshot();
    });

    test("should parse an optional catch-all segment [[...slug]]", () => {
      expect(scanner.testParseSegment("[[...slug]]")).toMatchSnapshot();
    });

    test("should parse a group segment (admin)", () => {
      expect(scanner.testParseSegment("(admin)")).toMatchSnapshot();
    });

    test("should parse a group segment (auth)", () => {
      expect(scanner.testParseSegment("(auth)")).toMatchSnapshot();
    });

    test("should handle plain segment with hyphens", () => {
      expect(scanner.testParseSegment("my-route")).toMatchSnapshot();
    });

    test("should parse index as plain segment", () => {
      const result = scanner.testParseSegment("index");
      expect(result.isParam).toBe(false);
      expect(result.isGroup).toBe(false);
      expect(result.isCatchAll).toBe(false);
      expect(result.path).toBe("index");
    });

    test("should parse empty string as plain segment", () => {
      const result = scanner.testParseSegment("");
      expect(result.path).toBe("");
      expect(result.isParam).toBe(false);
    });

    describe("parameter segments", () => {
      test("should set isParam to true", () => {
        const result = scanner.testParseSegment("[id]");
        expect(result.isParam).toBe(true);
      });

      test("should extract paramName", () => {
        const result = scanner.testParseSegment("[id]");
        expect(result.paramName).toBe("id");
      });

      test("should format path with colon prefix", () => {
        const result = scanner.testParseSegment("[id]");
        expect(result.path).toBe(":id");
      });
    });

    describe("catch-all segments", () => {
      test("should set isCatchAll to true", () => {
        const result = scanner.testParseSegment("[...path]");
        expect(result.isCatchAll).toBe(true);
        expect(result.isParam).toBe(false);
      });

      test("should extract paramName", () => {
        const result = scanner.testParseSegment("[...path]");
        expect(result.paramName).toBe("path");
      });

      test("should format path with wildcard syntax", () => {
        const result = scanner.testParseSegment("[...path]");
        expect(result.path).toBe("{*path}");
      });
    });

    describe("optional catch-all segments", () => {
      test("should set isOptionalCatchAll to true", () => {
        const result = scanner.testParseSegment("[[...slug]]");
        expect(result.isOptionalCatchAll).toBe(true);
        expect(result.isCatchAll).toBe(false);
        expect(result.isParam).toBe(false);
      });

      test("should extract paramName", () => {
        const result = scanner.testParseSegment("[[...slug]]");
        expect(result.paramName).toBe("slug");
      });

      test("should format path with wildcard syntax", () => {
        const result = scanner.testParseSegment("[[...slug]]");
        expect(result.path).toBe("{*slug}");
      });
    });

    describe("group segments", () => {
      test("should set isGroup to true", () => {
        const result = scanner.testParseSegment("(admin)");
        expect(result.isGroup).toBe(true);
      });

      test("should have empty path", () => {
        const result = scanner.testParseSegment("(admin)");
        expect(result.path).toBe("");
      });

      test("should have null paramName", () => {
        const result = scanner.testParseSegment("(admin)");
        expect(result.paramName).toBeNull();
      });
    });
  });

  describe("getBaseName", () => {
    test("should strip file extension", () => {
      expect(scanner.testGetBaseName({ fullName: "index.ts" })).toBe("index");
    });

    test("should strip only the last extension", () => {
      expect(scanner.testGetBaseName({ fullName: "file.test.ts" })).toBe("file.test");
    });

    test("should handle names without extension", () => {
      expect(scanner.testGetBaseName({ fullName: "noext" })).toBe("noext");
    });

    test("should handle dotfiles", () => {
      // The regex replaces everything after the last dot, so .gitignore becomes empty
      expect(scanner.testGetBaseName({ fullName: ".gitignore" })).toBe("");
    });
  });

  describe("isMiddlewareFile", () => {
    test("should return true for _middleware.ts", () => {
      expect(
        scanner.testIsMiddlewareFile({ isFile: true, fullName: "_middleware.ts" }),
      ).toBe(true);
    });

    test("should return true for _middleware.js", () => {
      expect(
        scanner.testIsMiddlewareFile({ isFile: true, fullName: "_middleware.js" }),
      ).toBe(true);
    });

    test("should return false for non-middleware files", () => {
      expect(scanner.testIsMiddlewareFile({ isFile: true, fullName: "index.ts" })).toBe(
        false,
      );
    });

    test("should return false for directories", () => {
      expect(
        scanner.testIsMiddlewareFile({ isFile: false, fullName: "_middleware" }),
      ).toBe(false);
    });

    test("should return false for files with middleware in name but not exact match", () => {
      expect(
        scanner.testIsMiddlewareFile({ isFile: true, fullName: "my_middleware.ts" }),
      ).toBe(false);
    });
  });

  describe("loadMiddleware", () => {
    test("should return empty array when module has no MIDDLEWARE export", async () => {
      const mockScanner = new TestScanner();
      (mockScanner as any).scanner = {
        import: jest.fn().mockResolvedValue({ default: "something" }),
      };

      const result = await mockScanner.testLoadMiddleware({
        fullPath: "/path/to/file.ts",
      });

      expect(result).toEqual([]);
    });

    test("should return array when MIDDLEWARE is an array", async () => {
      const middlewareFns = [jest.fn(), jest.fn()];
      const mockScanner = new TestScanner();
      (mockScanner as any).scanner = {
        import: jest.fn().mockResolvedValue({ MIDDLEWARE: middlewareFns }),
      };

      const result = await mockScanner.testLoadMiddleware({
        fullPath: "/path/to/file.ts",
      });

      expect(result).toEqual(middlewareFns);
    });

    test("should wrap non-array MIDDLEWARE in array", async () => {
      const middlewareFn = jest.fn();
      const mockScanner = new TestScanner();
      (mockScanner as any).scanner = {
        import: jest.fn().mockResolvedValue({ MIDDLEWARE: middlewareFn }),
      };

      const result = await mockScanner.testLoadMiddleware({
        fullPath: "/path/to/file.ts",
      });

      expect(result).toEqual([middlewareFn]);
    });
  });

  describe("scanDirectory", () => {
    test("should throw PylonError when directory is empty", async () => {
      const mockScanner = new TestScanner();

      // Scanner.hasFiles is a static method — mock it
      const originalHasFiles = (mockScanner as any).scanner.constructor.hasFiles;
      jest
        .spyOn((mockScanner as any).scanner.constructor, "hasFiles")
        .mockReturnValue(false);

      await expect(mockScanner.testScanDirectory("/empty/dir")).rejects.toThrow(
        "Directory [ /empty/dir ] is empty",
      );

      // Restore
      (mockScanner as any).scanner.constructor.hasFiles = originalHasFiles;
    });
  });
});
