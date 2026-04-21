import { dedupPromise } from "./dedup-promise.js";
import { describe, expect, it, vi } from "vitest";

describe("dedupPromise", () => {
  it("should return the same in-flight promise for concurrent calls", async () => {
    const fn = vi.fn(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("value"), 20)),
    );
    const dedup = dedupPromise(fn);

    const p1 = dedup();
    const p2 = dedup();

    expect(p1).toBe(p2);
    expect(fn).toHaveBeenCalledTimes(1);

    await expect(p1).resolves.toBe("value");
  });

  it("should re-run fn after in-flight promise settles successfully", async () => {
    const fn = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    const dedup = dedupPromise(fn);

    await expect(dedup()).resolves.toBe("first");
    await expect(dedup()).resolves.toBe("second");

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should re-run fn after in-flight promise rejects", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("ok");
    const dedup = dedupPromise(fn);

    await expect(dedup()).rejects.toThrow("fail");
    await expect(dedup()).resolves.toBe("ok");

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should not cache successful results", async () => {
    const fn = vi.fn().mockResolvedValue("value");
    const dedup = dedupPromise(fn);

    await dedup();
    await dedup();
    await dedup();

    expect(fn).toHaveBeenCalledTimes(3);
  });
});
