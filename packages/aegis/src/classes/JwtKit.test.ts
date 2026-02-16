import { ILogger, createMockLogger } from "@lindorm/logger";
import * as jsonwebtoken from "jsonwebtoken";
import MockDate from "mockdate";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_SIG,
  TEST_RSA_KEY_SIG,
} from "../__fixtures__/keys";
import { SignJwtContent } from "../types";
import { JwtKit } from "./JwtKit";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("JwtKit", () => {
  const issuer = "https://test.lindorm.io/";

  let logger: ILogger;
  let kit: JwtKit;

  beforeEach(async () => {
    logger = createMockLogger();
    kit = new JwtKit({ issuer, logger, kryptos: TEST_EC_KEY_SIG });
  });

  describe("sign", () => {
    test("should sign token using EC", () => {
      expect(
        kit.sign({
          expires: "1h",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "test_token",
        }),
      ).toEqual({
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
        expiresIn: 3600,
        expiresOn: 1704099600,
        objectId: expect.any(String),
        token: expect.any(String),
        tokenId: expect.any(String),
      });
    });

    test("should sign token using OCT", () => {
      kit = new JwtKit({ issuer, logger, kryptos: TEST_OCT_KEY_SIG });

      expect(
        kit.sign({
          expires: "1h",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "test_token",
        }),
      ).toEqual({
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
        expiresIn: 3600,
        expiresOn: 1704099600,
        objectId: expect.any(String),
        token: expect.any(String),
        tokenId: expect.any(String),
      });
    });

    test("should sign token using OKP", () => {
      kit = new JwtKit({ issuer, logger, kryptos: TEST_OKP_KEY_SIG });

      expect(
        kit.sign({
          expires: "1h",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "test_token",
        }),
      ).toEqual({
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
        expiresIn: 3600,
        expiresOn: 1704099600,
        objectId: expect.any(String),
        token: expect.any(String),
        tokenId: expect.any(String),
      });
    });

    test("should sign token using RSA", () => {
      kit = new JwtKit({ issuer, logger, kryptos: TEST_RSA_KEY_SIG });

      expect(
        kit.sign({
          expires: "1h",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "test_token",
        }),
      ).toEqual({
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
        expiresIn: 3600,
        expiresOn: 1704099600,
        objectId: expect.any(String),
        token: expect.any(String),
        tokenId: expect.any(String),
      });
    });
  });

  describe("verify", () => {
    test("should verify token and resolve data", () => {
      const { token, tokenId } = kit.sign({
        accessToken:
          "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c",
        adjustedAccessLevel: 4,
        audience: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
        authCode: "999a8b01e27c56aeb5b2f47c001ef8be7be39a375f8c5e929f82df1626de01d8",
        authContextClass: "test_auth_context_class",
        authFactor: "test_auth_factor",
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
      });

      expect(kit.verify(token)).toEqual({
        decoded: {
          header: {
            alg: "ES512",
            cty: "application/json",
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: TEST_EC_KEY_SIG.id,
            oid: expect.any(String),
            typ: "JWT",
          },
          payload: {
            aal: 4,
            acr: "test_auth_context_class",
            afr: "test_auth_factor",
            amr: ["test_auth_method"],
            at_hash: "ehXwFopDjJcovgdtD6uhQg",
            aud: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
            auth_time: 1641024000,
            azp: "6099162c-3853-5a28-ade1-7f354b68b54b",
            c_hash: "fIneZFxzOJe9_Wsdzc1yaLDmSDkYjy9_G6XDDDLbEos",
            cid: "1782154a-385a-56cc-b504-380f0ba4c012",
            exp: 1704099600,
            gty: "test_grant_type",
            iat: 1704096000,
            iss: "https://test.lindorm.io/",
            jti: tokenId,
            loa: 4,
            nbf: 1641024000,
            nonce: "24d63b3e0be0538890b1",
            per: ["test_permission"],
            rls: ["test_role"],
            s_hash: "LpadyLdMV2YGBJvsrNsr0A",
            scope: ["test_scope"],
            sid: "d5d79807-52c2-5ac1-a3f1-fc5fe8b9e9af",
            sih: "test_session_hint",
            sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
            suh: "test_subject_hint",
            test_claim: "test_value",
            tid: "55103fbe-a183-57ec-b553-13af34d83c23",
            token_type: "test_token",
          },
          signature: expect.any(String),
        },
        header: {
          algorithm: "ES512",
          critical: [],
          contentType: "application/json",
          headerType: "JWT",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: TEST_EC_KEY_SIG.id,
          objectId: expect.any(String),
        },
        payload: {
          accessTokenHash: "ehXwFopDjJcovgdtD6uhQg",
          adjustedAccessLevel: 4,
          audience: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
          authContextClass: "test_auth_context_class",
          authFactor: "test_auth_factor",
          authMethods: ["test_auth_method"],
          authTime: new Date("2022-01-01T08:00:00.000Z"),
          authorizedParty: "6099162c-3853-5a28-ade1-7f354b68b54b",
          claims: {
            test_claim: "test_value",
          },
          clientId: "1782154a-385a-56cc-b504-380f0ba4c012",
          codeHash: "fIneZFxzOJe9_Wsdzc1yaLDmSDkYjy9_G6XDDDLbEos",
          expiresAt: new Date("2024-01-01T09:00:00.000Z"),
          grantType: "test_grant_type",
          issuedAt: new Date("2024-01-01T08:00:00.000Z"),
          issuer: "https://test.lindorm.io/",
          levelOfAssurance: 4,
          nonce: "24d63b3e0be0538890b1",
          notBefore: new Date("2022-01-01T08:00:00.000Z"),
          permissions: ["test_permission"],
          roles: ["test_role"],
          scope: ["test_scope"],
          sessionHint: "test_session_hint",
          sessionId: "d5d79807-52c2-5ac1-a3f1-fc5fe8b9e9af",
          stateHash: "LpadyLdMV2YGBJvsrNsr0A",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          subjectHint: "test_subject_hint",
          tenantId: "55103fbe-a183-57ec-b553-13af34d83c23",
          tokenId: tokenId,
          tokenType: "test_token",
        },
        token,
      });
    });

    test("should verify token with EC", () => {
      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      expect(() => kit.verify(token)).not.toThrow();
    });

    test("should verify token with OCT", () => {
      kit = new JwtKit({ issuer, logger, kryptos: TEST_OCT_KEY_SIG });

      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      expect(() => kit.verify(token)).not.toThrow();
    });

    test("should verify token with OKP", () => {
      kit = new JwtKit({ issuer, logger, kryptos: TEST_OKP_KEY_SIG });

      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      expect(() => kit.verify(token)).not.toThrow();
    });

    test("should verify token with RSA", () => {
      kit = new JwtKit({ issuer, logger, kryptos: TEST_RSA_KEY_SIG });

      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      expect(() => kit.verify(token)).not.toThrow();
    });
  });

  describe("parse", () => {
    test("should parse token and resolve data", () => {
      const { token, tokenId } = kit.sign({
        accessToken:
          "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c",
        adjustedAccessLevel: 4,
        audience: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
        authCode: "999a8b01e27c56aeb5b2f47c001ef8be7be39a375f8c5e929f82df1626de01d8",
        authContextClass: "test_auth_context_class",
        authFactor: "test_auth_factor",
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
      });

      expect(JwtKit.parse(token)).toEqual({
        decoded: {
          header: {
            alg: "ES512",
            cty: "application/json",
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: TEST_EC_KEY_SIG.id,
            oid: expect.any(String),
            typ: "JWT",
          },
          payload: {
            aal: 4,
            acr: "test_auth_context_class",
            afr: "test_auth_factor",
            amr: ["test_auth_method"],
            at_hash: "ehXwFopDjJcovgdtD6uhQg",
            aud: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
            auth_time: 1641024000,
            azp: "6099162c-3853-5a28-ade1-7f354b68b54b",
            c_hash: "fIneZFxzOJe9_Wsdzc1yaLDmSDkYjy9_G6XDDDLbEos",
            cid: "1782154a-385a-56cc-b504-380f0ba4c012",
            exp: 1704099600,
            gty: "test_grant_type",
            iat: 1704096000,
            iss: "https://test.lindorm.io/",
            jti: tokenId,
            loa: 4,
            nbf: 1641024000,
            nonce: "24d63b3e0be0538890b1",
            per: ["test_permission"],
            rls: ["test_role"],
            s_hash: "LpadyLdMV2YGBJvsrNsr0A",
            scope: ["test_scope"],
            sid: "d5d79807-52c2-5ac1-a3f1-fc5fe8b9e9af",
            sih: "test_session_hint",
            sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
            suh: "test_subject_hint",
            test_claim: "test_value",
            tid: "55103fbe-a183-57ec-b553-13af34d83c23",
            token_type: "test_token",
          },
          signature: expect.any(String),
        },
        header: {
          algorithm: "ES512",
          critical: [],
          contentType: "application/json",
          headerType: "JWT",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: TEST_EC_KEY_SIG.id,
          objectId: expect.any(String),
        },
        payload: {
          accessTokenHash: "ehXwFopDjJcovgdtD6uhQg",
          adjustedAccessLevel: 4,
          audience: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
          authContextClass: "test_auth_context_class",
          authFactor: "test_auth_factor",
          authMethods: ["test_auth_method"],
          authTime: new Date("2022-01-01T08:00:00.000Z"),
          authorizedParty: "6099162c-3853-5a28-ade1-7f354b68b54b",
          claims: {
            test_claim: "test_value",
          },
          clientId: "1782154a-385a-56cc-b504-380f0ba4c012",
          codeHash: "fIneZFxzOJe9_Wsdzc1yaLDmSDkYjy9_G6XDDDLbEos",
          expiresAt: new Date("2024-01-01T09:00:00.000Z"),
          grantType: "test_grant_type",
          issuedAt: new Date("2024-01-01T08:00:00.000Z"),
          issuer: "https://test.lindorm.io/",
          levelOfAssurance: 4,
          nonce: "24d63b3e0be0538890b1",
          notBefore: new Date("2022-01-01T08:00:00.000Z"),
          permissions: ["test_permission"],
          roles: ["test_role"],
          scope: ["test_scope"],
          sessionHint: "test_session_hint",
          sessionId: "d5d79807-52c2-5ac1-a3f1-fc5fe8b9e9af",
          stateHash: "LpadyLdMV2YGBJvsrNsr0A",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          subjectHint: "test_subject_hint",
          tenantId: "55103fbe-a183-57ec-b553-13af34d83c23",
          tokenId: tokenId,
          tokenType: "test_token",
        },
        token,
      });
    });
  });

  describe("decode", () => {
    test("should decode token", () => {
      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      expect(JwtKit.decode(token)).toEqual({
        header: {
          alg: "ES512",
          cty: "application/json",
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          oid: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          typ: "JWT",
        },
        payload: {
          exp: 1704099600,
          iat: 1704096000,
          iss: "https://test.lindorm.io/",
          jti: expect.any(String),
          nbf: 1704096000,
          sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          token_type: "test_token",
        },
        signature: expect.any(String),
      });
    });
  });

  describe("validate", () => {
    test("should validate token payload", () => {
      const { token } = kit.sign({
        accessToken:
          "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c",
        adjustedAccessLevel: 4,
        audience: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
        authCode: "999a8b01e27c56aeb5b2f47c001ef8be7be39a375f8c5e929f82df1626de01d8",
        authContextClass: "test_auth_context_class",
        authFactor: "test_auth_factor",
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
      });

      const { payload } = kit.verify(token);

      expect(() =>
        JwtKit.validate(payload, {
          permissions: { $all: ["test_permission"] },
          roles: { $all: ["test_role"] },
          subjectHint: { $eq: "test_subject_hint" },
        }),
      ).not.toThrow();
    });
  });

  describe("custom verification", () => {
    const options: SignJwtContent = {
      accessToken:
        "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c",
      adjustedAccessLevel: 4,
      audience: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
      authCode: "999a8b01e27c56aeb5b2f47c001ef8be7be39a375f8c5e929f82df1626de01d8",
      authContextClass: "test_auth_context_class",
      authFactor: "test_auth_factor",
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
    };

    test("should verify token and resolve data", () => {
      const { token } = kit.sign(options);

      expect(() =>
        kit.verify(token, {
          accessToken: options.accessToken,
          adjustedAccessLevel: { $gte: 3 },
          audience: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
          authCode: options.authCode,
          authState: options.authState,
          authTime: { $lte: new Date("2022-01-01T08:00:00.000Z") },
        }),
      ).not.toThrow();
    });
  });

  describe("external validation", () => {
    describe("sign", () => {
      test("should sign tokens that other packages can decode", () => {
        const { token } = kit.sign({
          expires: "1h",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "test_token",
        });

        const {
          signature,
          payload: { jti },
        } = JwtKit.decode(token);

        expect(jsonwebtoken.decode(token, { complete: true })).toEqual({
          header: {
            alg: "ES512",
            cty: "application/json",
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: TEST_EC_KEY_SIG.id,
            oid: expect.any(String),
            typ: "JWT",
          },
          payload: {
            exp: 1704099600,
            iat: 1704096000,
            iss: "https://test.lindorm.io/",
            jti: jti,
            nbf: 1704096000,
            sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
            token_type: "test_token",
          },
          signature: signature,
        });
      });

      test("should sign EC tokens that other packages can verify", () => {
        const { token } = kit.sign({
          expires: "1h",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "test_token",
        });

        const {
          payload: { jti },
        } = JwtKit.decode(token);

        const { privateKey } = TEST_EC_KEY_SIG.export("pem");

        expect(jsonwebtoken.verify(token, privateKey!)).toEqual({
          exp: 1704099600,
          iat: 1704096000,
          iss: "https://test.lindorm.io/",
          jti: jti,
          nbf: 1704096000,
          sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          token_type: "test_token",
        });
      });

      test("should sign OCT tokens that other packages can verify", () => {
        kit = new JwtKit({ issuer, logger, kryptos: TEST_OCT_KEY_SIG });

        const { token } = kit.sign({
          expires: "1h",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "test_token",
        });

        const decoded = JwtKit.decode(token);

        const { privateKey } = TEST_OCT_KEY_SIG.export("der");

        expect(jsonwebtoken.verify(token, privateKey!)).toEqual({
          exp: 1704099600,
          iat: 1704096000,
          iss: "https://test.lindorm.io/",
          jti: decoded.payload.jti,
          nbf: 1704096000,
          sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          token_type: "test_token",
        });
      });

      test("should sign RSA tokens that other packages can verify", () => {
        kit = new JwtKit({ issuer, logger, kryptos: TEST_RSA_KEY_SIG });

        const { token } = kit.sign({
          expires: "1h",
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "test_token",
        });

        const {
          payload: { jti },
        } = JwtKit.decode(token);

        const { publicKey } = TEST_RSA_KEY_SIG.export("pem");

        expect(jsonwebtoken.verify(token, publicKey!)).toEqual({
          exp: 1704099600,
          iat: 1704096000,
          iss: "https://test.lindorm.io/",
          jti: jti,
          nbf: 1704096000,
          sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          token_type: "test_token",
        });
      });
    });

    describe("verify", () => {
      test("should verify EC tokens that other packages have signed", () => {
        const { privateKey } = TEST_EC_KEY_SIG.export("pem");

        const token = jsonwebtoken.sign(
          { subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad" },
          privateKey!,
          { algorithm: "ES512", expiresIn: "1h", issuer: "https://test.lindorm.io/" },
        );

        expect(() => kit.verify(token)).not.toThrow();
      });

      test("should verify OCT tokens that other packages have signed", () => {
        kit = new JwtKit({ issuer, logger, kryptos: TEST_OCT_KEY_SIG });

        const { privateKey } = TEST_OCT_KEY_SIG.export("der");

        const token = jsonwebtoken.sign(
          { subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad" },
          privateKey!,
          { algorithm: "HS256", expiresIn: "1h", issuer: "https://test.lindorm.io/" },
        );

        expect(() => kit.verify(token)).not.toThrow();
      });

      test("should verify RSA tokens that other packages have signed", () => {
        kit = new JwtKit({ issuer, logger, kryptos: TEST_RSA_KEY_SIG });

        const { privateKey } = TEST_RSA_KEY_SIG.export("pem");

        const token = jsonwebtoken.sign(
          { subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad" },
          privateKey!,
          { algorithm: "RS512", expiresIn: "1h", issuer: "https://test.lindorm.io/" },
        );

        expect(() => kit.verify(token)).not.toThrow();
      });
    });
  });
});
