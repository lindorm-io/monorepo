import { describe, expect, test } from "vitest";
import { JwtError } from "../../errors/index.js";
import { accessTokenProfile } from "../profiles/definitions/access-token.js";
import { defaultProfile } from "../profiles/definitions/default.js";
import { delegationProfile } from "../profiles/definitions/delegation.js";
import { securityEventProfile } from "../profiles/definitions/security-event.js";
import { enforceVerifyFloor } from "./enforce-verify-floor.js";

const ISSUER = "https://test.lindorm.io/";
const RESOURCE = "https://rs.lindorm.io/";

const base = {
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
    ).toThrow(JwtError);
  });

  test("rejects when aud does not contain self", () => {
    expect(() =>
      enforceVerifyFloor({
        ...base,
        payload: { ...validPayload, audience: ["https://elsewhere"] },
      }),
    ).toThrow(JwtError);
  });

  test("rejects a missing exp when the profile mandates a lifetime", () => {
    expect(() =>
      enforceVerifyFloor({
        ...base,
        payload: { ...validPayload, expiresAt: undefined },
      }),
    ).toThrow(expect.objectContaining({ code: "jwt_missing_claim_exp" }));
  });

  test("does NOT require exp when the profile lifetime is null (SET)", () => {
    expect(() =>
      enforceVerifyFloor({
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
      ).toThrow(expect.objectContaining({ code: "jwt_typ_mismatch" }));
    });

    test("rejects a typ mismatch", () => {
      expect(() =>
        enforceVerifyFloor({
          ...base,
          decodedTyp: "application/logout+jwt",
          payload: validPayload,
        }),
      ).toThrow(expect.objectContaining({ code: "jwt_typ_mismatch" }));
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
          decodedTyp: undefined,
          expectedTyp: "application/cwt",
        }),
      ).toThrow(expect.objectContaining({ code: "jwt_typ_mismatch" }));

      expect(() =>
        enforceVerifyFloor({
          ...noneBase,
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
          code: "jwt_required_claims_missing",
          data: { missing: ["clientId", "tokenId"] },
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
          code: "jwt_required_claims_missing",
          data: { missing: ["tokenId"] },
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
          code: "jwt_required_claims_missing",
          data: { missing: ["subject"] },
        }),
      );
    });

    test("passes a compliant delegation (jti present, iat absent and not required)", () => {
      expect(() =>
        enforceVerifyFloor({
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
          audience: RESOURCE,
          decodedTyp: "application/delegation+jwt",
          expectedIssuer: "client-1",
          profile: delegationProfile,
          payload: { ...delegationPayload, tokenId: undefined },
        }),
      ).toThrow(
        expect.objectContaining({
          code: "jwt_required_claims_missing",
          data: { missing: ["tokenId"] },
        }),
      );
    });
  });
});
