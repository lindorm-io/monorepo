import { dedupePromise } from "./dedupe-promise";

describe("dedupePromise", () => {
  it("should return the same in-flight promise for concurrent calls", async () => {
    const fn = jest.fn(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("value"), 20)),
    );
    const deduped = dedupePromise(fn);

    const p1 = deduped();
    const p2 = deduped();

    expect(p1).toBe(p2);
    expect(fn).toHaveBeenCalledTimes(1);

    await expect(p1).resolves.toBe("value");
  });

  it("should re-run fn after in-flight promise settles successfully", async () => {
    const fn = jest.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    const deduped = dedupePromise(fn);

    await expect(deduped()).resolves.toBe("first");
    await expect(deduped()).resolves.toBe("second");

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should re-run fn after in-flight promise rejects", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("ok");
    const deduped = dedupePromise(fn);

    await expect(deduped()).rejects.toThrow("fail");
    await expect(deduped()).resolves.toBe("ok");

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should not cache successful results", async () => {
    const fn = jest.fn().mockResolvedValue("value");
    const deduped = dedupePromise(fn);

    await deduped();
    await deduped();
    await deduped();

    expect(fn).toHaveBeenCalledTimes(3);
  });
});
