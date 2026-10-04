import { Aegis, type IAegis } from "@lindorm/aegis";
import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { introspectionAnswer } from "../../../__fixtures__/access/tokens.js";
import { assertIntrospectionLive } from "./assert-introspection-live.js";

const NOW = new Date("2026-08-10T12:00:00.000Z");

const logger = createMockLogger();

/** A real deployment holding no key: the liveness check reads its clock tolerance and nothing else. */
const deployment = (clockTolerance?: number): IAegis =>
  new Aegis({ amphora: new Amphora({ logger }), logger, clockTolerance });

const aegis = deployment();

/**
 * The TEMPORAL check the INTROSPECTED arm owns: an authorization server that
 * contradicts ITSELF — `active: true` beside an `exp` already gone, an `nbf`
 * not yet reached, an `iat` in the future.
 *
 * The answer's `token_type` is asserted elsewhere (`assertIntrospectionScheme`)
 * — it is a scheme comparison, not a temporal one.
 *
 * ⚠ The clock is pinned with MockDate rather than passed in: the window is
 * `aegis.matches`'s — the deployment's clock tolerance, the one `aegis.verify`
 * runs in — so "now" is the wall clock for both arms and a test pins it the way
 * production does.
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
    expect(() => assertIntrospectionLive(aegis, introspectionAnswer())).not.toThrow();
  });

  test("accepts an exp in the future", () => {
    const expiresAt = new Date(NOW.getTime() + 1_000);
    expect(() =>
      assertIntrospectionLive(aegis, introspectionAnswer({ expiresAt })),
    ).not.toThrow();
  });

  test("refuses an exp in the past", () => {
    const expiresAt = new Date(NOW.getTime() - 1_000);
    expect(() =>
      assertIntrospectionLive(aegis, introspectionAnswer({ expiresAt })),
    ).toThrow(expect.objectContaining({ code: "token_not_active", status: 401 }));
  });

  test("refuses an exp exactly equal to now", () => {
    expect(() =>
      assertIntrospectionLive(aegis, introspectionAnswer({ expiresAt: NOW })),
    ).toThrow(expect.objectContaining({ code: "token_not_active" }));
  });

  test("accepts an nbf in the past", () => {
    const notBefore = new Date(NOW.getTime() - 1_000);
    expect(() =>
      assertIntrospectionLive(aegis, introspectionAnswer({ notBefore })),
    ).not.toThrow();
  });

  // `nbf` is INCLUSIVE — a token valid from exactly now is valid.
  test("accepts an nbf exactly equal to now", () => {
    expect(() =>
      assertIntrospectionLive(aegis, introspectionAnswer({ notBefore: NOW })),
    ).not.toThrow();
  });

  test("refuses an nbf in the future", () => {
    const notBefore = new Date(NOW.getTime() + 1_000);
    expect(() =>
      assertIntrospectionLive(aegis, introspectionAnswer({ notBefore })),
    ).toThrow(expect.objectContaining({ code: "token_not_active" }));
  });

  // The window is the registry's WHOLE temporal set, not just exp/nbf — an
  // answer reporting a credential issued in the future is as self-contradicting
  // as one reporting an expired credential, and a bare `exp > now` misses it.
  test("refuses an iat in the future", () => {
    const issuedAt = new Date(NOW.getTime() + 1_000);
    expect(() =>
      assertIntrospectionLive(aegis, introspectionAnswer({ issuedAt })),
    ).toThrow(expect.objectContaining({ code: "token_not_active" }));
  });

  test("reports the offending window without the token", () => {
    const expiresAt = new Date(NOW.getTime() - 1_000);
    try {
      assertIntrospectionLive(aegis, introspectionAnswer({ expiresAt }));
      expect.fail("expected assertIntrospectionLive to throw");
    } catch (error: any) {
      expect(error.data.expiresAt).toBe(expiresAt.toISOString());
      expect(error.data.notBefore).toBeUndefined();
    }
  });

  // Liveness says nothing about the presentation scheme — a bare
  // `{ active: true }` answer clears this check whatever it states.
  test("ignores the answer's token type", () => {
    expect(() =>
      assertIntrospectionLive(aegis, introspectionAnswer({ tokenType: undefined })),
    ).not.toThrow();
    expect(() =>
      assertIntrospectionLive(aegis, introspectionAnswer({ tokenType: "DPoP" })),
    ).not.toThrow();
  });

  // The window is the DEPLOYMENT's: one answer, ten seconds past its `exp`, is
  // refused by a deployment allowing no clock tolerance and accepted by one
  // allowing thirty seconds. The check reads the instance it is handed and
  // keeps no window of its own.
  describe("the window is the deployment's clock tolerance", () => {
    const expiresAt = new Date(NOW.getTime() - 10_000);

    test("refuses an exp ten seconds past at a deployment allowing no clock tolerance", () => {
      expect(() =>
        assertIntrospectionLive(deployment(0), introspectionAnswer({ expiresAt })),
      ).toThrow(expect.objectContaining({ code: "token_not_active" }));
    });

    test("accepts an exp ten seconds past at a deployment allowing a thirty-second clock tolerance", () => {
      expect(() =>
        assertIntrospectionLive(deployment(30), introspectionAnswer({ expiresAt })),
      ).not.toThrow();
    });
  });
});
