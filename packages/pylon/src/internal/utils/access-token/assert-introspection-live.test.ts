import MockDate from "mockdate";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { introspectionAnswer } from "../../../__fixtures__/access/tokens.js";
import { assertIntrospectionLive } from "./assert-introspection-live.js";

const NOW = new Date("2026-08-10T12:00:00.000Z");

/**
 * The checks the INTROSPECTED arm owns: an authorization server that
 * contradicts ITSELF — `active: true` beside an `exp` already gone, an `nbf`
 * not yet reached, an `iat` in the future — or one that declines to say what
 * kind of credential it answered about at all.
 *
 * ⚠ The clock is pinned with MockDate rather than passed in. The `now` argument
 * is GONE: the window is `Aegis.matches`'s default one, the same builder
 * `aegis.verify` runs, so "now" is the wall clock for both arms and a test
 * pins it the way production does.
 */
describe("assertIntrospectionLive", () => {
  beforeEach(() => {
    MockDate.set(NOW.toISOString());
  });

  afterEach(() => {
    MockDate.reset();
  });

  test("accepts an answer with no temporal claims at all", () => {
    // RFC 7662 §2.2 makes every member a MAY, so an answer carrying neither is
    // ordinary — not suspicious.
    expect(() => assertIntrospectionLive(introspectionAnswer())).not.toThrow();
  });

  test("accepts an exp in the future", () => {
    const expiresAt = new Date(NOW.getTime() + 1_000);
    expect(() =>
      assertIntrospectionLive(introspectionAnswer({ expiresAt })),
    ).not.toThrow();
  });

  test("refuses an exp in the past", () => {
    const expiresAt = new Date(NOW.getTime() - 1_000);
    expect(() => assertIntrospectionLive(introspectionAnswer({ expiresAt }))).toThrow(
      expect.objectContaining({ code: "token_not_active", status: 401 }),
    );
  });

  // ⚠ EXPECTATION FLIPPED. The boundary used to be exclusive (`exp > now`, from
  // a hand-rolled comparison here) and is now INCLUSIVE: the shared window
  // bounds a `"future"` claim with `$gte: now - clockTolerance`, so a token
  // expiring exactly now still clears it. That is the point of dropping the
  // hand-rolled check — the structured arm has always used this bound, and two
  // arms serving one mount must not disagree about the instant of expiry.
  test("accepts an exp exactly equal to now", () => {
    expect(() =>
      assertIntrospectionLive(introspectionAnswer({ expiresAt: NOW })),
    ).not.toThrow();
  });

  test("accepts an nbf in the past", () => {
    const notBefore = new Date(NOW.getTime() - 1_000);
    expect(() =>
      assertIntrospectionLive(introspectionAnswer({ notBefore })),
    ).not.toThrow();
  });

  // `nbf` is INCLUSIVE — a token valid from exactly now is valid.
  test("accepts an nbf exactly equal to now", () => {
    expect(() =>
      assertIntrospectionLive(introspectionAnswer({ notBefore: NOW })),
    ).not.toThrow();
  });

  test("refuses an nbf in the future", () => {
    const notBefore = new Date(NOW.getTime() + 1_000);
    expect(() => assertIntrospectionLive(introspectionAnswer({ notBefore }))).toThrow(
      expect.objectContaining({ code: "token_not_active" }),
    );
  });

  // The window is the registry's WHOLE temporal set, not just exp/nbf — an
  // answer reporting a credential issued in the future is as self-contradicting
  // as one reporting an expired credential, and the hand-rolled check missed it.
  test("refuses an iat in the future", () => {
    const issuedAt = new Date(NOW.getTime() + 1_000);
    expect(() => assertIntrospectionLive(introspectionAnswer({ issuedAt }))).toThrow(
      expect.objectContaining({ code: "token_not_active" }),
    );
  });

  test("reports the offending window without the token", () => {
    const expiresAt = new Date(NOW.getTime() - 1_000);
    try {
      assertIntrospectionLive(introspectionAnswer({ expiresAt }));
      expect.fail("expected assertIntrospectionLive to throw");
    } catch (error: any) {
      expect(error.data.expiresAt).toBe(expiresAt.toISOString());
      expect(error.data.notBefore).toBeUndefined();
    }
  });

  // The structured arm can never produce a credential whose type went unstated
  // — the profile floor matches the JOSE `typ`. A bare `{ active: true }` is
  // the one shape that could slip past on this arm, so it is refused by name.
  describe("token type", () => {
    test("refuses an answer that states no token type", () => {
      expect(() =>
        assertIntrospectionLive(introspectionAnswer({ tokenType: undefined })),
      ).toThrow(
        expect.objectContaining({
          code: "introspection_token_type_missing",
          status: 401,
        }),
      );
    });

    test("refuses an empty token type", () => {
      expect(() =>
        assertIntrospectionLive(introspectionAnswer({ tokenType: "" })),
      ).toThrow(expect.objectContaining({ code: "introspection_token_type_missing" }));
    });

    // PRESENCE, not equality: RFC 7662 §2.2's `token_type` is RFC 6749 §7.1's
    // presentation scheme, so `DPoP` is as valid an answer as `Bearer` and the
    // mount has no value to compare it against.
    test("accepts any stated token type", () => {
      expect(() =>
        assertIntrospectionLive(introspectionAnswer({ tokenType: "DPoP" })),
      ).not.toThrow();
    });
  });
});
