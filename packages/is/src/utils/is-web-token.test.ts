import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isWebToken } from "./is-web-token.js";
import { describe, expect, test } from "vitest";

const seg = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

describe("isWebToken", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isWebToken(value)).toMatchSnapshot();
  });

  describe("either JOSE compact serialization, typ or no typ", () => {
    test("true for a typ-LESS JWS", () => {
      expect(isWebToken(`${seg({ alg: "ES256" })}.${seg({ data: 1 })}.sig`)).toBe(true);
    });

    test("true for a typ-LESS JWE", () => {
      expect(isWebToken(`${seg({ alg: "ECDH-ES", enc: "A256GCM" })}.a.b.c.d`)).toBe(true);
    });

    test("true for a JWT, an opaque JWS, and a JWE", () => {
      expect(
        isWebToken(`${seg({ alg: "ES256", typ: "JWT" })}.${seg({ sub: "u" })}.sig`),
      ).toBe(true);
      expect(
        isWebToken(`${seg({ alg: "ES256", typ: "JWS" })}.${seg({ data: 1 })}.sig`),
      ).toBe(true);
      expect(
        isWebToken(`${seg({ alg: "dir", enc: "A256GCM", typ: "JWE" })}.a.b.c.d`),
      ).toBe(true);
    });
  });

  describe("anything that is not a compact JOSE token", () => {
    test("false for four segments", () => {
      expect(isWebToken(`${seg({ alg: "ES256" })}.a.b.c`)).toBe(false);
    });

    test("false when the header carries no alg", () => {
      expect(isWebToken(`${seg({ typ: "JWT" })}.${seg({ sub: "u" })}.sig`)).toBe(false);
    });

    test("false for a non-token string", () => {
      expect(isWebToken("not a token")).toBe(false);
      expect(isWebToken("")).toBe(false);
    });

    test("false for a non-string input", () => {
      expect(isWebToken(undefined)).toBe(false);
      expect(isWebToken(123)).toBe(false);
    });
  });
});
