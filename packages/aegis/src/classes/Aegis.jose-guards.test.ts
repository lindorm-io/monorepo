import { describe, expect, test } from "vitest";
import { Aegis } from "./Aegis.js";
import { JweKit } from "./JweKit.js";
import { JwsKit } from "./JwsKit.js";
import { JwtKit } from "./JwtKit.js";

const seg = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const raw = (value: string): string => Buffer.from(value).toString("base64url");

const claims = seg({ iss: "https://issuer.test/", sub: "user_1" });

const jws = (header: unknown, payload = claims, signature = "sig"): string =>
  [seg(header), payload, signature].join(".");

const jwe = (header: unknown, tag = "tag"): string =>
  [seg(header), "key", "iv", "ciphertext", tag].join(".");

/**
 * The JOSE format guards — the counterpart to the COSE guard suite. They answer
 * "which wire is this, and can aegis process it", which is what `parse` and
 * `verify` route on. The format half is RFC 7515/7516/7519 shape (`@lindorm/is`);
 * the aegis half is the algorithm allowlist.
 */
describe("Aegis — JOSE format guards", () => {
  describe("a typ header is a HINT, never the discriminant", () => {
    test("a typ-LESS id_token is a JWT, a JWS, and JOSE", () => {
      const token = jws({ alg: "ES256", kid: "key_1" });

      expect(JwtKit.isJwt(token)).toBe(true);
      expect(JwsKit.isJws(token)).toBe(true);
      expect(Aegis.isJwt(token)).toBe(true);
      expect(Aegis.isJws(token)).toBe(true);
      expect(Aegis.isJose(token)).toBe(true);
    });

    test("an RFC 9068 at+jwt access token is a JWT and a JWS", () => {
      const token = jws({ alg: "ES256", typ: "application/at+jwt" });

      expect(Aegis.isJwt(token)).toBe(true);
      expect(Aegis.isJws(token)).toBe(true);
    });

    test("a JWT IS a JWS — RFC 7519 §3", () => {
      expect(Aegis.isJws(jws({ alg: "ES256", typ: "JWT" }))).toBe(true);
    });

    test("a typ-LESS JWE is a JWE and JOSE", () => {
      const token = jwe({ alg: "ECDH-ES", enc: "A256GCM" });

      expect(JweKit.isJwe(token)).toBe(true);
      expect(Aegis.isJwe(token)).toBe(true);
      expect(Aegis.isJose(token)).toBe(true);
    });

    test("a five-segment token without enc is not a JWE — RFC 7516 §4.1.2", () => {
      expect(Aegis.isJwe(jwe({ alg: "dir", typ: "JWE" }))).toBe(false);
    });
  });

  describe("an OPAQUE signed token never reads as claims-bearing", () => {
    test("a JWS / JOSE / +jws typ is believed even over a JSON payload", () => {
      expect(Aegis.isJwt(jws({ alg: "ES256", typ: "JWS" }, seg({ handle: "abc" })))).toBe(
        false,
      );
      expect(
        Aegis.isJwt(jws({ alg: "ES256", typ: "JOSE" }, seg({ handle: "abc" }))),
      ).toBe(false);
      expect(
        Aegis.isJwt(jws({ alg: "ES256", typ: "application/at+jws" }, seg({ h: "abc" }))),
      ).toBe(false);
    });

    test("a typ-LESS opaque payload is a JWS but not a JWT", () => {
      const token = jws({ alg: "ES256" }, raw("opaque-handle"));

      expect(Aegis.isJws(token)).toBe(true);
      expect(Aegis.isJwt(token)).toBe(false);
    });

    test("a DECLARED JWT typ over a non-claims payload is not a JWT", () => {
      expect(Aegis.isJwt(jws({ alg: "ES256", typ: "JWT" }, raw("opaque-handle")))).toBe(
        false,
      );
    });
  });

  describe("the aegis half: the algorithm allowlist", () => {
    test("an Unsecured alg none token is no JOSE format aegis will route", () => {
      const token = jws({ alg: "none" });

      expect(Aegis.isJwt(token)).toBe(false);
      expect(Aegis.isJws(token)).toBe(false);
      expect(Aegis.isJose(token)).toBe(false);
    });

    test("an unsupported alg is rejected on every guard", () => {
      expect(Aegis.isJwt(jws({ alg: "RS1" }))).toBe(false);
      expect(Aegis.isJws(jws({ alg: "RS1" }))).toBe(false);
      expect(Aegis.isJwe(jwe({ alg: "RSA1_5", enc: "A256GCM" }))).toBe(false);
    });
  });

  describe("anything that is not a compact JOSE token", () => {
    test("false for a bare handle, an empty string, and a COSE token", () => {
      for (const guard of [Aegis.isJwt, Aegis.isJws, Aegis.isJwe, Aegis.isJose]) {
        expect(guard("opaque-access-token")).toBe(false);
        expect(guard("")).toBe(false);
      }
    });

    test("false when the header carries no alg", () => {
      expect(Aegis.isJws(jws({ typ: "JWT" }))).toBe(false);
      expect(Aegis.isJwt(jws({ typ: "JWT" }))).toBe(false);
    });
  });
});
