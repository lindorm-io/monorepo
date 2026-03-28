import { withRetry } from "./with-retry";

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
});
