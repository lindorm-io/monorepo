import { describe, expect, test } from "vitest";
import type { WireTokenHeader } from "../../types/index.js";
import { AegisDomainError } from "../../errors/index.js";
import { coseName, joseName } from "../claims/claims-registry.js";
import { buildTokenResult } from "./build-token-result.js";

const JOSE_WIRE = {
  iss: "https://test.lindorm.io/",
  sub: "user-1",
  aud: ["https://rs.lindorm.io/"],
  exp: 1704099600,
  jti: "token-1",
  national_identity_number: "19900101-1234",
};

const base = {
  format: "jwt" as const,
  wire: JOSE_WIRE,
  protectedHeader: { alg: "ES512", typ: "JWT" } as WireTokenHeader,
  unprotectedHeader: undefined,
  token: "the.token",
  encrypted: false,
  nameOf: joseName,
  issuerPresence: "required" as const,
};

describe("buildTokenResult", () => {
  describe("the issuer presence gate", () => {
    test("accepts a non-empty issuer", () => {
      expect(buildTokenResult(base).claims.issuer).toBe("https://test.lindorm.io/");
    });

    test("refuses an absent issuer when the wire requires one", () => {
      const { iss: _iss, ...rest } = JOSE_WIRE;

      expect(() => buildTokenResult({ ...base, wire: rest })).toThrow(AegisDomainError);
    });

    // ⚠ The EMPTY-STRING case, and the reason the guard is `isString(x) &&
    // x.length > 0` rather than `isString(x)`: `isString("")` is TRUE, so an
    // issuer of "" slips through a type-only check and every downstream
    // comparison then runs against a claim that names nobody.
    test("refuses an EMPTY-STRING issuer", () => {
      expect(() =>
        buildTokenResult({ ...base, wire: { ...JOSE_WIRE, iss: "" } }),
      ).toThrow(expect.objectContaining({ code: "missing_claim_iss" }));
    });

    // ⚠ PRESERVED DIVERGENCE, pinned so it cannot change silently: the COSE read
    // has never required an `iss` and the JOSE read always has.
    test("accepts an absent issuer when the wire does not require one", () => {
      const { iss: _iss, ...rest } = JOSE_WIRE;

      expect(() =>
        buildTokenResult({
          ...base,
          format: "cwt",
          wire: rest,
          nameOf: coseName,
          issuerPresence: "optional",
        }),
      ).not.toThrow();
    });
  });

  describe("header provenance", () => {
    // A header the wire does not have must be ABSENT, not empty: JOSE compact
    // serialisation has no unprotected bucket, its kits report `{}`, and `{}` is
    // truthy — so a consumer testing `if (result.unprotectedHeader)` would get
    // `true` on every JWT and then read `algorithm`, which the type declares
    // non-optional, as `undefined`.
    test("reports no unprotected header when the wire carries none", () => {
      expect(buildTokenResult({ ...base, unprotectedHeader: {} }).unprotectedHeader).toBe(
        undefined,
      );
    });

    test("reports the two buckets SEPARATELY, never merged", () => {
      const result = buildTokenResult({
        ...base,
        format: "cwt",
        nameOf: coseName,
        protectedHeader: { alg: "ES512", typ: "application/at+cwt" } as WireTokenHeader,
        unprotectedHeader: { kid: "key-1" },
      });

      // `kid` rides the UNPROTECTED bucket on every COSE token aegis signs. It is
      // the advisory routing hint nothing may decide on, so it must not be
      // readable off the bucket the signature covers.
      expect(result.unprotectedHeader?.keyId).toBe("key-1");
      expect(result.protectedHeader.keyId).toBe(undefined);
      expect(result.protectedHeader.headerType).toBe("application/at+cwt");
    });
  });

  describe("the confidentiality gate", () => {
    test("suppresses a sensitive claim on an unencrypted token", () => {
      const result = buildTokenResult(base);

      expect(result.sensitive).toBe(undefined);
      expect(result.claims).not.toHaveProperty("nationalIdentityNumber");
      expect(result.custom).not.toHaveProperty("nationalIdentityNumber");
    });

    test("surfaces it when the outer token was encrypted", () => {
      expect(buildTokenResult({ ...base, encrypted: true }).sensitive).toEqual({
        nationalIdentityNumber: "19900101-1234",
      });
    });
  });

  // Which claim the ISSUER stated is decided by the registered wire claim. A
  // look-alike spelled in domain form is a name the PRESENTER chose.
  test("resolves a claim under its wire name and never its domain spelling", () => {
    const result = buildTokenResult({
      ...base,
      wire: { ...JOSE_WIRE, aud: ["someone-else"], audience: ["https://rs.lindorm.io/"] },
    });

    expect(result.claims.audience).toEqual(["someone-else"]);
    expect(result.custom.audience).toEqual(["https://rs.lindorm.io/"]);
  });
});
