import { describe, expect, test } from "vitest";
import type { PylonIntrospectionActive } from "../../../types/index.js";
import { assertIntrospectionLive } from "./assert-introspection-live.js";

const NOW = new Date("2026-08-10T12:00:00.000Z");

const answer = (claims: Partial<PylonIntrospectionActive> = {}) =>
  ({ active: true, custom: {}, subject: "alice", ...claims }) as PylonIntrospectionActive;

/**
 * The check exists for the authorization server that contradicts ITSELF —
 * `active: true` beside an `exp` already gone, or an `nbf` not yet reached.
 * `active` alone cannot see that, and serving such an answer would extend the
 * grant for as long as the server kept saying yes.
 */
describe("assertIntrospectionLive", () => {
  test("accepts an answer with no temporal claims at all", () => {
    // RFC 7662 §2.2 makes every member a MAY, so an answer carrying neither is
    // ordinary — not suspicious.
    expect(() => assertIntrospectionLive(answer(), NOW)).not.toThrow();
  });

  test("accepts an exp in the future", () => {
    const expiresAt = new Date(NOW.getTime() + 1_000);
    expect(() => assertIntrospectionLive(answer({ expiresAt }), NOW)).not.toThrow();
  });

  test("refuses an exp in the past", () => {
    const expiresAt = new Date(NOW.getTime() - 1_000);
    expect(() => assertIntrospectionLive(answer({ expiresAt }), NOW)).toThrow(
      expect.objectContaining({ code: "token_not_active", status: 401 }),
    );
  });

  // The boundary, stated: `exp` is EXCLUSIVE — a token expiring exactly now has
  // expired. There is no tolerance to soften it, because an introspection answer
  // is fetched live from the authority rather than carried across a clock.
  test("refuses an exp exactly equal to now", () => {
    expect(() => assertIntrospectionLive(answer({ expiresAt: NOW }), NOW)).toThrow(
      expect.objectContaining({ code: "token_not_active" }),
    );
  });

  test("accepts an nbf in the past", () => {
    const notBefore = new Date(NOW.getTime() - 1_000);
    expect(() => assertIntrospectionLive(answer({ notBefore }), NOW)).not.toThrow();
  });

  // `nbf` is INCLUSIVE — a token valid from exactly now is valid.
  test("accepts an nbf exactly equal to now", () => {
    expect(() => assertIntrospectionLive(answer({ notBefore: NOW }), NOW)).not.toThrow();
  });

  test("refuses an nbf in the future", () => {
    const notBefore = new Date(NOW.getTime() + 1_000);
    expect(() => assertIntrospectionLive(answer({ notBefore }), NOW)).toThrow(
      expect.objectContaining({ code: "token_not_active" }),
    );
  });

  test("reports the offending window without the token", () => {
    const expiresAt = new Date(NOW.getTime() - 1_000);
    try {
      assertIntrospectionLive(answer({ expiresAt }), NOW);
      expect.fail("expected assertIntrospectionLive to throw");
    } catch (error: any) {
      expect(error.data.expiresAt).toBe(expiresAt.toISOString());
      expect(error.data.notBefore).toBeUndefined();
    }
  });
});
