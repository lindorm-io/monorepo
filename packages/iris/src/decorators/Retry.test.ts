import { Retry } from "./Retry.js";
import { describe, expect, it } from "vitest";

describe("Retry", () => {
  it("should stage retry metadata with defaults", () => {
    @Retry()
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.retry).toMatchSnapshot();
  });

  it("should stage retry metadata with custom options", () => {
    @Retry({ maxRetries: 5, strategy: "exponential", delay: 2000 })
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.retry).toMatchSnapshot();
  });

  it("should allow partial override", () => {
    @Retry({ maxRetries: 10 })
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.retry).toMatchSnapshot();
  });

  it("should stage retry metadata with all options", () => {
    @Retry({
      maxRetries: 5,
      strategy: "linear",
      delay: 500,
      delayMax: 10000,
      multiplier: 3,
      jitter: true,
    })
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.retry).toMatchSnapshot();
  });
});
