import { IrisError } from "./IrisError.js";
import { IrisScannerError } from "./IrisScannerError.js";
import { describe, expect, it } from "vitest";

describe("IrisScannerError", () => {
  it("should be an instance of IrisError", () => {
    const error = new IrisScannerError("test");
    expect(error).toBeInstanceOf(IrisError);
    expect(error).toBeInstanceOf(IrisScannerError);
    expect(error.message).toBe("test");
  });
});
