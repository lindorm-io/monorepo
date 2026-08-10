import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isJwt } from "./is-jwt.js";
import { describe, expect, test } from "vitest";

const seg = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const claims = seg({ iss: "https://test.lindorm.io/", sub: "user_1" });

const jws = (header: unknown, payload = claims, signature = "sig"): string =>
  [seg(header), payload, signature].join(".");

describe("isJwt", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isJwt(value)).toMatchSnapshot();
  });

  describe("a claims payload, not a typ header", () => {
    test("true for a typ-LESS id_token — RFC 7519 §5.1 makes typ OPTIONAL", () => {
      expect(isJwt(jws({ alg: "RS256", kid: "key_1" }))).toBe(true);
    });

    test("true for an RFC 9068 at+jwt access token", () => {
      expect(isJwt(jws({ alg: "ES256", typ: "at+jwt" }))).toBe(true);
      expect(isJwt(jws({ alg: "ES256", typ: "application/at+jwt" }))).toBe(true);
    });

    test("true for an RFC 9449 dpop+jwt proof", () => {
      expect(isJwt(jws({ alg: "ES256", typ: "dpop+jwt" }))).toBe(true);
    });

    test("true for an RFC 8417 secevent+jwt", () => {
      expect(isJwt(jws({ alg: "ES256", typ: "secevent+jwt" }))).toBe(true);
    });

    test("true for the conventional JWT typ", () => {
      expect(isJwt(jws({ alg: "ES256", typ: "JWT" }))).toBe(true);
    });
  });

  describe("the payload must be a JSON object — RFC 7519 §7.2 step 10", () => {
    test("false when the payload is not JSON", () => {
      expect(
        isJwt(jws({ alg: "ES256" }, Buffer.from("data").toString("base64url"))),
      ).toBe(false);
    });

    test("false when the payload is JSON but not an object", () => {
      expect(isJwt(jws({ alg: "ES256" }, seg(["a"])))).toBe(false);
      expect(isJwt(jws({ alg: "ES256" }, seg(1704096000)))).toBe(false);
      expect(isJwt(jws({ alg: "ES256" }, seg(null)))).toBe(false);
    });

    test("false for a DETACHED payload — nothing proves it is a claims set", () => {
      expect(isJwt(jws({ alg: "ES256" }, ""))).toBe(false);
    });

    test("false when a JWT typ is DECLARED over a non-claims payload", () => {
      expect(
        isJwt(
          jws({ alg: "ES256", typ: "JWT" }, Buffer.from("data").toString("base64url")),
        ),
      ).toBe(false);
    });
  });

  describe("an explicitly OPAQUE typ is believed", () => {
    test("false for typ JWS even when the payload happens to be a JSON object", () => {
      expect(isJwt(jws({ alg: "ES256", typ: "JWS" }, seg({ handle: "abc" })))).toBe(
        false,
      );
    });

    test("false for typ JOSE", () => {
      expect(isJwt(jws({ alg: "ES256", typ: "JOSE" }, seg({ handle: "abc" })))).toBe(
        false,
      );
    });

    test("false for a +jws media type", () => {
      expect(
        isJwt(jws({ alg: "ES256", typ: "application/at+jws" }, seg({ handle: "abc" }))),
      ).toBe(false);
    });
  });

  describe("it is a JWS first", () => {
    test("false for a five-segment JWE", () => {
      expect(isJwt(`${seg({ alg: "dir", enc: "A256GCM", typ: "JWE" })}.a.b.c.d`)).toBe(
        false,
      );
    });

    test("false when alg is absent", () => {
      expect(isJwt(jws({ typ: "JWT" }))).toBe(false);
    });

    test("false for a non-token string", () => {
      expect(isJwt("not a token")).toBe(false);
      expect(isJwt("")).toBe(false);
    });
  });

  test("false for a non-string input", () => {
    expect(isJwt(undefined)).toBe(false);
    expect(isJwt({ alg: "ES256" })).toBe(false);
  });
});
