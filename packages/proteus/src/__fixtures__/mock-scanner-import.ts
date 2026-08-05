import { isString } from "@lindorm/is";
import { vi } from "vitest";
import { Scanner } from "@lindorm/scanner";

// tsx/cjs/api require is incompatible with Jest's module sandbox.
// Mock Scanner.prototype.import to use native require for .js test fixtures.
export const mockScannerImport = (): void => {
  vi.spyOn(Scanner.prototype, "import").mockImplementation(async function <T>(
    this: Scanner,
    fileOrPath: any,
  ): Promise<T> {
    const filePath = isString(fileOrPath) ? fileOrPath : fileOrPath.fullPath;
    return require(filePath) as T;
  });
};
