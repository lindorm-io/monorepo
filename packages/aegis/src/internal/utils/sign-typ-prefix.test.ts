import { describe, expect, test } from "vitest";
import { signTypPrefix } from "./sign-typ-prefix.js";

/**
 * `signTypPrefix` — the ONE profile-less typ derivation, beside this file.
 *
 * It answers a bare PREFIX, which each kit re-wraps in its own format. That is
 * what lets a single function serve both wires: `"at"` becomes
 * `application/at+jwt` on a JOSE write and `application/at+cwt` on a COSE one,
 * and `undefined` leaves each kit its own bare conventional form.
 */
describe("signTypPrefix", () => {
  test("reduces a domain token type to the prefix the kits re-wrap", () => {
    expect(signTypPrefix({ typ: undefined, tokenType: "access_token" })).toBe("at");
  });

  /**
   * ⭐ A TOKEN TYPE WHOSE SHORT NAME IS THE BARE CONVENTIONAL FORM.
   *
   * `id_token` maps to `JWT` (OIDC Core §2 — an ID Token is a plain JWT and no
   * structured `id+jwt` media type is registered), so there is NO prefix to
   * stamp and each kit falls back to its own bare form. Answering anything else
   * here — a JOSE spelling in particular — is unrepresentable on a COSE write and
   * makes the whole call throw rather than emit a token.
   */
  test("a type with no structured form yields no prefix", () => {
    expect(signTypPrefix({ typ: undefined, tokenType: "id_token" })).toBeUndefined();
  });

  test("an unstated type yields no prefix", () => {
    expect(signTypPrefix({ typ: undefined, tokenType: undefined })).toBeUndefined();
  });

  test("an unregistered token type is its own prefix", () => {
    expect(signTypPrefix({ typ: undefined, tokenType: "widget" })).toBe("widget");
  });

  // The caller's explicit type OVERRIDES the derived one — the same precedence
  // `mint` applies once a profile mandates nothing.
  test.each([
    ["at+jwt", "at"],
    ["application/at+jwt", "at"],
    ["JWT", undefined],
  ] as const)("an explicit typ of %s reduces to %s", (typ, expected) => {
    expect(signTypPrefix({ typ, tokenType: "refresh_token" })).toBe(expected);
  });
});
