import { withRetry } from "./with-retry";

describe("withRetry", () => {
  test("should return result on first success", async () => {
    const fn = jest.fn().mockResolvedValue("ok");

    const result = await withRetry(fn);

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("should retry on failure and succeed", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { delay: 1, jitter: false });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("should throw after maxAttempts exhausted", async () => {
    const error = new Error("persistent failure");
    const fn = jest.fn().mockRejectedValue(error);

    await expect(
      withRetry(fn, { maxAttempts: 3, delay: 1, jitter: false }),
    ).rejects.toThrow("persistent failure");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test("should throw immediately when isRetryable returns false", async () => {
    const error = new Error("not retryable");
    const fn = jest.fn().mockRejectedValue(error);

    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        delay: 1,
        jitter: false,
        isRetryable: () => false,
      }),
    ).rejects.toThrow("not retryable");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("should call onRetry callback with attempt and error", async () => {
    const error1 = new Error("fail1");
    const error2 = new Error("fail2");
    const fn = jest
      .fn()
      .mockRejectedValueOnce(error1)
      .mockRejectedValueOnce(error2)
      .mockResolvedValue("ok");

    const onRetry = jest.fn();

    await withRetry(fn, { delay: 1, jitter: false, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, error1);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, error2);
  });

  test("should respect isRetryable predicate selectively", async () => {
    const retryableError = new Error("retryable");
    const fatalError = new Error("fatal");
    const fn = jest
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockRejectedValueOnce(fatalError);

    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        delay: 1,
        jitter: false,
        isRetryable: (err) => (err as Error).message === "retryable",
      }),
    ).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("should work with maxAttempts of 1", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("fail"));

    await expect(withRetry(fn, { maxAttempts: 1, delay: 1 })).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("should pass through strategy and delay options to computeDelay", async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValue("ok");

    const result = await withRetry(fn, {
      strategy: "constant",
      delay: 1,
      jitter: false,
    });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("should handle non-Error thrown values", async () => {
    const fn = jest.fn().mockRejectedValueOnce("string error").mockResolvedValue("ok");

    const onRetry = jest.fn();
    const result = await withRetry(fn, { delay: 1, jitter: false, onRetry });

    expect(result).toBe("ok");
    expect(onRetry).toHaveBeenCalledWith(1, "string error");
  });
});
