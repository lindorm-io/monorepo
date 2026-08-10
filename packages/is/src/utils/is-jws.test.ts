import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isJws } from "./is-jws.js";
import { describe, expect, test } from "vitest";

const seg = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const jws = (header: unknown, payload = seg({ data: 1 }), signature = "sig"): string =>
  [seg(header), payload, signature].join(".");

describe("isJws", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isJws(value)).toMatchSnapshot();
  });

  describe("segment count decides, not typ", () => {
    test("true for a typ-LESS JWS — RFC 7515 §4.1.9 makes typ OPTIONAL", () => {
      expect(isJws(jws({ alg: "ES256" }))).toBe(true);
    });

    test("true for a JWT — RFC 7519 §3: a JWT IS a JWS", () => {
      expect(isJws(jws({ alg: "ES256", typ: "JWT" }, seg({ sub: "user_1" })))).toBe(true);
    });

    test("true for an RFC 9068 at+jwt access token", () => {
      expect(isJws(jws({ alg: "ES256", typ: "at+jwt" }, seg({ sub: "user_1" })))).toBe(
        true,
      );
    });

    test("true for an unregistered typ", () => {
      expect(isJws(jws({ alg: "ES256", typ: "something/else" }))).toBe(true);
    });

    test("true for aegis's own JWS / JOSE / +jws media types", () => {
      expect(isJws(jws({ alg: "ES256", typ: "JWS" }))).toBe(true);
      expect(isJws(jws({ alg: "ES256", typ: "JOSE" }))).toBe(true);
      expect(isJws(jws({ alg: "ES256", typ: "application/at+jws" }))).toBe(true);
    });
  });

  describe("the RFC 7515 §7.1 grammar", () => {
    test("true for a DETACHED payload — RFC 7515 appendix F empties that segment", () => {
      expect(isJws(jws({ alg: "ES256" }, ""))).toBe(true);
    });

    test("true for an Unsecured JWS — RFC 7515 §2 gives it an empty signature", () => {
      expect(isJws(jws({ alg: "none" }, seg({ data: 1 }), ""))).toBe(true);
    });

    test("false for an empty header segment", () => {
      expect(isJws(".payload.sig")).toBe(false);
    });

    test("false for two or four segments", () => {
      expect(isJws(`${seg({ alg: "ES256" })}.${seg({ data: 1 })}`)).toBe(false);
      expect(isJws(`${seg({ alg: "ES256" })}.a.b.c`)).toBe(false);
    });

    test("false for a five-segment JWE", () => {
      expect(isJws(`${seg({ alg: "dir", enc: "A256GCM" })}.a.b.c.d`)).toBe(false);
    });

    test("false for a segment outside the base64url alphabet", () => {
      expect(isJws(`${seg({ alg: "ES256" })}.pay+load.sig`)).toBe(false);
    });
  });

  describe("the protected header", () => {
    test("false when the header segment is not decodable base64url JSON", () => {
      expect(isJws("bm90LWpzb24.payload.sig")).toBe(false);
    });

    test("false when the header is JSON but not an object", () => {
      expect(isJws(jws(123))).toBe(false);
      expect(isJws(jws(["alg"]))).toBe(false);
    });

    test("false when alg is absent — RFC 7515 §4.1.1 makes it REQUIRED", () => {
      expect(isJws(jws({ kid: "key_1" }))).toBe(false);
    });

    test("false when alg is not a string", () => {
      expect(isJws(jws({ alg: 256 }))).toBe(false);
    });
  });

  test("false for a non-string input", () => {
    expect(isJws(undefined)).toBe(false);
    expect(isJws(123)).toBe(false);
  });
});
