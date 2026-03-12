import { Scanner } from "@lindorm/scanner";

// tsx/cjs/api require is incompatible with Jest's module sandbox.
// Mock Scanner.prototype.import to use native require for .js test fixtures.
export const mockScannerImport = (): void => {
  jest.spyOn(Scanner.prototype, "import").mockImplementation(async function <T>(
    this: Scanner,
    fileOrPath: any,
  ): Promise<T> {
    const filePath = typeof fileOrPath === "string" ? fileOrPath : fileOrPath.fullPath;
    return require(filePath) as T;
  });
};
