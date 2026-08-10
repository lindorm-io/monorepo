import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isJwe } from "./is-jwe.js";
import { describe, expect, test } from "vitest";

const seg = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const jwe = (
  header: unknown,
  key = "encryptedkey",
  iv = "iv",
  ciphertext = "ciphertext",
  tag = "tag",
): string => [seg(header), key, iv, ciphertext, tag].join(".");

describe("isJwe", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isJwe(value)).toMatchSnapshot();
  });

  describe("segment count decides, not typ", () => {
    test("true for a typ-LESS JWE — RFC 7516 has no required typ", () => {
      expect(isJwe(jwe({ alg: "ECDH-ES", enc: "A256GCM" }))).toBe(true);
    });

    test("true for the conventional JWE typ", () => {
      expect(isJwe(jwe({ alg: "dir", enc: "A256GCM", typ: "JWE" }))).toBe(true);
    });

    test("true for a +jwe media type", () => {
      expect(isJwe(jwe({ alg: "dir", enc: "A256GCM", typ: "application/at+jwe" }))).toBe(
        true,
      );
    });
  });

  describe("the RFC 7516 §7.1 grammar", () => {
    test("true with an EMPTY encrypted key — Direct Key Agreement omits it", () => {
      expect(isJwe(jwe({ alg: "ECDH-ES", enc: "A256GCM" }, ""))).toBe(true);
    });

    test("true with an EMPTY iv and tag — algorithms that use neither", () => {
      expect(isJwe(jwe({ alg: "RSA-OAEP", enc: "A256GCM" }, "key", "", "ct", ""))).toBe(
        true,
      );
    });

    test("false for an empty header or ciphertext segment", () => {
      expect(isJwe(".key.iv.ct.tag")).toBe(false);
      expect(isJwe(jwe({ alg: "dir", enc: "A256GCM" }, "key", "iv", ""))).toBe(false);
    });

    test("false for a three-segment JWS", () => {
      expect(isJwe(`${seg({ alg: "ES256", typ: "JWT" })}.${seg({ sub: "u" })}.sig`)).toBe(
        false,
      );
    });

    test("false for six segments", () => {
      expect(isJwe(`${seg({ alg: "dir", enc: "A256GCM" })}.a.b.c.d.e`)).toBe(false);
    });
  });

  describe("the protected header", () => {
    test("false when enc is absent — RFC 7516 §4.1.2 makes it REQUIRED", () => {
      expect(isJwe(jwe({ alg: "dir", typ: "JWE" }))).toBe(false);
    });

    test("false when enc is not a string", () => {
      expect(isJwe(jwe({ alg: "dir", enc: 256 }))).toBe(false);
    });

    test("false when alg is absent — RFC 7516 §4.1.1 makes it REQUIRED", () => {
      expect(isJwe(jwe({ enc: "A256GCM" }))).toBe(false);
    });

    test("false when the header is not decodable base64url JSON", () => {
      expect(isJwe("bm90LWpzb24.key.iv.ct.tag")).toBe(false);
    });
  });

  test("false for a non-string input", () => {
    expect(isJwe(undefined)).toBe(false);
    expect(isJwe(123)).toBe(false);
  });
});
