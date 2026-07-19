import { Amphora, type IAmphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import { ShaKit } from "@lindorm/sha";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG, TEST_RSA_KEY_SIG } from "../__fixtures__/keys.js";
import { createJoseSignature } from "../internal/utils/jose-signature.js";
import type { SignContent } from "../types/index.js";
import { Aegis } from "./Aegis.js";
import { JwtKit } from "./JwtKit.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

// The DOMAIN verify policy the thinned JwtKit no longer owns — named-claim
// matchers, exp/typ presence, actor/delegation, DPoP — now runs on the Aegis
// verify path (verifyJwtToDomain). These tests exercise it through
// `aegis.jwt.verify`, the raw JWT surface.
describe("Aegis jwt.verify — relocated domain policy", () => {
  const issuer = "https://test.lindorm.io/";

  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ domain: issuer, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  const mint = (content: SignContent) => aegis.mint("default", content);

  const baseContent: SignContent = {
    expires: "1h",
    subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
    tokenType: "test_token",
  };

  describe("named-claim matchers", () => {
    test("audience string verifier matches a multi-value aud array", async () => {
      const { token } = await mint({ ...baseContent, audience: ["saga", "mimir"] });

      await expect(aegis.jwt.verify(token, { audience: "saga" })).resolves.toBeDefined();
      await expect(aegis.jwt.verify(token, { audience: "mimir" })).resolves.toBeDefined();
      await expect(aegis.jwt.verify(token, { audience: "elsewhere" })).rejects.toThrow();
    });

    test("audience array verifier requires every listed audience to be present", async () => {
      const { token } = await mint({ ...baseContent, audience: ["saga", "mimir"] });

      await expect(
        aegis.jwt.verify(token, { audience: ["saga", "mimir"] }),
      ).resolves.toBeDefined();
      await expect(
        aegis.jwt.verify(token, { audience: ["saga"] }),
      ).resolves.toBeDefined();
      await expect(
        aegis.jwt.verify(token, { audience: ["saga", "elsewhere"] }),
      ).rejects.toThrow();
    });

    test("resolves a full set of custom matchers (hashes, vot, authTime)", async () => {
      const content: SignContent = {
        ...baseContent,
        accessToken:
          "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c",
        audience: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
        authCode: "999a8b01e27c56aeb5b2f47c001ef8be7be39a375f8c5e929f82df1626de01d8",
        authState: "7409ac52a9615b8c9f9a",
        authTime: new Date("2022-01-01T08:00:00.000Z"),
        vectorOfTrust: "P1.Cc.Ce.Aa",
        vectorTrustMark: "https://trustmark.lindorm.io/vot/P1.Cc.Ce.Aa",
      };
      const { token } = await mint(content);

      await expect(
        aegis.jwt.verify(token, {
          accessToken: content.accessToken,
          audience: ["427d8455-7d5a-59d3-afb6-7ef2b5bba226"],
          authCode: content.authCode,
          authState: content.authState,
          authTime: { $lte: new Date("2022-01-01T08:00:00.000Z") },
          vectorOfTrust: "P1.Cc.Ce.Aa",
          vectorTrustMark: { $eq: "https://trustmark.lindorm.io/vot/P1.Cc.Ce.Aa" },
        }),
      ).resolves.toBeDefined();
    });

    test("rejects when the access token does not match the at_hash", async () => {
      const { token } = await mint({
        ...baseContent,
        accessToken:
          "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c",
      });

      await expect(
        aegis.jwt.verify(token, { accessToken: "a-different-access-token" }),
      ).rejects.toThrow();
    });
  });

  describe("presence policy", () => {
    // A genuinely exp-less JWT signed straight through the wire kit with the
    // amphora key so aegis can resolve it by kid.
    const signExpLess = () =>
      new JwtKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign({ iss: issuer, sub: "s" });

    // A validly-signed TYP-LESS token (the wire kit floors typ to "JWT", so it
    // is hand-built to exercise the Aegis typ-presence policy).
    const signTypLess = () => {
      const header = B64.encode(
        JSON.stringify({ alg: TEST_EC_KEY_SIG.algorithm, kid: TEST_EC_KEY_SIG.id }),
        "b64u",
      );
      const payload = B64.encode(JSON.stringify({ iss: issuer, sub: "s" }), "b64u");
      const signature = createJoseSignature({
        header,
        payload,
        kryptos: TEST_EC_KEY_SIG,
      });
      return `${header}.${payload}.${signature}`;
    };

    test("rejects a token with no exp when expPresence is required (default)", async () => {
      await expect(aegis.jwt.verify(signExpLess())).rejects.toThrow(/exp/);
    });

    test("accepts a token with no exp when expPresence is optional", async () => {
      await expect(
        aegis.jwt.verify(signExpLess(), { expPresence: "optional" }),
      ).resolves.toBeDefined();
    });

    test("rejects a typ-less token when typPresence is required (default)", async () => {
      const error = await aegis.jwt
        .verify(signTypLess(), { expPresence: "optional" })
        .catch((err: { code?: string }) => err);
      expect((error as { code?: string }).code).toBe("jwt_invalid_typ");
    });
  });

  describe("domain buckets (round-trip)", () => {
    test("resolves subject and issuer on the domain payload", async () => {
      const { token } = await mint(baseContent);

      const parsed = await aegis.jwt.verify(token);

      expect(parsed.payload.subject).toBe("3f2ae79d-f1d1-556b-a8bc-305e6b2334ad");
      expect(parsed.payload.issuer).toBe(issuer);
      expect(parsed.delegation).toEqual({
        actorChain: [],
        currentActor: undefined,
        isDelegated: false,
      });
    });

    test("custom claims and profile claims land in separate domain buckets", async () => {
      const { token } = await mint({
        ...baseContent,
        tokenType: "id_token",
        profile: { givenName: "Jonn", email: "jonn@example.com" },
        claims: { myAppFlag: "enabled", someCustomThing: 42 },
      });

      const parsed = await aegis.jwt.verify(token, { typPresence: "optional" });
      expect(parsed.payload.profile).toEqual({
        givenName: "Jonn",
        email: "jonn@example.com",
      });
      expect(parsed.payload.claims).toEqual({
        myAppFlag: "enabled",
        someCustomThing: 42,
      });
    });
  });

  describe("actor verification", () => {
    test("delegation is empty when act claim is absent", async () => {
      const { token } = await mint(baseContent);
      const parsed = await aegis.jwt.verify(token);

      expect(parsed.delegation.isDelegated).toBe(false);
      expect(parsed.delegation.currentActor).toBeUndefined();
      expect(parsed.delegation.actorChain).toEqual([]);
    });

    test("delegation reflects a single-level act claim", async () => {
      const { token } = await mint({ ...baseContent, act: { subject: "service-1" } });
      const parsed = await aegis.jwt.verify(token);

      expect(parsed.delegation.isDelegated).toBe(true);
      expect(parsed.delegation.currentActor).toBe("service-1");
      expect(parsed.delegation.actorChain).toEqual([{ subject: "service-1" }]);
    });

    test("actor.required throws when no act claim is present", async () => {
      const { token } = await mint(baseContent);
      await expect(
        aegis.jwt.verify(token, { actor: { required: true } }),
      ).rejects.toThrow(/act claim/);
    });

    test("actor.required passes when act is present", async () => {
      const { token } = await mint({ ...baseContent, act: { subject: "service-1" } });
      await expect(
        aegis.jwt.verify(token, { actor: { required: true } }),
      ).resolves.toBeDefined();
    });

    test("actor.forbidden throws when act is present", async () => {
      const { token } = await mint({ ...baseContent, act: { subject: "service-1" } });
      await expect(
        aegis.jwt.verify(token, { actor: { forbidden: true } }),
      ).rejects.toThrow(/non-delegated/);
    });

    test("actor.allowedActors ($in) accepts a chain of whitelisted subjects", async () => {
      const { token } = await mint({
        ...baseContent,
        act: { subject: "service-1", act: { subject: "service-2" } },
      });
      await expect(
        aegis.jwt.verify(token, {
          actor: { allowedActors: { subject: { $in: ["service-1", "service-2"] } } },
        }),
      ).resolves.toBeDefined();
    });

    test("actor.allowedActors defaults to 'every' and rejects an unknown actor", async () => {
      const { token } = await mint({
        ...baseContent,
        act: { subject: "service-1", act: { subject: "rogue" } },
      });
      await expect(
        aegis.jwt.verify(token, {
          actor: { allowedActors: { subject: { $in: ["service-1"] } } },
        }),
      ).rejects.toThrow(/not allowed/);
    });

    test("actor.actorScope 'current' only checks the immediate actor", async () => {
      const { token } = await mint({
        ...baseContent,
        act: { subject: "service-1", act: { subject: "rogue" } },
      });
      await expect(
        aegis.jwt.verify(token, {
          actor: { allowedActors: { subject: "service-1" }, actorScope: "current" },
        }),
      ).resolves.toBeDefined();
    });

    test("actor.actorScope 'some' rejects when no actor matches", async () => {
      const { token } = await mint({
        ...baseContent,
        act: { subject: "rogue-1", act: { subject: "rogue-2" } },
      });
      await expect(
        aegis.jwt.verify(token, {
          actor: { allowedActors: { subject: "gateway" }, actorScope: "some" },
        }),
      ).rejects.toThrow(/no actor in the chain/i);
    });

    test("actor.maxChainDepth rejects chains exceeding the limit", async () => {
      const { token } = await mint({
        ...baseContent,
        act: {
          subject: "service-1",
          act: { subject: "service-2", act: { subject: "service-3" } },
        },
      });
      await expect(
        aegis.jwt.verify(token, { actor: { maxChainDepth: 2 } }),
      ).rejects.toThrow(/maximum depth/);
    });
  });

  describe("DPoP verification", () => {
    const proofKey = TEST_RSA_KEY_SIG;
    const proofThumbprint = proofKey.thumbprint;

    const signDpopProof = (
      accessToken: string,
      payloadOverrides: Record<string, unknown> = {},
    ): string => {
      const header = B64.encode(
        JSON.stringify({
          alg: "RS512",
          typ: "dpop+jwt",
          jwk: proofKey.export("jwk"),
        }),
        "b64u",
      );
      const payload = B64.encode(
        JSON.stringify({
          jti: "proof-jti",
          htm: "POST",
          htu: "https://api.example.com/resource",
          iat: 1704096000,
          ath: ShaKit.S256(accessToken),
          ...payloadOverrides,
        }),
        "b64u",
      );
      const signature = createJoseSignature({ header, payload, kryptos: proofKey });
      return `${header}.${payload}.${signature}`;
    };

    test("verifies a DPoP-bound access token with a valid proof", async () => {
      const { token } = await mint({
        ...baseContent,
        tokenType: "access_token",
        confirmation: { thumbprint: proofThumbprint },
      });
      const proof = signDpopProof(token);

      const parsed = await aegis.jwt.verify(token, { dpopProof: proof });

      expect(parsed.dpop).toEqual({
        thumbprint: proofThumbprint,
        tokenId: "proof-jti",
        httpMethod: "POST",
        httpUri: "https://api.example.com/resource",
        issuedAt: new Date("2024-01-01T08:00:00.000Z"),
        accessTokenHash: expect.any(String),
        nonce: undefined,
      });
    });

    test("throws when a DPoP-bound access token is verified without a proof", async () => {
      const { token } = await mint({
        ...baseContent,
        tokenType: "access_token",
        confirmation: { thumbprint: proofThumbprint },
      });

      await expect(aegis.jwt.verify(token)).rejects.toThrow(
        /token is DPoP-bound but no DPoP proof was provided/,
      );
    });

    test("throws when a DPoP proof is provided for a non-bound token", async () => {
      const { token } = await mint({ ...baseContent, tokenType: "access_token" });
      const proof = signDpopProof(token);

      await expect(aegis.jwt.verify(token, { dpopProof: proof })).rejects.toThrow(
        /DPoP proof provided but token is not bound/,
      );
    });

    test("throws when the proof thumbprint does not match cnf.jkt", async () => {
      const { token } = await mint({
        ...baseContent,
        tokenType: "access_token",
        confirmation: { thumbprint: "unrelated-thumbprint-value" },
      });
      const proof = signDpopProof(token);

      await expect(aegis.jwt.verify(token, { dpopProof: proof })).rejects.toThrow(
        /thumbprint does not match cnf\.jkt/,
      );
    });
  });
});
