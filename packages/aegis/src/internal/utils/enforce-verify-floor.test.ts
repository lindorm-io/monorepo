import { describe, expect, test } from "vitest";
import { JwtError } from "../../errors/index.js";
import { accessTokenProfile } from "../profiles/definitions/access-token.js";
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

// DOMAIN-keyed payload (the floor now consumes `parsed.payload`, not raw wire claims).
const validPayload = {
  issuer: ISSUER,
  audience: [RESOURCE],
  expiresAt: new Date(1704099600 * 1000),
};

describe("enforceVerifyFloor", () => {
  test("passes for a conformant token", () => {
    expect(() => enforceVerifyFloor({ ...base, payload: validPayload })).not.toThrow();
  });

  test("rejects a typ mismatch", () => {
    expect(() =>
      enforceVerifyFloor({
        ...base,
        decodedTyp: "application/logout+jwt",
        payload: validPayload,
      }),
    ).toThrow(JwtError);
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
        payload: { issuer: ISSUER, audience: [RESOURCE] },
      }),
    ).toThrow(JwtError);
  });

  test("does NOT require exp when the profile lifetime is null (SET)", () => {
    expect(() =>
      enforceVerifyFloor({
        audience: RESOURCE,
        decodedTyp: "application/secevent+jwt",
        expectedIssuer: ISSUER,
        profile: securityEventProfile,
        payload: { issuer: ISSUER, audience: [RESOURCE] },
      }),
    ).not.toThrow();
  });
});
