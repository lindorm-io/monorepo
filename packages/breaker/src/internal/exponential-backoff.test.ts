import { calculateBackoff, type BackoffConfig } from "./exponential-backoff";

describe("calculateBackoff", () => {
  const config: BackoffConfig = {
    baseDelay: 1000,
    multiplier: 2,
    maxDelay: 30000,
  };

  it("should return baseDelay when attempts is 0", () => {
    expect(calculateBackoff(config, 0)).toBe(1000);
  });

  it("should return baseDelay * multiplier when attempts is 1", () => {
    expect(calculateBackoff(config, 1)).toBe(2000);
  });

  it("should return baseDelay * multiplier^attempts for higher attempts", () => {
    expect(calculateBackoff(config, 2)).toBe(4000);
    expect(calculateBackoff(config, 3)).toBe(8000);
    expect(calculateBackoff(config, 4)).toBe(16000);
  });

  it("should cap at maxDelay", () => {
    expect(calculateBackoff(config, 5)).toBe(30000);
  });

  it("should return maxDelay when calculated delay would far exceed it", () => {
    expect(calculateBackoff(config, 100)).toBe(30000);
  });
});
