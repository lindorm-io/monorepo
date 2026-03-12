import { ProteusError } from "../../../../../errors/ProteusError";
import { computeDelay, withRetry } from "./with-retry";

class RetryableError extends Error {
  constructor(message = "retryable") {
    super(message);
  }
}

class NonRetryableError extends Error {
  constructor(message = "non-retryable") {
    super(message);
  }
}

const isRetryable = (error: unknown): boolean => error instanceof RetryableError;

describe("withRetry", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("should return result on first success", async () => {
    const fn = jest.fn().mockResolvedValue("ok");

    const result = await withRetry(fn, isRetryable);

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable error and succeed", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new RetryableError())
      .mockRejectedValueOnce(new RetryableError())
      .mockResolvedValue("recovered");

    const result = await withRetry(fn, isRetryable, {
      initialDelayMs: 1,
      jitter: false,
    });

    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw immediately on non-retryable error", async () => {
    const fn = jest.fn().mockRejectedValue(new NonRetryableError("fatal"));

    await expect(withRetry(fn, isRetryable)).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should throw after exhausting max retries", async () => {
    const fn = jest.fn().mockRejectedValue(new RetryableError("still failing"));

    await expect(
      withRetry(fn, isRetryable, { maxRetries: 2, initialDelayMs: 1, jitter: false }),
    ).rejects.toThrow("still failing");

    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("should respect maxRetries: 0 (no retries)", async () => {
    const fn = jest.fn().mockRejectedValue(new RetryableError());

    await expect(withRetry(fn, isRetryable, { maxRetries: 0 })).rejects.toThrow(
      "retryable",
    );

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should use exponential backoff delays", async () => {
    jest.useFakeTimers();

    const fn = jest
      .fn()
      .mockRejectedValueOnce(new RetryableError())
      .mockRejectedValueOnce(new RetryableError())
      .mockRejectedValueOnce(new RetryableError())
      .mockResolvedValue("ok");

    const promise = withRetry(fn, isRetryable, {
      maxRetries: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
      jitter: false,
    });

    // Advance through each retry delay
    await jest.advanceTimersByTimeAsync(100); // attempt 0 delay: 100
    await jest.advanceTimersByTimeAsync(200); // attempt 1 delay: 200
    await jest.advanceTimersByTimeAsync(400); // attempt 2 delay: 400

    const result = await promise;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("should cap delay at maxDelayMs", () => {
    // attempt 10 with multiplier 2: 50 * 2^10 = 51200, capped at 5000
    const delay = computeDelay(10, 50, 5000, 2, false);
    expect(delay).toBe(5000);
  });

  it("should apply jitter when enabled", () => {
    const delays = new Set<number>();
    for (let i = 0; i < 20; i++) {
      delays.add(computeDelay(0, 100, 5000, 2, true));
    }
    // With jitter, we should see variation (range: 50–100)
    expect(delays.size).toBeGreaterThan(1);
  });

  it("should not apply jitter when disabled", () => {
    const delays = new Set<number>();
    for (let i = 0; i < 10; i++) {
      delays.add(computeDelay(0, 100, 5000, 2, false));
    }
    expect(delays.size).toBe(1);
    expect(delays.has(100)).toBe(true);
  });

  it("should use default options when none provided", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new RetryableError())
      .mockResolvedValue("ok");

    const result = await withRetry(fn, isRetryable);

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should preserve the original error instance on final throw", async () => {
    const original = new RetryableError("specific");

    const fn = jest.fn().mockRejectedValue(original);

    try {
      await withRetry(fn, isRetryable, {
        maxRetries: 1,
        initialDelayMs: 1,
        jitter: false,
      });
      fail("should have thrown");
    } catch (error) {
      expect(error).toBe(original);
    }
  });

  it("should call onRetry callback on each retry", async () => {
    const onRetry = jest.fn();
    const error1 = new RetryableError("first");
    const error2 = new RetryableError("second");

    const fn = jest
      .fn()
      .mockRejectedValueOnce(error1)
      .mockRejectedValueOnce(error2)
      .mockResolvedValue("ok");

    await withRetry(fn, isRetryable, {
      initialDelayMs: 1,
      jitter: false,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, error1);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, error2);
  });

  it("should not call onRetry on final failure", async () => {
    const onRetry = jest.fn();
    const fn = jest.fn().mockRejectedValue(new RetryableError());

    await expect(
      withRetry(fn, isRetryable, {
        maxRetries: 1,
        initialDelayMs: 1,
        jitter: false,
        onRetry,
      }),
    ).rejects.toThrow("retryable");

    // onRetry called once (after attempt 0, before attempt 1), but NOT after final failure
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  describe("validation", () => {
    const fn = jest.fn().mockResolvedValue("ok");

    it("should throw on negative maxRetries", async () => {
      await expect(withRetry(fn, isRetryable, { maxRetries: -1 })).rejects.toThrow(
        "maxRetries must be >= 0",
      );
    });

    it("should throw on zero initialDelayMs", async () => {
      await expect(withRetry(fn, isRetryable, { initialDelayMs: 0 })).rejects.toThrow(
        "initialDelayMs must be > 0",
      );
    });

    it("should throw on negative initialDelayMs", async () => {
      await expect(withRetry(fn, isRetryable, { initialDelayMs: -10 })).rejects.toThrow(
        "initialDelayMs must be > 0",
      );
    });

    it("should throw on zero maxDelayMs", async () => {
      await expect(withRetry(fn, isRetryable, { maxDelayMs: 0 })).rejects.toThrow(
        "maxDelayMs must be > 0",
      );
    });

    it("should throw on zero backoffMultiplier", async () => {
      await expect(withRetry(fn, isRetryable, { backoffMultiplier: 0 })).rejects.toThrow(
        "backoffMultiplier must be > 0",
      );
    });

    // P1-H: validation errors must be ProteusError instances, not bare Error
    it("should throw a ProteusError instance for invalid maxRetries", async () => {
      const thrown = await withRetry(fn, isRetryable, { maxRetries: -1 }).catch(
        (e: unknown) => e,
      );
      expect(thrown).toBeInstanceOf(ProteusError);
    });

    it("should throw a ProteusError instance for invalid initialDelayMs", async () => {
      const thrown = await withRetry(fn, isRetryable, { initialDelayMs: 0 }).catch(
        (e: unknown) => e,
      );
      expect(thrown).toBeInstanceOf(ProteusError);
    });

    it("should throw a ProteusError instance for invalid maxDelayMs", async () => {
      const thrown = await withRetry(fn, isRetryable, { maxDelayMs: 0 }).catch(
        (e: unknown) => e,
      );
      expect(thrown).toBeInstanceOf(ProteusError);
    });

    it("should throw a ProteusError instance for invalid backoffMultiplier", async () => {
      const thrown = await withRetry(fn, isRetryable, { backoffMultiplier: 0 }).catch(
        (e: unknown) => e,
      );
      expect(thrown).toBeInstanceOf(ProteusError);
    });
  });
});
