import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { JwtKit } from "../../classes/JwtKit.js";
import { buildSignedJwt, parseTokenPayload } from "./jwt-payload.js";
import { parseJwtToDomain } from "./parse-jwt.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

// The RFC 7523 §3 client-assertion shape: exp is REQUIRED, iat only OPTIONAL.
const assertionClaims = {
  iss: "client-1",
  sub: "client-1",
  aud: [ISSUER],
  exp: 1704096120,
  jti: "assertion-1",
};

describe("parseTokenPayload", () => {
  test("should parse an RFC 7523 client assertion with no iat", () => {
    const payload = parseTokenPayload(assertionClaims, false);

    expect(payload.issuedAt).toBeUndefined();
    expect(payload).toMatchSnapshot();
  });

  test("should parse a token with an iat", () => {
    const payload = parseTokenPayload({ ...assertionClaims, iat: 1704096000 }, false);

    expect(payload.issuedAt).toEqual(new Date("2024-01-01T08:00:00.000Z"));
    expect(payload).toMatchSnapshot();
  });

  // exp PRESENCE is policy (verify floor / expPresence), not structure: an
  // RFC 8417 / SSF security_event SET carries no exp yet must parse.
  test("should parse a token with no exp (expiresAt undefined)", () => {
    const { exp: _exp, ...withoutExp } = assertionClaims;

    const payload = parseTokenPayload(withoutExp, false);

    expect(payload.expiresAt).toBeUndefined();
    expect(payload).toMatchSnapshot();
  });

  // subject/tokenId are OPTIONAL — an absent sub/jti stays undefined, never a
  // fabricated "unknown" sentinel. Only iss is structurally required at parse.
  test("should leave subject and tokenId undefined when sub/jti are absent", () => {
    const payload = parseTokenPayload({ iss: "client-1", exp: 1704096120 }, false);

    expect(payload.subject).toBeUndefined();
    expect(payload.tokenId).toBeUndefined();
    expect(payload).toMatchSnapshot();
  });

  test("should reject a token with no iss", () => {
    const { iss: _iss, ...withoutIss } = assertionClaims;

    expect(() => parseTokenPayload(withoutIss, false)).toThrow(
      expect.objectContaining({ code: "jwt_missing_claim_iss" }),
    );
  });

  // The #15 bug: `isString("")` is true, so an empty issuer slipped through.
  test("should reject a token with an empty-string iss", () => {
    expect(() => parseTokenPayload({ ...assertionClaims, iss: "" }, false)).toThrow(
      expect.objectContaining({ code: "jwt_missing_claim_iss" }),
    );
  });

  // ...but an opaque client_id issuer (RFC 7523 client assertion) is NOT a URI and
  // must still parse — the gate is non-empty, not URI.
  test("should accept an opaque client_id issuer", () => {
    expect(parseTokenPayload({ ...assertionClaims, iss: "client-1" }, false).issuer).toBe(
      "client-1",
    );
  });

  // OIDC Core §13.3 honour-only-when-encrypted: the FLAT sensitive claims are
  // registered (registry `category: "sensitive"`), so they resolve into the
  // domain layer like any other claim — but they only reach the sensitive bucket
  // when the token was encrypted.
  const withSensitive = {
    ...assertionClaims,
    national_identity_number: "19900101-1234",
    national_identity_number_verified: true,
  };

  test("HONORS flat sensitive claims into the sensitive bucket when encrypted=true", () => {
    const payload = parseTokenPayload(withSensitive, true);

    expect(payload.sensitiveIdentity).toEqual({
      nationalIdentityNumber: "19900101-1234",
      nationalIdentityNumberVerified: true,
    });
    // Never leaked into the standard/custom buckets.
    expect(payload).not.toHaveProperty("nationalIdentityNumber");
    expect(payload.claims).not.toHaveProperty("nationalIdentityNumber");
  });

  test("SUPPRESSES flat sensitive claims entirely when encrypted=false", () => {
    const payload = parseTokenPayload(withSensitive, false);

    expect(payload.sensitiveIdentity).toBeUndefined();
    expect(payload).not.toHaveProperty("nationalIdentityNumber");
    expect(payload.claims).not.toHaveProperty("nationalIdentityNumber");
  });
});

describe("buildSignedJwt (domain sugar over the wire kit's { token })", () => {
  const token = "header.payload.signature";

  test("derives the expiry bundle from the wire exp and tokenId from jti", () => {
    expect(buildSignedJwt(token, { exp: 1704099600, jti: "jti-1" }, "obj-1")).toEqual({
      expiresAt: new Date("2024-01-01T09:00:00.000Z"),
      expiresIn: 3600,
      expiresOn: 1704099600,
      objectId: "obj-1",
      token,
      tokenId: "jti-1",
    });
  });

  test("leaves the expiry bundle and tokenId undefined when exp/jti are absent", () => {
    expect(buildSignedJwt(token, { sub: "s" }, undefined)).toEqual({
      expiresAt: undefined,
      expiresIn: undefined,
      expiresOn: undefined,
      objectId: undefined,
      token,
      tokenId: undefined,
    });
  });
});

describe("parseJwtToDomain (iat presence)", () => {
  let kit: JwtKit;

  beforeEach(() => {
    kit = new JwtKit({
      logger: createMockLogger(),
      kryptos: TEST_EC_KEY_SIG,
    });
  });

  // The transform-free kit signs the wire claims verbatim (no auto-injection),
  // so it is the way to put an iat-less assertion on the wire; typ "JWT" is what
  // RFC 7523 assertions carry when they carry one at all.
  test("should parse a signed client assertion that omits iat", () => {
    const token = kit.sign(assertionClaims);

    const { payload } = parseJwtToDomain(token);

    expect(payload.issuedAt).toBeUndefined();
    expect(payload).toMatchObject({
      issuer: "client-1",
      subject: "client-1",
      audience: [ISSUER],
      tokenId: "assertion-1",
      expiresAt: new Date("2024-01-01T08:02:00.000Z"),
    });
  });

  test("should parse a signed token that carries iat", () => {
    const token = kit.sign({ ...assertionClaims, iat: 1704096000 });

    const { payload } = parseJwtToDomain(token);

    expect(payload.issuedAt).toEqual(new Date("2024-01-01T08:00:00.000Z"));
  });
});
