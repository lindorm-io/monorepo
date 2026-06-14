import { describe, expect, test } from "vitest";
import { JwtError } from "../../errors/index.js";
import { accessTokenProfile } from "../profiles/definitions/access-token.js";
import { securityEventProfile } from "../profiles/definitions/security-event.js";
import { enforceVerifyFloor } from "./enforce-verify-floor.js";

const ISSUER = "https://test.lindorm.io/";
const RESOURCE = "https://rs.lindorm.io/";

const base = {
  audience: RESOURCE,
  decodedTyp: "at+jwt",
  expectedIssuer: ISSUER,
  profile: accessTokenProfile,
};

const validPayload = {
  iss: ISSUER,
  aud: [RESOURCE],
  exp: 1704099600,
};

describe("enforceVerifyFloor", () => {
  test("passes for a conformant token", () => {
    expect(() => enforceVerifyFloor({ ...base, payload: validPayload })).not.toThrow();
  });

  test("rejects a typ mismatch", () => {
    expect(() =>
      enforceVerifyFloor({ ...base, decodedTyp: "logout+jwt", payload: validPayload }),
    ).toThrow(JwtError);
  });

  test("rejects an issuer mismatch", () => {
    expect(() =>
      enforceVerifyFloor({
        ...base,
        payload: { ...validPayload, iss: "https://other/" },
      }),
    ).toThrow(JwtError);
  });

  test("rejects when aud does not contain self", () => {
    expect(() =>
      enforceVerifyFloor({
        ...base,
        payload: { ...validPayload, aud: ["https://elsewhere"] },
      }),
    ).toThrow(JwtError);
  });

  test("rejects a missing exp when the profile mandates a lifetime", () => {
    expect(() =>
      enforceVerifyFloor({
        ...base,
        payload: { iss: ISSUER, aud: [RESOURCE] },
      }),
    ).toThrow(JwtError);
  });

  test("does NOT require exp when the profile lifetime is null (SET)", () => {
    expect(() =>
      enforceVerifyFloor({
        audience: RESOURCE,
        decodedTyp: "secevent+jwt",
        expectedIssuer: ISSUER,
        profile: securityEventProfile,
        payload: { iss: ISSUER, aud: [RESOURCE] },
      }),
    ).not.toThrow();
  });
});
