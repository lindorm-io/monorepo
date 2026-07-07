import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { join } from "path";
import { PylonError } from "../../errors/index.js";
import { PylonRouterScanner } from "./PylonRouterScanner.js";
import { describe, expect, test } from "vitest";

const logger = createMockLogger();

const fixture = (name: string): string =>
  join(__dirname, "..", "..", "__fixtures__", name);

const scanError = async (directory: string): Promise<PylonError> => {
  const scanner = new PylonRouterScanner(logger);
  try {
    await scanner.scan(directory);
  } catch (err) {
    return err as PylonError;
  }
  throw new Error("expected the scan to throw");
};

describe("PylonRouterScanner UPLOAD behaviour", () => {
  test("rejects a file exporting STATIC alongside UPLOAD", async () => {
    const err = await scanError(fixture("upload-routes-conflict-static"));

    expect(err).toBeInstanceOf(PylonError);
    expect(err.code).toBe("conflicting_static_export");
  });

  test("rejects a file exporting UPLOAD alongside an HTTP method", async () => {
    const err = await scanError(fixture("upload-routes-conflict-method"));

    expect(err).toBeInstanceOf(PylonError);
    expect(err.code).toBe("conflicting_upload_export");
  });
});
