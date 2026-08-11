import { describe, expect, test } from "vitest";
import { resolveSessionKeys } from "./resolve-session-keys.js";

const COOKIE = {
  signature: { condition: { purpose: "cookie", publish: false } },
  encryption: { condition: { purpose: "cookie", publish: false } },
};

const SESSION = {
  signature: { condition: { purpose: "session", publish: false } },
  encryption: { condition: { purpose: "session", publish: false } },
};

describe("resolveSessionKeys", () => {
  test("should take the session's own keys over the cookie's", () => {
    expect(resolveSessionKeys(SESSION, COOKIE)).toMatchSnapshot();
  });

  // `signature` inherits because an absent one is a real choice — signing off —
  // so a deployment naming one cookie signing key signs session cookies too.
  test("should inherit the cookie SIGNATURE when the session names none", () => {
    const { signature } = resolveSessionKeys({ encryption: SESSION.encryption }, COOKIE);

    expect(signature).toEqual(COOKIE.signature);
  });

  // ⚠ `encryption` does NOT inherit. It is required on PylonSessionSettings, so
  // the only way to reach this state at runtime is a caller bypassing the type —
  // and the answer must be nothing rather than the cookie's key. Inheritance is
  // what made the requirement unexpressible and forced a boot check instead.
  test("should NOT inherit the cookie ENCRYPTION when the session names none", () => {
    const { encryption } = resolveSessionKeys({ signature: SESSION.signature }, COOKIE);

    expect(encryption).toBeUndefined();
  });

  test("should derive verification from the resolved signature, not declare it", () => {
    expect(
      resolveSessionKeys({ encryption: SESSION.encryption }, COOKIE),
    ).toMatchSnapshot();
  });

  test("should answer an empty set when neither tier names anything", () => {
    expect(resolveSessionKeys()).toEqual({});
  });
});
