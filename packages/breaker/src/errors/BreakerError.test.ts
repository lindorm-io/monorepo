import { LindormError } from "@lindorm/errors";
import { BreakerError } from "./BreakerError.js";
import { describe, expect, it } from "vitest";

describe("BreakerError", () => {
  const error = new BreakerError("test message");

  it("should be an instance of Error", () => {
    expect(error).toBeInstanceOf(Error);
  });

  it("should be an instance of LindormError", () => {
    expect(error).toBeInstanceOf(LindormError);
  });

  it("should set message correctly", () => {
    expect(error.message).toBe("test message");
  });
});
