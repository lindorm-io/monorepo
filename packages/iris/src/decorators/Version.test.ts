import { Version } from "./Version";
import { describe, expect, it } from "vitest";

describe("Version", () => {
  it("should stage version metadata", () => {
    @Version(1)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.version).toBe(1);
  });

  it("should accept large version numbers", () => {
    @Version(42)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.version).toBe(42);
  });

  it("should throw for non-integer version", () => {
    expect(() => {
      @Version(1.5)
      class TestMsg {}
    }).toThrow("@Version value must be a positive integer");
  });

  it("should throw for zero version", () => {
    expect(() => {
      @Version(0)
      class TestMsg {}
    }).toThrow("@Version value must be a positive integer");
  });

  it("should throw for negative version", () => {
    expect(() => {
      @Version(-1)
      class TestMsg {}
    }).toThrow("@Version value must be a positive integer");
  });
});
