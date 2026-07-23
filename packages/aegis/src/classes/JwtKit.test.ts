import { B64 } from "@lindorm/b64";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import * as jsonwebtoken from "jsonwebtoken";
import MockDate from "mockdate";
import {
  TEST_AKP_KEY_SIG,
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_SIG,
  TEST_RSA_KEY_SIG,
} from "../__fixtures__/keys.js";
import { isObject } from "@lindorm/is";
import { assembleCommonClaims } from "../internal/utils/assemble-common-claims.js";
import {
  computeTypHeader,
  extractTypPrefix,
} from "../internal/utils/compute-typ-header.js";
import { domainToJose } from "../internal/claims/translate.js";
import { defaultProfile } from "../internal/profiles/definitions/default.js";
import type { SignContent, SignJwtOptions } from "../types/index.js";
import { JwtKit } from "./JwtKit.js";
import { beforeEach, describe, expect, test } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

// The kit is now WIRE-ONLY and TRANSFORM-FREE: `sign` serializes an
// already-jose-keyed claim dict verbatim. These tests exercise the full
// round-trip, so they assemble the default-profile claims (iss/iat/jti/nbf/exp
// injected) and translate them to the JOSE wire Aegis-side — exactly what
// `aegis.mint("default", …)` does — then hand the finished dict to `kit.sign`.
const signDefault = (
  kit: JwtKit,
  issuer: string,
  content: SignContent,
  options: SignJwtOptions = {},
) => {
  const common = assembleCommonClaims(
    { algorithm: kit.algorithm, issuer },
    defaultProfile,
    content,
    options,
  );
  const claims = domainToJose(
    isObject(content.profile) ? { ...common, ...content.profile } : common,
  );
  return kit.sign(claims, {
    header: options.header,
    omit: options.omit,
    // The kit takes a bare prefix and re-wraps it into the full media type.
    tokenType: extractTypPrefix(computeTypHeader(content.tokenType, "jwt")),
  });
};

describe("JwtKit", () => {
  const issuer = "https://test.lindorm.io/";

  let logger: ILogger;
  let kit: JwtKit;

  beforeEach(async () => {
    logger = createMockLogger();
    kit = new JwtKit({ logger, kryptos: TEST_EC_KEY_SIG });
  });

  describe("sign", () => {
    test("should sign token using EC", () => {
      expect(
        signDefault(
          kit,
          issuer,
          {
            expires: "1h",
            subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
            tokenType: "test_token",
          },
          { header: { oid: "test-object-id" } },
        ),
      ).toEqual(expect.any(String));
    });

    test("should sign token using OCT", () => {
      kit = new JwtKit({ logger, kryptos: TEST_OCT_KEY_SIG });

      expect(
        signDefault(
          kit,
          issuer,
          {
            expires: "1h",
            subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
            tokenType: "test_token",
          },
          { header: { oid: "test-object-id" } },
        ),
      ).toEqual(expect.any(String));
    });

    test("should sign token using OKP", () => {
      kit = new JwtKit({ logger, kryptos: TEST_OKP_KEY_SIG });

      expect(
        signDefault(
          kit,
          issuer,
          {
            expires: "1h",
            subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
            tokenType: "test_token",
          },
          { header: { oid: "test-object-id" } },
        ),
      ).toEqual(expect.any(String));
    });

    test("should sign token using RSA", () => {
      kit = new JwtKit({ logger, kryptos: TEST_RSA_KEY_SIG });

      expect(
        signDefault(
          kit,
          issuer,
          {
            expires: "1h",
            subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
            tokenType: "test_token",
          },
          { header: { oid: "test-object-id" } },
        ),
      ).toEqual(expect.any(String));
    });

    test("should sign token using AKP (ML-DSA)", () => {
      kit = new JwtKit({ logger, kryptos: TEST_AKP_KEY_SIG });

      const signed = signDefault(
        kit,
        issuer,
        {
          expires: "1h",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "test_token",
        },
        { header: { oid: "test-object-id" } },
      );

      expect(signed).toEqual(expect.any(String));

      // Round-trip: verify the ML-DSA-signed JWT validates without throwing.
      expect(() => kit.verify(signed)).not.toThrow();
    });

    test("should sign token without objectId and omit oid from header", () => {
      const token = signDefault(kit, issuer, {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      const { header } = JwtKit.decodeSegments(token);
      expect(header).not.toHaveProperty("oid");
    });

    test("serializes an already-wire claim dict VERBATIM (R18 — no name/case mapping)", () => {
      // A pre-cased mixed dict is signed exactly as given — the kit makes no
      // name or case decision.
      const token = kit.sign({
        iss: issuer,
        sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        exp: 1704099600,
        my_custom_flag: "enabled",
        alreadyCamel: 42,
      });

      const { payload } = JwtKit.decodeSegments(token);
      expect(payload).toEqual({
        iss: issuer,
        sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        exp: 1704099600,
        my_custom_flag: "enabled",
        alreadyCamel: 42,
      });
    });

    test("constructs the full media type from a typ PREFIX; absent/null floors to JWT", () => {
      // "at" (prefix) → application/at+jwt (the kit knows its format).
      const withTyp = kit.sign({ iss: issuer, exp: 1704099600 }, { tokenType: "at" });
      expect(JwtKit.decodeSegments(withTyp).header.typ).toBe("application/at+jwt");

      // A JWT always carries a typ header, so null/absent floors to "JWT".
      const nullTyp = kit.sign(
        { iss: issuer, exp: 1704099600 },
        { tokenType: undefined },
      );
      expect(JwtKit.decodeSegments(nullTyp).header.typ).toBe("JWT");

      const bare = kit.sign({ iss: issuer, exp: 1704099600 });
      expect(JwtKit.decodeSegments(bare).header.typ).toBe("JWT");
    });

    test("should carry authorization_details (RFC 9396) verbatim on the wire", () => {
      const authorizationDetails = [
        {
          type: "payment_initiation",
          actions: ["initiate", "status"],
          locations: ["https://api.bank.example.com/payments"],
          // Type-specific camelCase fields defined by the detail's own spec —
          // these MUST travel untouched (no snake_case conversion).
          instructedAmount: { currency: "EUR", amount: "123.50" },
          creditorAccount: { iban: "DE02100100109307118603" },
        },
      ];

      const token = signDefault(kit, issuer, {
        authorizationDetails,
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      const [, rawPayload] = token.split(".");
      const decoded = JSON.parse(B64.toString(rawPayload));

      // Wire claim name is snake_case, but the array contents are verbatim.
      expect(decoded.authorization_details).toMatchSnapshot();
      expect(decoded).not.toHaveProperty("authorizationDetails");

      // Verbatim-preservation anchor: the camelCase type-specific inner
      // fields survive the round trip on the wire untouched.
      expect(decoded.authorization_details[0].instructedAmount).toEqual({
        currency: "EUR",
        amount: "123.50",
      });
      expect(decoded.authorization_details[0].creditorAccount).toEqual({
        iban: "DE02100100109307118603",
      });
    });
  });

  describe("verify", () => {
    test("should verify token and resolve the WIRE payload", () => {
      const token = signDefault(kit, issuer, {
        accessToken:
          "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c",
        audience: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
        authCode: "999a8b01e27c56aeb5b2f47c001ef8be7be39a375f8c5e929f82df1626de01d8",
        authContextClassReference: "test_auth_context_class",
        authFactor: ["test_auth_factor"],
        authMethods: ["test_auth_method"],
        authorizedParty: "6099162c-3853-5a28-ade1-7f354b68b54b",
        authState: "7409ac52a9615b8c9f9a",
        authTime: new Date("2022-01-01T08:00:00.000Z"),
        claims: { test_claim: "test_value" },
        clientId: "1782154a-385a-56cc-b504-380f0ba4c012",
        expires: "1h",
        grantType: "test_grant_type",
        levelOfAssurance: 4,
        nonce: "24d63b3e0be0538890b1",
        notBefore: new Date("2022-01-01T08:00:00.000Z"),
        permissions: ["test_permission"],
        roles: ["test_role"],
        scope: ["test_scope"],
        sessionHint: "test_session_hint",
        sessionId: "d5d79807-52c2-5ac1-a3f1-fc5fe8b9e9af",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        subjectHint: "test_subject_hint",
        tenantId: "55103fbe-a183-57ec-b553-13af34d83c23",
        tokenType: "test_token",
        vectorOfTrust: "P1.Cc.Ce.Aa",
        vectorTrustMark: "https://trustmark.lindorm.io/vot/P1.Cc.Ce.Aa",
      });

      // The tokenId is a domain convenience the wire kit no longer returns; read
      // it back off the wire jti.
      const tokenId = JwtKit.decodeSegments(token).payload.jti;

      const wirePayload = {
        acr: "test_auth_context_class",
        afr: ["test_auth_factor"],
        amr: ["test_auth_method"],
        at_hash: "ehXwFopDjJcovgdtD6uhQhwII5E___tRO573XDWUJ5Q",
        aud: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
        auth_time: 1641024000,
        azp: "6099162c-3853-5a28-ade1-7f354b68b54b",
        c_hash: "fIneZFxzOJe9_Wsdzc1yaLDmSDkYjy9_G6XDDDLbEos",
        client_id: "1782154a-385a-56cc-b504-380f0ba4c012",
        exp: 1704099600,
        gty: "test_grant_type",
        iat: 1704096000,
        iss: "https://test.lindorm.io/",
        jti: tokenId,
        loa: 4,
        nbf: 1641024000,
        nonce: "24d63b3e0be0538890b1",
        permissions: ["test_permission"],
        roles: ["test_role"],
        s_hash: "LpadyLdMV2YGBJvsrNsr0CDlm38M7SR_OSWVQsyD6Rc",
        scope: ["test_scope"],
        sid: "d5d79807-52c2-5ac1-a3f1-fc5fe8b9e9af",
        sih: "test_session_hint",
        sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        suh: "test_subject_hint",
        test_claim: "test_value",
        tenant_id: "55103fbe-a183-57ec-b553-13af34d83c23",
        vot: "P1.Cc.Ce.Aa",
        vtm: "https://trustmark.lindorm.io/vot/P1.Cc.Ce.Aa",
      };

      expect(kit.verify(token)).toEqual({
        header: {
          alg: "ES512",
          cty: "application/json",
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: TEST_EC_KEY_SIG.id,
          typ: "application/test_token+jwt",
        },
        payload: wirePayload,
        token,
      });
    });

    test("should verify token with EC", () => {
      const token = signDefault(kit, issuer, {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      expect(() => kit.verify(token)).not.toThrow();
    });

    test("should verify token with OCT", () => {
      kit = new JwtKit({ logger, kryptos: TEST_OCT_KEY_SIG });

      const token = signDefault(kit, issuer, {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      expect(() => kit.verify(token)).not.toThrow();
    });

    test("should verify token with OKP", () => {
      kit = new JwtKit({ logger, kryptos: TEST_OKP_KEY_SIG });

      const token = signDefault(kit, issuer, {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      expect(() => kit.verify(token)).not.toThrow();
    });

    test("should verify token with RSA", () => {
      kit = new JwtKit({ logger, kryptos: TEST_RSA_KEY_SIG });

      const token = signDefault(kit, issuer, {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      expect(() => kit.verify(token)).not.toThrow();
    });

    test("runs a caller-supplied WIRE assert predicate against the payload", () => {
      const token = signDefault(kit, issuer, {
        audience: ["saga", "mimir"],
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      // Wire-keyed predicate — the kit runs it verbatim (no domain translation).
      expect(() => kit.verify(token, { aud: { $all: ["saga"] } })).not.toThrow();
      expect(() => kit.verify(token, { sub: "wrong" })).toThrow(/Invalid token/);
    });
  });

  describe("temporal-in-kit (R10)", () => {
    // The wire kit is a standalone verifier: it range-checks exp/nbf/iat against
    // "now" with clock tolerance, validated IF PRESENT.
    test("rejects an expired token (exp in the past)", () => {
      const token = kit.sign({ iss: issuer, sub: "s", exp: 1704092400 }); // 07:00, now is 08:00
      expect(() => kit.verify(token)).toThrow(/Invalid token/);
    });

    test("accepts an expired token within clock tolerance", () => {
      const tolerant = new JwtKit({
        logger,
        kryptos: TEST_EC_KEY_SIG,
        clockTolerance: 7200,
      });
      const token = tolerant.sign({ iss: issuer, sub: "s", exp: 1704092400 });
      expect(() => tolerant.verify(token)).not.toThrow();
    });

    test("rejects a not-yet-valid token (nbf in the future)", () => {
      const token = kit.sign({ iss: issuer, sub: "s", nbf: 1704103200 }); // 10:00
      expect(() => kit.verify(token)).toThrow(/Invalid token/);
    });

    test("rejects a token issued in the future (iat ahead of now)", () => {
      const token = kit.sign({ iss: issuer, sub: "s", iat: 1704103200 }); // 10:00
      expect(() => kit.verify(token)).toThrow(/Invalid token/);
    });

    test("tolerates absent temporal claims (validated only if present)", () => {
      const token = kit.sign({ iss: issuer, sub: "s" });
      expect(() => kit.verify(token)).not.toThrow();
    });

    test("per-call clockTolerance overrides the constructor default", () => {
      const token = kit.sign({ iss: issuer, sub: "s", exp: 1704092400 });
      expect(() => kit.verify(token, undefined, { clockTolerance: 7200 })).not.toThrow();
    });
  });

  // The kit throws JwtError("Invalid token") for the structural failures; the
  // discriminating detail is the `code`, so assert on that.
  const codeOf = (fn: () => unknown): string | undefined => {
    try {
      fn();
    } catch (err) {
      return (err as { code?: string }).code;
    }
    return undefined;
  };

  describe("kid fail-fast", () => {
    test("throws before the signature cycle when the token kid differs from the key", () => {
      // Sign with a DIFFERENT key so the token carries the other key's kid.
      const other = new JwtKit({ logger, kryptos: TEST_RSA_KEY_SIG });
      const token = other.sign({ iss: issuer, sub: "s", exp: 1704099600 });

      expect(codeOf(() => kit.verify(token))).toBe("jwt_kid_mismatch");
    });

    test("verifies when the token kid matches the configured key", () => {
      const token = kit.sign({ iss: issuer, sub: "s", exp: 1704099600 });
      expect(() => kit.verify(token)).not.toThrow();
    });
  });

  describe("typ assertion", () => {
    test("rejects a token whose typ does not match the options.typ prefix", () => {
      // Prefix "at" → header application/at+jwt; verify asserts against the same
      // media type the kit builds from the given prefix.
      const token = kit.sign(
        { iss: issuer, sub: "s", exp: 1704099600 },
        { tokenType: "at" },
      );

      expect(codeOf(() => kit.verify(token, undefined, { tokenType: "rt" }))).toBe(
        "jwt_typ_mismatch",
      );
      expect(() => kit.verify(token, undefined, { tokenType: "at" })).not.toThrow();
    });

    test("rejects a present typ that is not a JWT media type", () => {
      // Craft a header with a non-JWT typ (the sign floor would never emit one).
      const token = kit.sign({ iss: issuer, sub: "s", exp: 1704099600 });
      const decoded = JwtKit.decodeSegments(token);
      const parts = token.split(".");
      const modifiedHeader = Buffer.from(
        JSON.stringify({ ...decoded.header, typ: "not-a-jwt-typ" }),
      )
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(codeOf(() => kit.verify(modifiedToken))).toBe("jwt_invalid_typ");
    });

    test("accepts a typ-less token (presence is a domain policy)", () => {
      // Strip the typ header entirely — the wire kit tolerates a typ-less token;
      // presence is enforced Aegis-side.
      const token = kit.sign({ iss: issuer, sub: "s", exp: 1704099600 });
      const decoded = JwtKit.decodeSegments(token);
      const { typ: _typ, ...headerNoTyp } = decoded.header;
      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerNoTyp))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      // Signature is broken by the header edit, but the point is that a typ-less
      // token reaches the signature check (not rejected for the missing typ).
      expect(codeOf(() => kit.verify(modifiedToken))).toBe("jwt_signature_invalid");
    });
  });

  describe("decode", () => {
    test("should decode token", () => {
      const token = signDefault(kit, issuer, {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      expect(JwtKit.decodeSegments(token)).toEqual({
        header: {
          alg: "ES512",
          cty: "application/json",
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          typ: "application/test_token+jwt",
        },
        payload: {
          exp: 1704099600,
          iat: 1704096000,
          iss: "https://test.lindorm.io/",
          jti: expect.any(String),
          nbf: 1704096000,
          sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        },
        signature: expect.any(String),
      });
    });
  });

  describe("external validation", () => {
    describe("sign", () => {
      test("should sign tokens that other packages can decode", () => {
        const token = signDefault(kit, issuer, {
          expires: "1h",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "test_token",
        });

        const {
          signature,
          payload: { jti },
        } = JwtKit.decodeSegments(token);

        expect(jsonwebtoken.decode(token, { complete: true })).toEqual({
          header: {
            alg: "ES512",
            cty: "application/json",
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: TEST_EC_KEY_SIG.id,
            typ: "application/test_token+jwt",
          },
          payload: {
            exp: 1704099600,
            iat: 1704096000,
            iss: "https://test.lindorm.io/",
            jti: jti,
            nbf: 1704096000,
            sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          },
          signature: signature,
        });
      });

      test("should sign EC tokens that other packages can verify", () => {
        const token = signDefault(kit, issuer, {
          expires: "1h",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "test_token",
        });

        const {
          payload: { jti },
        } = JwtKit.decodeSegments(token);

        const { privateKey } = TEST_EC_KEY_SIG.export("pem");

        expect(jsonwebtoken.verify(token, privateKey!)).toEqual({
          exp: 1704099600,
          iat: 1704096000,
          iss: "https://test.lindorm.io/",
          jti: jti,
          nbf: 1704096000,
          sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        });
      });

      test("should sign OCT tokens that other packages can verify", () => {
        kit = new JwtKit({ logger, kryptos: TEST_OCT_KEY_SIG });

        const token = signDefault(kit, issuer, {
          expires: "1h",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "test_token",
        });

        const decoded = JwtKit.decodeSegments(token);

        const { privateKey } = TEST_OCT_KEY_SIG.export("der");

        expect(jsonwebtoken.verify(token, privateKey!)).toEqual({
          exp: 1704099600,
          iat: 1704096000,
          iss: "https://test.lindorm.io/",
          jti: decoded.payload.jti,
          nbf: 1704096000,
          sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        });
      });

      test("should sign RSA tokens that other packages can verify", () => {
        kit = new JwtKit({ logger, kryptos: TEST_RSA_KEY_SIG });

        const token = signDefault(kit, issuer, {
          expires: "1h",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "test_token",
        });

        const {
          payload: { jti },
        } = JwtKit.decodeSegments(token);

        const { publicKey } = TEST_RSA_KEY_SIG.export("pem");

        expect(jsonwebtoken.verify(token, publicKey!)).toEqual({
          exp: 1704099600,
          iat: 1704096000,
          iss: "https://test.lindorm.io/",
          jti: jti,
          nbf: 1704096000,
          sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        });
      });
    });

    describe("verify", () => {
      test("should verify EC tokens that other packages have signed", () => {
        const { privateKey } = TEST_EC_KEY_SIG.export("pem");

        const token = jsonwebtoken.sign(
          { subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad" },
          privateKey!,
          {
            algorithm: "ES512",
            expiresIn: "1h",
            issuer: "https://test.lindorm.io/",
            keyid: TEST_EC_KEY_SIG.id,
          },
        );

        expect(() => kit.verify(token)).not.toThrow();
      });

      test("should verify OCT tokens that other packages have signed", () => {
        kit = new JwtKit({ logger, kryptos: TEST_OCT_KEY_SIG });

        const { privateKey } = TEST_OCT_KEY_SIG.export("der");

        const token = jsonwebtoken.sign(
          { subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad" },
          privateKey!,
          {
            algorithm: "HS256",
            expiresIn: "1h",
            issuer: "https://test.lindorm.io/",
            keyid: TEST_OCT_KEY_SIG.id,
          },
        );

        expect(() => kit.verify(token)).not.toThrow();
      });

      test("should verify RSA tokens that other packages have signed", () => {
        kit = new JwtKit({ logger, kryptos: TEST_RSA_KEY_SIG });

        const { privateKey } = TEST_RSA_KEY_SIG.export("pem");

        const token = jsonwebtoken.sign(
          { subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad" },
          privateKey!,
          {
            algorithm: "RS512",
            expiresIn: "1h",
            issuer: "https://test.lindorm.io/",
            keyid: TEST_RSA_KEY_SIG.id,
          },
        );

        expect(() => kit.verify(token)).not.toThrow();
      });
    });
  });

  describe("critical header parameter rejection", () => {
    test("should reject RFC-valid token with an extension critical parameter aegis does not implement", () => {
      const token = signDefault(kit, issuer, {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      // Craft a well-formed header with a non-registered crit parameter that
      // is actually present. Aegis should reject because the extension is
      // unknown to it, even though the header itself is RFC-compliant.
      const decoded = JwtKit.decodeSegments(token);
      const headerWithCrit = {
        ...decoded.header,
        crit: ["lindorm_ext"],
        lindorm_ext: "some-value",
      };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(
        "Unsupported critical header parameter: lindorm_ext",
      );
    });

    test("should reject malformed crit listing a parameter not present in the header", () => {
      const token = signDefault(kit, issuer, {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      const decoded = JwtKit.decodeSegments(token);
      const headerWithCrit = { ...decoded.header, crit: ["missing_ext"] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(/not present/);
    });

    test("should reject crit containing an IANA-registered parameter name", () => {
      const token = signDefault(kit, issuer, {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      const decoded = JwtKit.decodeSegments(token);
      const headerWithCrit = { ...decoded.header, crit: ["alg"] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(/IANA-registered/);
    });

    test("should reject crit that is an empty array", () => {
      const token = signDefault(kit, issuer, {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      const decoded = JwtKit.decodeSegments(token);
      const headerWithCrit = { ...decoded.header, crit: [] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(/empty/);
    });

    test("should accept token with empty critical array", () => {
      const token = signDefault(kit, issuer, {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      expect(() => kit.verify(token)).not.toThrow();
    });
  });

  describe("header-embedded key source rejection", () => {
    // These tests lock in the invariant that aegis NEVER uses header-embedded
    // key material (jwk, x5c, x5u) for verification. The kit verifies against
    // its configured kryptos only.

    test("a malicious jwk in the header must not be usable to verify the token", () => {
      const token = signDefault(kit, issuer, {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      const decoded = JwtKit.decodeSegments(token);
      const headerWithJwk = {
        ...decoded.header,
        jwk: {
          kty: "EC",
          crv: "P-521",
          x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          y: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        },
      };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithJwk))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow();
    });

    test("a malicious x5c in the header must not be usable to verify the token", () => {
      const token = signDefault(kit, issuer, {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      const decoded = JwtKit.decodeSegments(token);
      const headerWithX5c = {
        ...decoded.header,
        x5c: ["MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA"],
      };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithX5c))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow();
    });

    test("a malicious x5u in the header must not be fetched or used to verify the token", () => {
      const token = signDefault(kit, issuer, {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      const decoded = JwtKit.decodeSegments(token);
      const headerWithX5u = {
        ...decoded.header,
        x5u: "https://attacker.example/evil-cert.pem",
      };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithX5u))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      // Aegis must not make any HTTP request here; x5u is ignored outright.
      // The verify throws because the header change broke the signature.
      expect(() => kit.verify(modifiedToken)).toThrow();
    });
  });

  describe("confirmation claim (wire)", () => {
    test("should round-trip a DPoP thumbprint on the wire", () => {
      const token = signDefault(
        kit,
        issuer,
        {
          expires: "1h",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "access_token",
          confirmation: {
            thumbprint: "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I",
          },
        },
        { tokenId: "stable-token-id" },
      );

      const decoded = JwtKit.decodeSegments(token);
      expect(decoded.payload).toMatchSnapshot("wire payload — jkt only");
    });

    test("should round-trip all confirmation members on the wire", () => {
      const token = signDefault(
        kit,
        issuer,
        {
          expires: "1h",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "access_token",
          confirmation: {
            thumbprint: "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I",
            mtlsCertThumbprint: "A4DtL2JmUMhAsvJj5tKyn64SqzmuXbMrJa0n761y5v0",
            keyId: "test-key-id",
            jwkSetUri: "https://example.com/.well-known/jwks.json",
          },
        },
        { tokenId: "stable-token-id-full" },
      );

      const decoded = JwtKit.decodeSegments(token);
      expect(decoded.payload).toMatchSnapshot("wire payload — full cnf");
    });

    test("should omit cnf entirely when confirmation is not provided", () => {
      const token = signDefault(kit, issuer, {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "access_token",
      });

      const decoded = JwtKit.decodeSegments(token);
      expect(decoded.payload).not.toHaveProperty("cnf");
    });
  });

  // R10 temporal overrides — the mocked "now" is 2024-01-01T08:00:00Z (unix
  // 1704096000). `currentDate` replaces that instant; `maxTokenAge` bounds `iat`.
  describe("temporal overrides (R10 — currentDate / maxTokenAge)", () => {
    test("currentDate overrides now: a token expired vs the real clock verifies against a past currentDate", () => {
      // exp at 07:00 — one hour BEFORE the mocked 08:00 now, so it is expired.
      const token = kit.sign({ iss: issuer, exp: 1704092400 });

      // Against the real (mocked) now the token is rejected …
      expect(() => kit.verify(token)).toThrow();

      // … but against a currentDate of 06:30 the exp (07:00) is still in the
      // future, so the same token verifies.
      expect(() =>
        kit.verify(token, undefined, { currentDate: new Date(1704090600 * 1000) }),
      ).not.toThrow();
    });

    test("maxTokenAge accepts a fresh iat and rejects a stale one", () => {
      // iat 60s ago (07:59), exp in the future (09:00).
      const fresh = kit.sign({ iss: issuer, iat: 1704095940, exp: 1704099600 });
      expect(() => kit.verify(fresh, undefined, { maxTokenAge: 300 })).not.toThrow();

      // iat 10 minutes ago (07:50) — older than the 5-minute maxTokenAge.
      const stale = kit.sign({ iss: issuer, iat: 1704095400, exp: 1704099600 });
      expect(() => kit.verify(stale, undefined, { maxTokenAge: 300 })).toThrow();
    });

    test("maxTokenAge requires iat to be present", () => {
      const noIat = kit.sign({ iss: issuer, exp: 1704099600 });
      expect(() => kit.verify(noIat, undefined, { maxTokenAge: 300 })).toThrow();
    });
  });
});
