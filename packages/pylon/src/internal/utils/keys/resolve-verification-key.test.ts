import { KryptosKit } from "@lindorm/kryptos";
import { describe, expect, test } from "vitest";
import type { PylonSignKey } from "../../../types/index.js";
import { resolveVerificationKey } from "./resolve-verification-key.js";

const COOKIE_SIGNATURE: PylonSignKey = {
  condition: { purpose: "cookie", publish: false },
};

const SESSION_SIGNATURE: PylonSignKey = {
  condition: { purpose: "session", publish: false },
};

describe("resolveVerificationKey", () => {
  test("should resolve undefined when neither scope names a signature", () => {
    expect(resolveVerificationKey(undefined, undefined)).toBeUndefined();
  });

  // The fix: verification IS the signing policy — the signature's condition.
  test("should derive the scope's own signing condition", () => {
    expect(resolveVerificationKey(SESSION_SIGNATURE, COOKIE_SIGNATURE)).toEqual({
      condition: { purpose: "session", publish: false },
    });
  });

  // A scope that signs owns its read policy — it must NOT reach the fallback,
  // whose condition would reject the key this scope just signed with.
  test("should NOT fall back to the cookie scope when the scope names a signature", () => {
    expect(resolveVerificationKey(SESSION_SIGNATURE, COOKIE_SIGNATURE)).toEqual({
      condition: { purpose: "session", publish: false },
    });
  });

  // "Floor alone" is a POLICY, not the absence of one — returning `undefined`
  // here would let the consumer's `?? <deployment default>` seam reinstate the
  // fallback condition, which the injected key was chosen outside of.
  test("should resolve the floor alone when the signature is an injected kryptos", () => {
    const kryptos = KryptosKit.generate.auto({
      algorithm: "HS256",
      issuer: "http://test.lindorm.io",
      publish: false,
      purpose: "ad-hoc",
    });

    expect(resolveVerificationKey({ kryptos }, COOKIE_SIGNATURE)).toEqual({
      condition: undefined,
    });
  });

  test("should fall back to the cookie scope's signing condition", () => {
    expect(resolveVerificationKey(undefined, COOKIE_SIGNATURE)).toEqual({
      condition: { purpose: "cookie", publish: false },
    });
  });
});
