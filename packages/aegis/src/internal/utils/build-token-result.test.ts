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

  // The builder reports ONE domain header, merged from the two wire buckets
  // under the header registry's `placement` allowlist. These tests drive the
  // builder with hand-written buckets, which is the only way to state an
  // arrival no aegis writer can emit.
  describe("header provenance", () => {
    const cose = (unprotectedHeader: Partial<WireTokenHeader>) =>
      buildTokenResult({
        ...base,
        format: "cwt",
        nameOf: coseName,
        protectedHeader: { alg: "ES512", typ: "application/at+cwt" } as WireTokenHeader,
        unprotectedHeader,
      }).header;

    // `kid` rides the UNPROTECTED bucket on every COSE token aegis signs
    // (RFC 9052 §3.1 — an advisory routing hint), and the registry marks it
    // `placement: "either"`, so it reaches the one domain header a caller reads.
    test("admits a parameter the registry permits to travel unprotected", () => {
      expect(cose({ kid: "key-1" }).keyId).toBe("key-1");
    });

    test("keeps the protected parameters", () => {
      expect(cose({}).headerType).toBe("application/at+cwt");
    });

    // The allowlist, in the direction that matters. `typ` and `cty` are
    // `placement: "protected"` — a verifier routes by them — so a bucket the
    // signature does not cover cannot state either.
    test("IGNORES a parameter that must be signed", () => {
      const header = cose({ cty: "application/example", oid: "1.2.3.4" });

      expect(header.contentType).toBe(undefined);
      expect(header.objectId).toBe(undefined);
    });

    // The merge order: unprotected first, protected over it.
    test("reports the PROTECTED value where both buckets state one", () => {
      const result = buildTokenResult({
        ...base,
        format: "cwt",
        nameOf: coseName,
        protectedHeader: { alg: "ES512", kid: "signed-key" } as WireTokenHeader,
        unprotectedHeader: { kid: "presented-key" },
      });

      expect(result.header.keyId).toBe("signed-key");
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
