import { KryptosKit } from "@lindorm/kryptos";
import { describe, expect, test } from "vitest";
import type { PylonKeyRoles } from "../../../types/index.js";
import { resolveVerificationKey } from "./resolve-verification-key.js";

const COOKIE: PylonKeyRoles = {
  signature: { predicate: { purpose: "cookie", publish: false } },
  encryption: { predicate: { purpose: "cookie", publish: false } },
};

const SESSION: PylonKeyRoles = {
  signature: { predicate: { purpose: "session", publish: false } },
};

describe("resolveVerificationKey", () => {
  test("should resolve undefined when neither scope names anything", () => {
    expect(resolveVerificationKey(undefined, undefined)).toBeUndefined();
  });

  test("should prefer an explicit verification on the scope", () => {
    const explicit = { predicate: { publish: false } };

    expect(resolveVerificationKey({ ...SESSION, verification: explicit }, COOKIE)).toBe(
      explicit,
    );
  });

  // The fix: verification IS the signing policy unless told otherwise.
  test("should inherit the scope's own signing predicate", () => {
    expect(resolveVerificationKey(SESSION, COOKIE)).toEqual({
      predicate: { purpose: "session", publish: false },
    });
  });

  // A scope that signs owns its read policy — it must NOT reach the fallback,
  // whose predicate would reject the key this scope just signed with.
  test("should NOT fall back to the cookie scope when the scope names a signature", () => {
    expect(
      resolveVerificationKey(SESSION, { ...COOKIE, verification: COOKIE.signature }),
    ).toEqual({ predicate: { purpose: "session", publish: false } });
  });

  // "Floor alone" is a POLICY, not the absence of one — returning `undefined`
  // here would let the consumer's `?? cookieKeys.verification` seam reinstate the
  // cookie predicate, which the injected key was chosen outside of.
  test("should resolve the floor alone when the scope's signature is an injected kryptos", () => {
    const kryptos = KryptosKit.generate.auto({
      algorithm: "HS256",
      issuer: "http://test.lindorm.io",
      publish: false,
      purpose: "ad-hoc",
    });

    expect(resolveVerificationKey({ signature: { kryptos } }, COOKIE)).toEqual({
      predicate: undefined,
    });
  });

  test("should fall back to the cookie scope's explicit verification", () => {
    const explicit = { predicate: { publish: false } };

    expect(resolveVerificationKey({}, { ...COOKIE, verification: explicit })).toBe(
      explicit,
    );
  });

  test("should fall back to the cookie scope's signing predicate", () => {
    expect(resolveVerificationKey({ encryption: SESSION.encryption }, COOKIE)).toEqual({
      predicate: { purpose: "cookie", publish: false },
    });
  });
});
