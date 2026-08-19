import { describe, expect, test } from "vitest";
import { capture, captureAsync } from "./test-helpers.js";

describe("test-helpers", () => {
  test("capture should return the thrown error", () => {
    const error = new Error("boom");

    expect(
      capture(() => {
        throw error;
      }),
    ).toBe(error);
  });

  test("capture should throw when the function does not throw", () => {
    expect(() => capture(() => "ok")).toThrow("expected function to throw");
  });

  test("captureAsync should return the rejection", async () => {
    const error = new Error("boom");

    await expect(captureAsync(() => Promise.reject(error))).resolves.toBe(error);
  });

  test("captureAsync should reject when the function does not reject", async () => {
    await expect(captureAsync(() => Promise.resolve("ok"))).rejects.toThrow(
      "expected function to reject",
    );
  });
});
