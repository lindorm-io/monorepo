import { Expiry } from "./Expiry";

describe("Expiry", () => {
  it("should stage expiry metadata", () => {
    @Expiry(30000)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.expiry).toBe(30000);
  });

  it("should accept zero", () => {
    @Expiry(0)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.expiry).toBe(0);
  });

  it("should throw for non-integer expiry", () => {
    expect(() => {
      @Expiry(1.5)
      class TestMsg {}
    }).toThrow("@Expiry value must be a non-negative integer");
  });

  it("should throw for negative expiry", () => {
    expect(() => {
      @Expiry(-1)
      class TestMsg {}
    }).toThrow("@Expiry value must be a non-negative integer");
  });

  it("should throw for NaN", () => {
    expect(() => {
      @Expiry(NaN)
      class TestMsg {}
    }).toThrow("@Expiry value must be a non-negative integer");
  });

  it("should throw for Infinity", () => {
    expect(() => {
      @Expiry(Infinity)
      class TestMsg {}
    }).toThrow("@Expiry value must be a non-negative integer");
  });
});
