import { LindormError } from "@lindorm/errors";
import { BreakerError } from "./BreakerError.js";
import { CircuitOpenError } from "./CircuitOpenError.js";
import { describe, expect, it } from "vitest";

describe("CircuitOpenError", () => {
  const error = new CircuitOpenError("circuit is open");

  it("should be an instance of Error", () => {
    expect(error).toBeInstanceOf(Error);
  });

  it("should be an instance of LindormError", () => {
    expect(error).toBeInstanceOf(LindormError);
  });

  it("should be an instance of BreakerError", () => {
    expect(error).toBeInstanceOf(BreakerError);
  });

  it("should set message correctly", () => {
    expect(error.message).toBe("circuit is open");
  });
});
