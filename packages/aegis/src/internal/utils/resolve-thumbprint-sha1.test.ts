import { describe, expect, test } from "vitest";
import { resolveThumbprintSha1 } from "./resolve-thumbprint-sha1.js";

describe("resolveThumbprintSha1", () => {
  test("the per-call request wins over the deployment default", () => {
    // ⚠ The second row is the `??`-not-`||` case: an EXPLICIT false must be
    // honoured, not treated as absent, so a deployment that retires SHA-1 per
    // call can say so against a default that is on. `||` would answer `true`.
    expect(resolveThumbprintSha1(true, { certificateThumbprintSha1: false })).toBe(true);
    expect(resolveThumbprintSha1(false, { certificateThumbprintSha1: true })).toBe(false);
  });

  test("a call that states nothing falls back to the deployment default", () => {
    expect(resolveThumbprintSha1(undefined, { certificateThumbprintSha1: true })).toBe(
      true,
    );
    expect(resolveThumbprintSha1(undefined, { certificateThumbprintSha1: false })).toBe(
      false,
    );
  });
});
