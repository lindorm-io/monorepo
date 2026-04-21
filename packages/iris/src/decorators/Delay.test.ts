import { Delay } from "./Delay";
import { describe, expect, it } from "vitest";

describe("Delay", () => {
  it("should stage delay metadata", () => {
    @Delay(5000)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.delay).toBe(5000);
  });

  it("should stage delay zero", () => {
    @Delay(0)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.delay).toBe(0);
  });

  it("should throw for non-integer delay", () => {
    expect(() => {
      @Delay(1.5)
      class TestMsg {}
    }).toThrow("@Delay value must be a non-negative integer");
  });

  it("should throw for negative delay", () => {
    expect(() => {
      @Delay(-1)
      class TestMsg {}
    }).toThrow("@Delay value must be a non-negative integer");
  });

  it("should throw for NaN", () => {
    expect(() => {
      @Delay(NaN)
      class TestMsg {}
    }).toThrow("@Delay value must be a non-negative integer");
  });

  it("should throw for Infinity", () => {
    expect(() => {
      @Delay(Infinity)
      class TestMsg {}
    }).toThrow("@Delay value must be a non-negative integer");
  });
});
