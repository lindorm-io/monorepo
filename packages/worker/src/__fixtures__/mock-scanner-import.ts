import { vi } from "vitest";
import { Scanner } from "@lindorm/scanner";

// Scanner's production import path uses `new Function("return import(s)")` to bind
// to the current vm realm. That escapes vitest's module transform, so Node's raw
// ESM resolver chokes on .ts fixture files. Route Scanner.import through the
// current test file's import() which IS vitest-transformed.
export const mockScannerImport = (): void => {
  vi.spyOn(Scanner.prototype, "import").mockImplementation(async function <T>(
    this: Scanner,
    fileOrPath: any,
  ): Promise<T> {
    const filePath = typeof fileOrPath === "string" ? fileOrPath : fileOrPath.fullPath;
    return (await import(/* @vite-ignore */ filePath)) as T;
  });
};
