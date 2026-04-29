import { IrisError } from "./IrisError.js";
import { IrisTransportError } from "./IrisTransportError.js";
import { describe, expect, it } from "vitest";

describe("IrisTransportError", () => {
  it("should be an instance of IrisError", () => {
    const error = new IrisTransportError("test");
    expect(error).toBeInstanceOf(IrisError);
    expect(error).toBeInstanceOf(IrisTransportError);
    expect(error.message).toBe("test");
  });
});
