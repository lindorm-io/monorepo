import { describe, expect, test } from "vitest";
import { AegisDomainError } from "../../errors/index.js";
import { accessTokenProfile } from "../profiles/definitions/access-token.js";
import { defaultProfile } from "../profiles/definitions/default.js";
import { delegationProfile } from "../profiles/definitions/delegation.js";
import { externalAccessTokenProfile } from "../profiles/definitions/external-access-token.js";
import { securityEventProfile } from "../profiles/definitions/security-event.js";
import { enforceVerifyFloor } from "./enforce-verify-floor.js";

const ISSUER = "https://test.lindorm.io/";
const RESOURCE = "https://rs.lindorm.io/";

const base = {
  // The algorithm the signature was verified UNDER (see VerifyFloorInput) — an
  // asymmetric one, so the algClass floor is satisfied unless a case says
  // otherwise.
  format: "jwt" as const,
  algorithm: "ES512",
  audience: RESOURCE,
  decodedTyp: "application/at+jwt",
  expectedIssuer: ISSUER,
  profile: accessTokenProfile,
};

// DOMAIN-keyed payload (the floor now consumes the domain view of the raw
// claims) — compliant with the access_token profile's `required` floor.
const validPayload = {
  issuer: ISSUER,
  audience: [RESOURCE],
  expiresAt: new Date(1704099600 * 1000),
  issuedAt: new Date(1704096000 * 1000),
  subject: "user-1",
  clientId: "client-1",
  tokenId: "token-1",
};

// Compliant `delegation` payload — a per-token issuer, and no `issuedAt`: the
// profile omits it from `required` (iat RECOMMENDED, not REQUIRED).
const delegationPayload = {
  issuer: "client-1",
  subject: "customer-sub",
  audience: [RESOURCE],
  expiresAt: new Date(1704099600 * 1000),
  tokenId: "token-1",
};

describe("enforceVerifyFloor", () => {
  test("passes for a conformant token", () => {
    expect(() => enforceVerifyFloor({ ...base, payload: validPayload })).not.toThrow();
  });

  test("rejects an issuer mismatch", () => {
    expect(() =>
      enforceVerifyFloor({
        ...base,
        payload: { ...validPayload, issuer: "https://other/" },
      }),
    ).toThrow(AegisDomainError);
  });

  test("rejects when aud does not contain self", () => {
    expect(() =>
      enforceVerifyFloor({
        ...base,
        payload: { ...validPayload, audience: ["https://elsewhere"] },
      }),
    ).toThrow(AegisDomainError);
  });

  test("rejects a missing exp when the profile mandates a lifetime", () => {
    expect(() =>
      enforceVerifyFloor({
        ...base,
        payload: { ...validPayload, expiresAt: undefined },
      }),
    ).toThrow(expect.objectContaining({ code: "missing_claim_exp" }));
  });

  test("does NOT require exp when the profile lifetime is null (SET)", () => {
    expect(() =>
      enforceVerifyFloor({
        format: "jwt" as const,
        algorithm: "ES512",
        audience: RESOURCE,
        decodedTyp: "application/secevent+jwt",
        expectedIssuer: ISSUER,
        profile: securityEventProfile,
        payload: {
          issuer: ISSUER,
          audience: [RESOURCE],
          issuedAt: new Date(1704096000 * 1000),
          tokenId: "token-1",
          subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
          events: { "urn:example:event": {} },
        },
      }),
    ).not.toThrow();
  });

  describe("typ presence: required", () => {
    test("rejects an absent typ", () => {
      expect(() =>
        enforceVerifyFloor({ ...base, decodedTyp: undefined, payload: validPayload }),
      ).toThrow(expect.objectContaining({ code: "profile_typ_mismatch" }));
    });

    test("rejects a typ mismatch", () => {
      expect(() =>
        enforceVerifyFloor({
          ...base,
          decodedTyp: "application/logout+jwt",
          payload: validPayload,
        }),
      ).toThrow(expect.objectContaining({ code: "profile_typ_mismatch" }));
    });

    test("passes an exact typ match", () => {
      expect(() => enforceVerifyFloor({ ...base, payload: validPayload })).not.toThrow();
    });
  });

  describe("typ presence: none (default profile)", () => {
    const nonePayload = {
      issuer: ISSUER,
      audience: [RESOURCE],
      subject: "user-1",
      expiresAt: new Date(1704099600 * 1000),
    };

    const noneBase = {
      format: "jwt" as const,
      algorithm: "ES512",
      audience: RESOURCE,
      expectedIssuer: undefined,
      profile: defaultProfile,
      payload: nonePayload,
    };

    test("passes an absent typ", () => {
      expect(() =>
        enforceVerifyFloor({ ...noneBase, decodedTyp: undefined }),
      ).not.toThrow();
    });

    test("passes any present typ", () => {
      expect(() => enforceVerifyFloor({ ...noneBase, decodedTyp: "JWT" })).not.toThrow();
    });

    test("still enforces a COSE expectedTyp override as required", () => {
      expect(() =>
        enforceVerifyFloor({
          ...noneBase,
          format: "cwt",
          decodedTyp: undefined,
          expectedTyp: "application/cwt",
        }),
      ).toThrow(
        expect.objectContaining({
          code: "profile_typ_mismatch",
          // The wire the failure came from is DIAGNOSTIC and travels in `data`;
          // the code itself is neutral, so a CWT no longer reports itself as a
          // JWT problem.
          data: expect.objectContaining({ format: "cwt" }),
        }),
      );

      expect(() =>
        enforceVerifyFloor({
          ...noneBase,
          format: "cwt",
          decodedTyp: "application/cwt",
          expectedTyp: "application/cwt",
        }),
      ).not.toThrow();
    });
  });

  describe("required claims", () => {
    test("rejects a token missing required claims, listing ALL missing keys", () => {
      expect(() =>
        enforceVerifyFloor({
          ...base,
          payload: { ...validPayload, tokenId: undefined, clientId: undefined },
        }),
      ).toThrow(
        expect.objectContaining({
          code: "profile_policy_invalid",
          data: expect.objectContaining({
            direction: "verify",
            invalid: [
              { key: "clientId", message: 'Required claim "clientId" is missing' },
              { key: "tokenId", message: 'Required claim "tokenId" is missing' },
            ],
          }),
        }),
      );
    });

    test("counts an empty string as missing", () => {
      expect(() =>
        enforceVerifyFloor({
          ...base,
          payload: { ...validPayload, tokenId: "" },
        }),
      ).toThrow(
        expect.objectContaining({
          code: "profile_policy_invalid",
          data: expect.objectContaining({
            invalid: [{ key: "tokenId", message: 'Required claim "tokenId" is missing' }],
          }),
        }),
      );
    });

    test("counts null as missing", () => {
      expect(() =>
        enforceVerifyFloor({
          ...base,
          payload: { ...validPayload, subject: null },
        }),
      ).toThrow(
        expect.objectContaining({
          code: "profile_policy_invalid",
          data: expect.objectContaining({
            invalid: [{ key: "subject", message: 'Required claim "subject" is missing' }],
          }),
        }),
      );
    });

    test("passes a compliant delegation (jti present, iat absent and not required)", () => {
      expect(() =>
        enforceVerifyFloor({
          format: "jwt" as const,
          algorithm: "ES512",
          audience: RESOURCE,
          decodedTyp: "application/delegation+jwt",
          expectedIssuer: "client-1",
          profile: delegationProfile,
          payload: delegationPayload,
        }),
      ).not.toThrow();
    });

    test("rejects a delegation without jti", () => {
      expect(() =>
        enforceVerifyFloor({
          format: "jwt" as const,
          algorithm: "ES512",
          audience: RESOURCE,
          decodedTyp: "application/delegation+jwt",
          expectedIssuer: "client-1",
          profile: delegationProfile,
          payload: { ...delegationPayload, tokenId: undefined },
        }),
      ).toThrow(
        expect.objectContaining({
          code: "profile_policy_invalid",
          data: expect.objectContaining({
            invalid: [{ key: "tokenId", message: 'Required claim "tokenId" is missing' }],
          }),
        }),
      );
    });
  });

  // `forbidden` is the mirror of `required` and bites at verify for the same
  // reason: a profile verifying tokens minted elsewhere gets nothing from a
  // mint-time policy.
  describe("forbidden claims", () => {
    test("rejects a token carrying a claim the profile forbids", () => {
      expect(() =>
        enforceVerifyFloor({
          ...base,
          payload: { ...validPayload, federationAssuranceLevel: "fal2" },
        }),
      ).toThrow(
        expect.objectContaining({
          code: "profile_policy_invalid",
          data: expect.objectContaining({
            invalid: [
              {
                key: "federationAssuranceLevel",
                message: 'Forbidden claim "federationAssuranceLevel" is present',
              },
            ],
          }),
        }),
      );
    });

    test("lists ALL forbidden claims present", () => {
      expect(() =>
        enforceVerifyFloor({
          format: "jwt" as const,
          algorithm: "ES512",
          audience: RESOURCE,
          decodedTyp: undefined,
          expectedIssuer: ISSUER,
          profile: externalAccessTokenProfile,
          payload: {
            ...validPayload,
            clientId: undefined,
            nonce: "n-0S6",
            codeHash: "TT-mXNvl57l-BcINg6sBWQ",
          },
        }),
      ).toThrow(
        expect.objectContaining({
          code: "profile_policy_invalid",
          data: expect.objectContaining({
            invalid: [
              { key: "nonce", message: 'Forbidden claim "nonce" is present' },
              { key: "codeHash", message: 'Forbidden claim "codeHash" is present' },
            ],
          }),
        }),
      );
    });

    /**
     * A prohibition asks whether the TOKEN CARRIES THE KEY, and at verify that
     * question is exact: neither JSON nor CBOR can express `undefined`, so a key
     * present in the decoded payload always holds a real value and no emission
     * prune runs on a token being read. An empty one is a claim the issuer made
     * badly, not a claim it did not make.
     *
     * This previously read the other way — `""` and `null` passed the rule —
     * which is a fail-open on the profile whose `forbidden` list carries the
     * whole weight: `external_access_token` mandates no `typ`, so forbidding the
     * id_token claims is all that keeps an id_token out.
     */
    test.each([
      ["an empty string", ""],
      ["null", null],
    ])("refuses a forbidden claim carried as %s", (_label, value) => {
      expect(() =>
        enforceVerifyFloor({
          ...base,
          payload: { ...validPayload, federationAssuranceLevel: value },
        }),
      ).toThrow(
        expect.objectContaining({
          code: "profile_policy_invalid",
          data: expect.objectContaining({
            invalid: [
              {
                key: "federationAssuranceLevel",
                message: 'Forbidden claim "federationAssuranceLevel" is present',
              },
            ],
          }),
        }),
      );
    });

    test("passes a profile whose forbidden list is empty", () => {
      expect(() =>
        enforceVerifyFloor({
          format: "jwt" as const,
          algorithm: "ES512",
          audience: RESOURCE,
          decodedTyp: "application/delegation+jwt",
          expectedIssuer: "client-1",
          profile: delegationProfile,
          payload: { ...delegationPayload, nonce: "n-0S6" },
        }),
      ).not.toThrow();
    });
  });

  // `algClass` is the third mint/verify mirror in this floor. Mint makes it part
  // of the key SELECTION, which defends nobody reading a token minted elsewhere
  // — and "elsewhere" is the whole reason `external_access_token` exists.
  describe("algClass", () => {
    test("rejects a symmetric algorithm for an asymmetric-only profile", () => {
      expect(() =>
        enforceVerifyFloor({ ...base, algorithm: "HS256", payload: validPayload }),
      ).toThrow(
        expect.objectContaining({
          code: "algorithm_not_permitted",
          data: expect.objectContaining({ algorithm: "HS256" }),
        }),
      );
    });

    test("rejects alg none for an asymmetric-only profile", () => {
      expect(() =>
        enforceVerifyFloor({ ...base, algorithm: "none", payload: validPayload }),
      ).toThrow(expect.objectContaining({ code: "algorithm_not_permitted" }));
    });

    test("rejects an absent algorithm for an asymmetric-only profile", () => {
      expect(() =>
        enforceVerifyFloor({ ...base, algorithm: undefined, payload: validPayload }),
      ).toThrow(expect.objectContaining({ code: "algorithm_not_permitted" }));
    });

    test("passes an asymmetric algorithm for an asymmetric-only profile", () => {
      expect(() =>
        enforceVerifyFloor({ ...base, algorithm: "RS256", payload: validPayload }),
      ).not.toThrow();
    });

    // It rejects the CLASS the profile named, never algorithms in general: a
    // profile that declares none is unconstrained (RFC 8417 / SSF permits HS*).
    test("ignores the algorithm entirely for a profile with no algClass", () => {
      expect(() =>
        enforceVerifyFloor({
          format: "jwt" as const,
          algorithm: "HS256",
          audience: RESOURCE,
          decodedTyp: undefined,
          expectedIssuer: undefined,
          profile: defaultProfile,
          payload: {
            issuer: ISSUER,
            audience: [RESOURCE],
            subject: "user-1",
            expiresAt: new Date(1704099600 * 1000),
          },
        }),
      ).not.toThrow();
    });

    // It runs BEFORE the claim assertions: a token whose signing class the
    // profile refuses is not a token of that kind, whatever its claims say.
    test("reports the algorithm before a claim failure", () => {
      expect(() =>
        enforceVerifyFloor({
          ...base,
          format: "jwt" as const,
          algorithm: "HS256",
          payload: { ...validPayload, tokenId: undefined },
        }),
      ).toThrow(expect.objectContaining({ code: "algorithm_not_permitted" }));
    });
  });
});
