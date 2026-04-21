import { Priority } from "./Priority.js";
import { describe, expect, it } from "vitest";

describe("Priority", () => {
  it("should stage priority metadata", () => {
    @Priority(5)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.priority).toBe(5);
  });

  it("should stage priority zero", () => {
    @Priority(0)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.priority).toBe(0);
  });

  it("should accept priority 10", () => {
    @Priority(10)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.priority).toBe(10);
  });

  it("should throw for non-integer priority", () => {
    expect(() => {
      @Priority(1.5)
      class TestMsg {}
    }).toThrow("@Priority value must be an integer between 0 and 10");
  });

  it("should throw for negative priority", () => {
    expect(() => {
      @Priority(-1)
      class TestMsg {}
    }).toThrow("@Priority value must be an integer between 0 and 10");
  });

  it("should throw for priority greater than 10", () => {
    expect(() => {
      @Priority(11)
      class TestMsg {}
    }).toThrow("@Priority value must be an integer between 0 and 10");
  });
});
