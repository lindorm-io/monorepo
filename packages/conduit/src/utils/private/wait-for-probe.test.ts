import { ConduitCircuitBreakerCache } from "../../types";
import { waitForProbe } from "../../utils/private";

describe("waitForProbe", () => {
  let cache: ConduitCircuitBreakerCache;
  const origin = "https://api.test";

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new Map();
  });

  afterEach(jest.useRealTimers);

  test("resolves immediately if no breaker exists", async () => {
    const promise = waitForProbe(cache, origin);

    jest.advanceTimersByTime(25);

    await expect(promise).resolves.toBeUndefined();
  });

  test("resolves when breaker stops probing", async () => {
    cache.set(origin, {
      origin,
      state: "open",
      errors: [],
      timestamp: Date.now(),
      isProbing: true,
    });

    const promise = waitForProbe(cache, origin);

    setTimeout(() => {
      cache.set(origin, {
        origin,
        state: "open",
        errors: [],
        timestamp: Date.now(),
        isProbing: false,
      });
    }, 100);

    jest.advanceTimersByTime(100);

    await Promise.resolve();

    jest.advanceTimersByTime(25);

    await expect(promise).resolves.toBeUndefined();
  });

  test("rejects after timeout when still probing", async () => {
    cache.set(origin, {
      origin,
      state: "open",
      errors: [],
      timestamp: Date.now(),
      isProbing: true,
    });

    const promise = waitForProbe(cache, origin);

    jest.advanceTimersByTime(3000);

    await expect(promise).rejects.toThrow("Circuit breaker is half-open");
  });
});
