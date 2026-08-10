import { ClientError } from "@lindorm/errors";
import { describe, expect, test } from "vitest";
import { introspectionAnswer } from "../../../__fixtures__/access/tokens.js";
import { assertIntrospectionScheme } from "./assert-introspection-scheme.js";

/**
 * The OPTIONAL BOUND on RFC 7662 §2.2's `token_type`: tolerate an answer that
 * states none, refuse one that says the credential is DPoP bound when the
 * request spent it as a bearer token.
 */
describe("assertIntrospectionScheme", () => {
  describe("absent — tolerated", () => {
    // RFC 7662 §2.2 makes every member a MAY, so a bare `{ active: true }` is a
    // conformant answer and refusing it bought nothing.
    test("accepts an answer that states no token type", () => {
      expect(() =>
        assertIntrospectionScheme(
          introspectionAnswer({ tokenType: undefined }),
          "bearer",
        ),
      ).not.toThrow();
    });

    test("accepts an empty token type, which states nothing either", () => {
      expect(() =>
        assertIntrospectionScheme(introspectionAnswer({ tokenType: "" }), "bearer"),
      ).not.toThrow();
    });
  });

  describe("agreeing — accepted in any casing", () => {
    // RFC 7235 §2.1 makes the auth scheme case-insensitive, and authorization
    // servers spell it every way there is. A case-sensitive match here would
    // refuse conformant answers, which is the whole bug.
    test.each(["Bearer", "bearer", "BEARER", "  Bearer  "])(
      "accepts %j for a bearer-presented credential",
      (tokenType) => {
        expect(() =>
          assertIntrospectionScheme(introspectionAnswer({ tokenType }), "bearer"),
        ).not.toThrow();
      },
    );

    test.each(["DPoP", "dpop", "DPOP", "  DPoP  "])(
      "accepts %j for a dpop-presented credential",
      (tokenType) => {
        expect(() =>
          assertIntrospectionScheme(introspectionAnswer({ tokenType }), "dpop"),
        ).not.toThrow();
      },
    );
  });

  describe("DPoP claimed, bearer presented — refused", () => {
    // The bypass this check exists for, and the only direction that is one. An
    // authorization server that names the DPoP scheme but omits `cnf.jkt`
    // leaves `assertDpopBinding` nothing to compare, so a bound credential
    // would be spent as a plain bearer token with no proof of possession at
    // all — and on the opaque arm this is the only place it is visible.
    test.each(["DPoP", "dpop", "DPOP"])(
      "refuses %j for a bearer presentation",
      (tokenType) => {
        expect(() =>
          assertIntrospectionScheme(introspectionAnswer({ tokenType }), "bearer"),
        ).toThrow(
          expect.objectContaining({
            code: "introspection_token_type_mismatch",
            status: 401,
          }),
        );
      },
    );

    test("reports both spellings without inventing one", () => {
      try {
        assertIntrospectionScheme(introspectionAnswer({ tokenType: "DPoP" }), "bearer");
        expect.fail("expected assertIntrospectionScheme to throw");
      } catch (error: any) {
        expect(error).toBeInstanceOf(ClientError);
        expect(error.data).toEqual({ presented: "bearer", stated: "DPoP" });
        expect(error.type).toBe(
          "urn:lindorm:pylon:error:introspection_token_type_mismatch",
        );
      }
    });
  });

  // ⚠ ONE DIRECTION ONLY, and these are the cases that prove it. An answer of
  // `Bearer` for a credential presented under `DPoP` is the request holding
  // itself to the STRICTER standard: `assertDpopBinding` verifies the proof when
  // the answer carries `cnf.jkt` and refuses the scheme outright when it does
  // not, so there is nothing left for this to add — while refusing it would
  // break every authorization server that answers `Bearer` for a bound token.
  // A scheme pylon does not implement asserts no binding either.
  describe("no binding asserted — nothing to live up to", () => {
    test("accepts a Bearer answer for a dpop-presented credential", () => {
      expect(() =>
        assertIntrospectionScheme(introspectionAnswer({ tokenType: "Bearer" }), "dpop"),
      ).not.toThrow();
    });

    test("accepts a scheme pylon does not implement", () => {
      expect(() =>
        assertIntrospectionScheme(introspectionAnswer({ tokenType: "mac" }), "bearer"),
      ).not.toThrow();
    });
  });

  // A transport with no `Authorization` header — the socket handshake and the
  // socket refresh event — presents no scheme at all, so there is nothing for
  // the answer to contradict. Stated as `undefined` at those call sites rather
  // than derived from a DPoP proof header, which would refuse the `DPoP` answer
  // that `dpop: "disabled"` exists to accept.
  describe("no scheme presented — nothing to contradict", () => {
    test.each(["Bearer", "DPoP", "mac"])("accepts %j", (tokenType) => {
      expect(() =>
        assertIntrospectionScheme(introspectionAnswer({ tokenType }), undefined),
      ).not.toThrow();
    });
  });
});
