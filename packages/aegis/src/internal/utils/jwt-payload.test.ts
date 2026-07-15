import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { JwtKit } from "../../classes/JwtKit.js";
import type { SignJwtContent } from "../../types/index.js";
import { parseTokenPayload } from "./jwt-payload.js";

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
    const payload = parseTokenPayload(assertionClaims);

    expect(payload.issuedAt).toBeUndefined();
    expect(payload).toMatchSnapshot();
  });

  test("should parse a token with an iat", () => {
    const payload = parseTokenPayload({ ...assertionClaims, iat: 1704096000 });

    expect(payload.issuedAt).toEqual(new Date("2024-01-01T08:00:00.000Z"));
    expect(payload).toMatchSnapshot();
  });

  test("should reject a token with no exp", () => {
    const { exp: _exp, ...withoutExp } = assertionClaims;

    expect(() => parseTokenPayload(withoutExp)).toThrow(
      expect.objectContaining({ code: "jwt_missing_claim_exp" }),
    );
  });

  test("should reject a token with no iss", () => {
    const { iss: _iss, ...withoutIss } = assertionClaims;

    expect(() => parseTokenPayload(withoutIss)).toThrow(
      expect.objectContaining({ code: "jwt_missing_claim_iss" }),
    );
  });

  // The #15 bug: `isString("")` is true, so an empty issuer slipped through.
  test("should reject a token with an empty-string iss", () => {
    expect(() => parseTokenPayload({ ...assertionClaims, iss: "" })).toThrow(
      expect.objectContaining({ code: "jwt_missing_claim_iss" }),
    );
  });

  // ...but an opaque client_id issuer (RFC 7523 client assertion) is NOT a URI and
  // must still parse — the gate is non-empty, not URI.
  test("should accept an opaque client_id issuer", () => {
    expect(parseTokenPayload({ ...assertionClaims, iss: "client-1" }).issuer).toBe(
      "client-1",
    );
  });
});

describe("JwtKit.parse (iat presence)", () => {
  let kit: JwtKit;

  beforeEach(() => {
    kit = new JwtKit({
      issuer: ISSUER,
      logger: createMockLogger(),
      kryptos: TEST_EC_KEY_SIG,
    });
  });

  // signClaims signs the wire claims verbatim (no auto-injection), so it is the
  // way to put an iat-less assertion on the wire; typ "JWT" is what RFC 7523
  // assertions carry when they carry one at all.
  const assertionContent: SignJwtContent = {
    expires: "2m",
    subject: "client-1",
    tokenType: "client_assertion",
  };

  test("should parse a signed client assertion that omits iat", () => {
    const { token } = kit.signClaims(assertionClaims, assertionContent, { typ: "JWT" });

    const { payload } = JwtKit.parse(token);

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
    const { token } = kit.signClaims(
      { ...assertionClaims, iat: 1704096000 },
      assertionContent,
      { typ: "JWT" },
    );

    const { payload } = JwtKit.parse(token);

    expect(payload.issuedAt).toEqual(new Date("2024-01-01T08:00:00.000Z"));
  });
});
