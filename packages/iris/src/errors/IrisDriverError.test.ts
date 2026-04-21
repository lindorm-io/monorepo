import { IrisError } from "./IrisError";
import { IrisDriverError } from "./IrisDriverError";
import { describe, expect, it } from "vitest";

describe("IrisDriverError", () => {
  it("should be an instance of IrisError", () => {
    const error = new IrisDriverError("test");
    expect(error).toBeInstanceOf(IrisError);
    expect(error).toBeInstanceOf(IrisDriverError);
    expect(error.message).toBe("test");
  });
});
