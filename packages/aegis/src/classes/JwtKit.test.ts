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
        kit.sign(
          {
            expires: "1h",
            subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
            tokenType: "test_token",
          },
          { objectId: "test-object-id" },
        ),
      ).toEqual({
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
        expiresIn: 3600,
        expiresOn: 1704099600,
        objectId: "test-object-id",
        token: expect.any(String),
        tokenId: expect.any(String),
      });
    });

    test("should sign token using OCT", () => {
      kit = new JwtKit({ issuer, logger, kryptos: TEST_OCT_KEY_SIG });

      expect(
        kit.sign(
          {
            expires: "1h",
            subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
            tokenType: "test_token",
          },
          { objectId: "test-object-id" },
        ),
      ).toEqual({
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
        expiresIn: 3600,
        expiresOn: 1704099600,
        objectId: "test-object-id",
        token: expect.any(String),
        tokenId: expect.any(String),
      });
    });

    test("should sign token using OKP", () => {
      kit = new JwtKit({ issuer, logger, kryptos: TEST_OKP_KEY_SIG });

      expect(
        kit.sign(
          {
            expires: "1h",
            subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
            tokenType: "test_token",
          },
          { objectId: "test-object-id" },
        ),
      ).toEqual({
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
        expiresIn: 3600,
        expiresOn: 1704099600,
        objectId: "test-object-id",
        token: expect.any(String),
        tokenId: expect.any(String),
      });
    });

    test("should sign token using RSA", () => {
      kit = new JwtKit({ issuer, logger, kryptos: TEST_RSA_KEY_SIG });

      expect(
        kit.sign(
          {
            expires: "1h",
            subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
            tokenType: "test_token",
          },
          { objectId: "test-object-id" },
        ),
      ).toEqual({
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
        expiresIn: 3600,
        expiresOn: 1704099600,
        objectId: "test-object-id",
        token: expect.any(String),
        tokenId: expect.any(String),
      });
    });

    test("should sign token without objectId and omit oid from header", () => {
      const { token, objectId } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      expect(objectId).toBeUndefined();

      const { header } = JwtKit.decode(token);
      expect(header).not.toHaveProperty("oid");
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
      });

      expect(kit.verify(token)).toEqual({
        decoded: {
          header: {
            alg: "ES512",
            cty: "application/json",
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: TEST_EC_KEY_SIG.id,
            typ: "test_token+jwt",
          },
          payload: {
            aal: 4,
            acr: "test_auth_context_class",
            afr: ["test_auth_factor"],
            amr: ["test_auth_method"],
            at_hash: "ehXwFopDjJcovgdtD6uhQg",
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
            s_hash: "LpadyLdMV2YGBJvsrNsr0A",
            scope: ["test_scope"],
            sid: "d5d79807-52c2-5ac1-a3f1-fc5fe8b9e9af",
            sih: "test_session_hint",
            sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
            suh: "test_subject_hint",
            test_claim: "test_value",
            tenant_id: "55103fbe-a183-57ec-b553-13af34d83c23",
          },
          signature: expect.any(String),
        },
        header: {
          algorithm: "ES512",
          baseFormat: "JWT",
          critical: [],
          contentType: "application/json",
          headerType: "test_token+jwt",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: TEST_EC_KEY_SIG.id,
          tokenType: "test_token",
        },
        delegation: {
          actorChain: [],
          currentActor: undefined,
          isDelegated: false,
        },
        payload: {
          accessTokenHash: "ehXwFopDjJcovgdtD6uhQg",
          adjustedAccessLevel: 4,
          audience: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
          authContextClass: "test_auth_context_class",
          authFactor: ["test_auth_factor"],
          authMethods: ["test_auth_method"],
          authTime: new Date("2022-01-01T08:00:00.000Z"),
          authorizedParty: "6099162c-3853-5a28-ade1-7f354b68b54b",
          claims: {
            test_claim: "test_value",
          },
          clientId: "1782154a-385a-56cc-b504-380f0ba4c012",
          codeHash: "fIneZFxzOJe9_Wsdzc1yaLDmSDkYjy9_G6XDDDLbEos",
          entitlements: [],
          expiresAt: new Date("2024-01-01T09:00:00.000Z"),
          grantType: "test_grant_type",
          groups: [],
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
      });

      expect(JwtKit.parse(token)).toEqual({
        decoded: {
          header: {
            alg: "ES512",
            cty: "application/json",
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: TEST_EC_KEY_SIG.id,
            typ: "test_token+jwt",
          },
          payload: {
            aal: 4,
            acr: "test_auth_context_class",
            afr: ["test_auth_factor"],
            amr: ["test_auth_method"],
            at_hash: "ehXwFopDjJcovgdtD6uhQg",
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
            s_hash: "LpadyLdMV2YGBJvsrNsr0A",
            scope: ["test_scope"],
            sid: "d5d79807-52c2-5ac1-a3f1-fc5fe8b9e9af",
            sih: "test_session_hint",
            sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
            suh: "test_subject_hint",
            test_claim: "test_value",
            tenant_id: "55103fbe-a183-57ec-b553-13af34d83c23",
          },
          signature: expect.any(String),
        },
        header: {
          algorithm: "ES512",
          baseFormat: "JWT",
          critical: [],
          contentType: "application/json",
          headerType: "test_token+jwt",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: TEST_EC_KEY_SIG.id,
          tokenType: "test_token",
        },
        delegation: {
          actorChain: [],
          currentActor: undefined,
          isDelegated: false,
        },
        payload: {
          accessTokenHash: "ehXwFopDjJcovgdtD6uhQg",
          adjustedAccessLevel: 4,
          audience: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
          authContextClass: "test_auth_context_class",
          authFactor: ["test_auth_factor"],
          authMethods: ["test_auth_method"],
          authTime: new Date("2022-01-01T08:00:00.000Z"),
          authorizedParty: "6099162c-3853-5a28-ade1-7f354b68b54b",
          claims: {
            test_claim: "test_value",
          },
          clientId: "1782154a-385a-56cc-b504-380f0ba4c012",
          codeHash: "fIneZFxzOJe9_Wsdzc1yaLDmSDkYjy9_G6XDDDLbEos",
          entitlements: [],
          expiresAt: new Date("2024-01-01T09:00:00.000Z"),
          grantType: "test_grant_type",
          groups: [],
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
          typ: "test_token+jwt",
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

  describe("validate", () => {
    test("should validate token payload", () => {
      const { token } = kit.sign({
        accessToken:
          "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c",
        adjustedAccessLevel: 4,
        audience: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
        authCode: "999a8b01e27c56aeb5b2f47c001ef8be7be39a375f8c5e929f82df1626de01d8",
        authContextClass: "test_auth_context_class",
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

  describe("actor verification", () => {
    const baseContent: SignJwtContent = {
      expires: "1h",
      subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      tokenType: "test_token",
    };

    test("delegation is empty when act claim is absent", () => {
      const { token } = kit.sign(baseContent);

      const parsed = kit.verify(token);

      expect(parsed.delegation.isDelegated).toBe(false);
      expect(parsed.delegation.currentActor).toBeUndefined();
      expect(parsed.delegation.actorChain).toEqual([]);
      expect(parsed.payload.subject).toBe("3f2ae79d-f1d1-556b-a8bc-305e6b2334ad");
    });

    test("delegation reflects a single-level act claim", () => {
      const { token } = kit.sign({
        ...baseContent,
        act: { subject: "service-1" },
      });

      const parsed = kit.verify(token);

      expect(parsed.delegation.isDelegated).toBe(true);
      expect(parsed.delegation.currentActor).toBe("service-1");
      expect(parsed.delegation.actorChain).toEqual([{ subject: "service-1" }]);
    });

    test("actor.required throws when no act claim is present", () => {
      const { token } = kit.sign(baseContent);

      expect(() => kit.verify(token, { actor: { required: true } })).toThrow(/act claim/);
    });

    test("actor.required passes when act is present", () => {
      const { token } = kit.sign({
        ...baseContent,
        act: { subject: "service-1" },
      });

      expect(() => kit.verify(token, { actor: { required: true } })).not.toThrow();
    });

    test("actor.forbidden throws when act is present", () => {
      const { token } = kit.sign({
        ...baseContent,
        act: { subject: "service-1" },
      });

      expect(() => kit.verify(token, { actor: { forbidden: true } })).toThrow(
        /non-delegated/,
      );
    });

    test("actor.allowedSubjects accepts a chain of whitelisted subjects", () => {
      const { token } = kit.sign({
        ...baseContent,
        act: { subject: "service-1", act: { subject: "service-2" } },
      });

      expect(() =>
        kit.verify(token, {
          actor: { allowedSubjects: ["service-1", "service-2"] },
        }),
      ).not.toThrow();
    });

    test("actor.allowedSubjects rejects an unknown actor in the chain", () => {
      const { token } = kit.sign({
        ...baseContent,
        act: { subject: "service-1", act: { subject: "rogue" } },
      });

      expect(() =>
        kit.verify(token, { actor: { allowedSubjects: ["service-1"] } }),
      ).toThrow(/not allowed/);
    });

    test("actor.maxChainDepth allows chains at or below the limit", () => {
      const { token } = kit.sign({
        ...baseContent,
        act: { subject: "service-1", act: { subject: "service-2" } },
      });

      expect(() => kit.verify(token, { actor: { maxChainDepth: 2 } })).not.toThrow();
    });

    test("actor.maxChainDepth rejects chains exceeding the limit", () => {
      const { token } = kit.sign({
        ...baseContent,
        act: {
          subject: "service-1",
          act: { subject: "service-2", act: { subject: "service-3" } },
        },
      });

      expect(() => kit.verify(token, { actor: { maxChainDepth: 2 } })).toThrow(
        /maximum depth/,
      );
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
            typ: "test_token+jwt",
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

  describe("critical header parameter rejection", () => {
    test("should reject RFC-valid token with an extension critical parameter aegis does not implement", () => {
      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      // Craft a well-formed header with a non-registered crit parameter that
      // is actually present. Aegis should reject because the extension is
      // unknown to it, even though the header itself is RFC-compliant.
      const decoded = JwtKit.decode(token);
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
      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      const decoded = JwtKit.decode(token);
      const headerWithCrit = { ...decoded.header, crit: ["missing_ext"] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(/not present/);
    });

    test("should reject crit containing an IANA-registered parameter name", () => {
      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      const decoded = JwtKit.decode(token);
      const headerWithCrit = { ...decoded.header, crit: ["alg"] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(/IANA-registered/);
    });

    test("should reject crit that is an empty array", () => {
      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      const decoded = JwtKit.decode(token);
      const headerWithCrit = { ...decoded.header, crit: [] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      expect(() => kit.verify(modifiedToken)).toThrow(/empty/);
    });

    test("should accept token with empty critical array", () => {
      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      expect(() => kit.verify(token)).not.toThrow();
    });
  });

  describe("header-embedded key source rejection", () => {
    // These tests lock in the invariant that aegis NEVER uses header-embedded
    // key material (jwk, x5c, x5u) for verification. Key lookup goes through
    // Amphora exclusively. See Aegis.kryptosSig for the invariant comment.

    test("a malicious jwk in the header must not be usable to verify the token", () => {
      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      // Inject a fabricated jwk into the header. The token's actual signature
      // was made with Amphora's key and the header change invalidates it —
      // but the important assertion is that aegis does NOT recognize the
      // injected jwk as a verification key. The throw path must be
      // signature-related, not "successfully verified with header.jwk".
      const decoded = JwtKit.decode(token);
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
      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      const decoded = JwtKit.decode(token);
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

    test("audience string verifier matches multi-value aud array", () => {
      // Critical correctness test: verify.audience as a string must match
      // any token whose `aud` claim includes that audience. Since aud is
      // always stored as an array in the payload, a naive $eq check would
      // incorrectly fail for this common case.
      const { token } = kit.sign({
        audience: ["saga", "mimir"],
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      expect(() => kit.verify(token, { audience: "saga" })).not.toThrow();
      expect(() => kit.verify(token, { audience: "mimir" })).not.toThrow();
      expect(() => kit.verify(token, { audience: "elsewhere" })).toThrow();
    });

    test("audience array verifier requires every listed audience to be present", () => {
      const { token } = kit.sign({
        audience: ["saga", "mimir"],
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      expect(() => kit.verify(token, { audience: ["saga", "mimir"] })).not.toThrow();
      // Subset of the token's aud — every listed audience is present
      expect(() => kit.verify(token, { audience: ["saga"] })).not.toThrow();
      // One value not in the token's aud
      expect(() => kit.verify(token, { audience: ["saga", "elsewhere"] })).toThrow();
    });

    test("AegisProfile round-trips: camelCase input → snake_case wire → camelCase parsed output", () => {
      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "id_token",
        profile: {
          name: "Jonn Nilsson",
          givenName: "Jonn",
          familyName: "Nilsson",
          preferredName: "Jonn",
          displayName: "princejonn",
          nickname: "princejonn",
          email: "jonn@example.com",
          emailVerified: true,
          picture: "https://example.com/avatar.png",
          profile: "https://example.com/users/jonn",
          locale: "en-US",
          zoneinfo: "Europe/Stockholm",
          pronouns: "he/him",
          honorific: "Mr.",
          namingSystem: "given_family",
          birthdate: "1990-05-15",
          address: {
            formatted: "123 Main St, Stockholm, 11122, Sweden",
            streetAddress: "123 Main St",
            locality: "Stockholm",
            postalCode: "11122",
            country: "Sweden",
          },
          jobTitle: "Principal Engineer",
          organization: "Lindorm",
          department: "Platform",
          occupation: "Software Engineering",
          legalName: "Jonn Nilsson",
          legalNameVerified: true,
        },
      });

      // Decode the raw wire payload to verify snake_case on the wire
      const decoded = JwtKit.decode(token);
      expect(decoded.payload).toMatchObject({
        name: "Jonn Nilsson",
        given_name: "Jonn",
        family_name: "Nilsson",
        preferred_name: "Jonn",
        display_name: "princejonn",
        nickname: "princejonn",
        email: "jonn@example.com",
        email_verified: true,
        picture: "https://example.com/avatar.png",
        profile: "https://example.com/users/jonn",
        locale: "en-US",
        zoneinfo: "Europe/Stockholm",
        pronouns: "he/him",
        honorific: "Mr.",
        naming_system: "given_family",
        birthdate: "1990-05-15",
        address: {
          formatted: "123 Main St, Stockholm, 11122, Sweden",
          street_address: "123 Main St",
          locality: "Stockholm",
          postal_code: "11122",
          country: "Sweden",
        },
        job_title: "Principal Engineer",
        organization: "Lindorm",
        department: "Platform",
        occupation: "Software Engineering",
        legal_name: "Jonn Nilsson",
        legal_name_verified: true,
      });

      // Verify and confirm the parsed profile comes back camelCased
      const parsed = kit.verify(token);
      expect(parsed.payload.profile).toEqual({
        name: "Jonn Nilsson",
        givenName: "Jonn",
        familyName: "Nilsson",
        preferredName: "Jonn",
        displayName: "princejonn",
        nickname: "princejonn",
        email: "jonn@example.com",
        emailVerified: true,
        picture: "https://example.com/avatar.png",
        profile: "https://example.com/users/jonn",
        locale: "en-US",
        zoneinfo: "Europe/Stockholm",
        pronouns: "he/him",
        honorific: "Mr.",
        namingSystem: "given_family",
        birthdate: "1990-05-15",
        address: {
          formatted: "123 Main St, Stockholm, 11122, Sweden",
          streetAddress: "123 Main St",
          locality: "Stockholm",
          postalCode: "11122",
          country: "Sweden",
        },
        jobTitle: "Principal Engineer",
        organization: "Lindorm",
        department: "Platform",
        occupation: "Software Engineering",
        legalName: "Jonn Nilsson",
        legalNameVerified: true,
      });
    });

    test("profile is undefined when not supplied on sign", () => {
      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      const parsed = kit.verify(token);
      expect(parsed.payload.profile).toBeUndefined();
    });

    test("custom claims and profile claims are kept in separate buckets", () => {
      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
        profile: {
          givenName: "Jonn",
          email: "jonn@example.com",
        },
        claims: {
          my_app_flag: "enabled",
          some_custom_thing: 42,
        },
      });

      const parsed = kit.verify(token);
      expect(parsed.payload.profile).toEqual({
        givenName: "Jonn",
        email: "jonn@example.com",
      });
      expect(parsed.payload.claims).toEqual({
        my_app_flag: "enabled",
        some_custom_thing: 42,
      });
    });

    test("a malicious x5u in the header must not be fetched or used to verify the token", () => {
      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      });

      const decoded = JwtKit.decode(token);
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
      // The verify throws because the header change broke the signature,
      // not because of any x5u fetch attempt.
      expect(() => kit.verify(modifiedToken)).toThrow();
    });
  });

  describe("confirmation claim", () => {
    test("should round-trip a DPoP thumbprint through sign and verify", () => {
      const { token } = kit.sign(
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

      const decoded = JwtKit.decode(token);
      expect(decoded.payload).toMatchSnapshot("wire payload — jkt only");

      const parsed = kit.verify(token);
      expect(parsed.payload.confirmation).toMatchSnapshot("parsed — jkt only");
    });

    test("should round-trip all confirmation members", () => {
      const { token } = kit.sign(
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

      const decoded = JwtKit.decode(token);
      expect(decoded.payload).toMatchSnapshot("wire payload — full cnf");

      const parsed = kit.verify(token);
      expect(parsed.payload.confirmation).toMatchSnapshot("parsed — full cnf");
    });

    test("should omit cnf entirely when confirmation is not provided", () => {
      const { token } = kit.sign({
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "access_token",
      });

      const decoded = JwtKit.decode(token);
      expect(decoded.payload).not.toHaveProperty("cnf");

      const parsed = kit.verify(token);
      expect(parsed.payload.confirmation).toBeUndefined();
    });
  });
});
