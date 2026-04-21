import { PylonError } from "../../../errors/PylonError.js";
import type { PylonSessionOptions } from "../../../types/index.js";
import { assertSameSiteForSockets } from "./assert-same-site-for-sockets.js";
import { describe, expect, test } from "vitest";

const base: PylonSessionOptions = { enabled: true };

describe("assertSameSiteForSockets", () => {
  test("should pass when session is unset", () => {
    expect(() => assertSameSiteForSockets(undefined)).not.toThrow();
  });

  test("should pass with SameSite=lax", () => {
    expect(() => assertSameSiteForSockets({ ...base, sameSite: "lax" })).not.toThrow();
  });

  test("should pass with SameSite=strict", () => {
    expect(() => assertSameSiteForSockets({ ...base, sameSite: "strict" })).not.toThrow();
  });

  test("should throw when SameSite is none", () => {
    expect(() => assertSameSiteForSockets({ ...base, sameSite: "none" })).toThrow(
      PylonError,
    );
  });

  test("should throw when SameSite is unset", () => {
    expect(() => assertSameSiteForSockets({ ...base })).toThrow(PylonError);
  });

  test("should throw with descriptive error when SameSite is none", () => {
    try {
      assertSameSiteForSockets({ ...base, sameSite: "none" });
      fail("expected to throw");
    } catch (err: any) {
      expect(err).toMatchSnapshot({
        id: expect.any(String),
        timestamp: expect.any(Date),
      });
    }
  });
});
