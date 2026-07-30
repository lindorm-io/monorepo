import { Amphora, type IAmphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import { ShaKit } from "@lindorm/sha";
import MockDate from "mockdate";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG, TEST_RSA_KEY_SIG } from "../__fixtures__/keys.js";
import { createJoseSignature } from "../internal/utils/jose-signature.js";
import type { SignContent } from "../types/index.js";
import { Aegis } from "./Aegis.js";
import { JwtKit } from "./JwtKit.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

// The DOMAIN verify policy the thinned JwtKit no longer owns — named-claim
// matchers, exp/typ presence, actor/delegation, DPoP — runs on the DOMAIN verify
// path (`aegis.verify` → `verifyJwtToken`), returning a `VerifiedToken`. The raw
// `aegis.jwt.verify` surface is wire-only now (no domain policy).
describe("Aegis verify — relocated domain policy", () => {
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

      await expect(aegis.verify(token, { audience: "saga" })).resolves.toBeDefined();
      await expect(aegis.verify(token, { audience: "mimir" })).resolves.toBeDefined();
      await expect(aegis.verify(token, { audience: "elsewhere" })).rejects.toThrow();
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
        aegis.verify(
          token,
          {
            audience: "427d8455-7d5a-59d3-afb6-7ef2b5bba226",
            authTime: { $lte: new Date("2022-01-01T08:00:00.000Z") },
            vectorOfTrust: "P1.Cc.Ce.Aa",
            vectorTrustMark: { $eq: "https://trustmark.lindorm.io/vot/P1.Cc.Ce.Aa" },
          },
          {
            accessToken: content.accessToken,
            authCode: content.authCode,
            authState: content.authState,
          },
        ),
      ).resolves.toBeDefined();
    });

    test("rejects when the access token does not match the at_hash", async () => {
      const { token } = await mint({
        ...baseContent,
        accessToken:
          "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c",
      });

      await expect(
        aegis.verify(token, undefined, { accessToken: "a-different-access-token" }),
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
      await expect(aegis.verify(signExpLess())).rejects.toThrow(/exp/);
    });

    test("accepts a token with no exp when expPresence is optional", async () => {
      await expect(
        aegis.verify(signExpLess(), undefined, { expPresence: "optional" }),
      ).resolves.toBeDefined();
    });

    // The raw kit keeps only typ WELL-FORMEDNESS-if-present (typ presence is a
    // domain/profile policy). So `aegis.jwt.verify` ACCEPTS a typ-less signed
    // token and returns its native WIRE shape — no typ-presence rejection here.
    test("raw jwt.verify accepts a typ-less token (typ presence is not a raw concern)", async () => {
      const parsed = await aegis.jwt.verify(signTypLess());
      expect(parsed.payload.iss).toBe(issuer);
      expect(parsed.payload.sub).toBe("s");
      expect(parsed.header.typ).toBeUndefined();
    });
  });

  describe("domain buckets (round-trip)", () => {
    test("resolves subject and issuer on the domain payload", async () => {
      const { token } = await mint(baseContent);

      const parsed = await aegis.verify(token);

      expect(parsed.claims.subject).toBe("3f2ae79d-f1d1-556b-a8bc-305e6b2334ad");
      expect(parsed.claims.issuer).toBe(issuer);
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

      const parsed = await aegis.verify(token, undefined, { typPresence: "optional" });
      expect(parsed.profile).toEqual({
        givenName: "Jonn",
        email: "jonn@example.com",
      });
      expect(parsed.custom).toEqual({
        myAppFlag: "enabled",
        someCustomThing: 42,
      });
    });
  });

  describe("actor verification", () => {
    test("delegation is empty when act claim is absent", async () => {
      const { token } = await mint(baseContent);
      const parsed = await aegis.verify(token);

      expect(parsed.delegation!.isDelegated).toBe(false);
      expect(parsed.delegation!.currentActor).toBeUndefined();
      expect(parsed.delegation!.actorChain).toEqual([]);
    });

    test("delegation reflects a single-level act claim", async () => {
      const { token } = await mint({ ...baseContent, act: { subject: "service-1" } });
      const parsed = await aegis.verify(token);

      expect(parsed.delegation!.isDelegated).toBe(true);
      expect(parsed.delegation!.currentActor).toBe("service-1");
      expect(parsed.delegation!.actorChain).toEqual([{ subject: "service-1" }]);
    });

    test("actor.required throws when no act claim is present", async () => {
      const { token } = await mint(baseContent);
      await expect(
        aegis.verify(token, undefined, { actor: { required: true } }),
      ).rejects.toThrow(/act claim/);
    });

    test("actor.required passes when act is present", async () => {
      const { token } = await mint({ ...baseContent, act: { subject: "service-1" } });
      await expect(
        aegis.verify(token, undefined, { actor: { required: true } }),
      ).resolves.toBeDefined();
    });

    test("actor.forbidden throws when act is present", async () => {
      const { token } = await mint({ ...baseContent, act: { subject: "service-1" } });
      await expect(
        aegis.verify(token, undefined, { actor: { forbidden: true } }),
      ).rejects.toThrow(/non-delegated/);
    });

    test("actor.allowedActors ($in) accepts a chain of whitelisted subjects", async () => {
      const { token } = await mint({
        ...baseContent,
        act: { subject: "service-1", act: { subject: "service-2" } },
      });
      await expect(
        aegis.verify(token, undefined, {
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
        aegis.verify(token, undefined, {
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
        aegis.verify(token, undefined, {
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
        aegis.verify(token, undefined, {
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
        aegis.verify(token, undefined, { actor: { maxChainDepth: 2 } }),
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

      const parsed = await aegis.verify(token, undefined, { dpopProof: proof });

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

      await expect(aegis.verify(token)).rejects.toThrow(
        /token is DPoP-bound but no DPoP proof was provided/,
      );
    });

    test("throws when a DPoP proof is provided for a non-bound token", async () => {
      const { token } = await mint({ ...baseContent, tokenType: "access_token" });
      const proof = signDpopProof(token);

      await expect(aegis.verify(token, undefined, { dpopProof: proof })).rejects.toThrow(
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

      await expect(aegis.verify(token, undefined, { dpopProof: proof })).rejects.toThrow(
        /thumbprint does not match cnf\.jkt/,
      );
    });
  });

  // R10 temporal overrides threaded end-to-end through the DOMAIN verify path
  // (verifyJwtToken → kit temporal AND the identity-matcher exp bound).
  describe("temporal overrides (R10 — currentDate / maxTokenAge)", () => {
    afterEach(() => MockDate.set(new Date("2024-01-01T08:00:00.000Z")));

    test("currentDate revives a token expired against the real clock", async () => {
      const { token } = await mint(baseContent); // minted at 08:00, exp at 09:00

      // Travel past the token's expiry.
      MockDate.set(new Date("2024-01-01T10:00:00.000Z"));

      // Against the real (travelled) clock the token is expired.
      await expect(aegis.verify(token)).rejects.toThrow();

      // A currentDate BEFORE expiry revives it — proving currentDate is threaded
      // into the kit's (now sole) temporal range check (if it ignored currentDate
      // it would reject against the 10:00 clock).
      await expect(
        aegis.verify(token, undefined, {
          currentDate: new Date("2024-01-01T08:30:00.000Z"),
        }),
      ).resolves.toBeDefined();
    });

    test("maxTokenAge rejects a token whose iat is older than the bound", async () => {
      const { token } = await mint(baseContent); // iat at 08:00

      // Travel 10 minutes forward, so the token's iat is 600s old.
      MockDate.set(new Date("2024-01-01T08:10:00.000Z"));

      await expect(
        aegis.verify(token, undefined, { maxTokenAge: 300 }),
      ).rejects.toThrow();
      await expect(
        aegis.verify(token, undefined, { maxTokenAge: 900 }),
      ).resolves.toBeDefined();
    });
  });

  // Per-claim temporal-skip flags (id_token_hint, OIDC Core §3.1.2.1). A flag set
  // to `false` drops ONLY that claim's RANGE bound; signature, iss/aud, and exp
  // PRESENCE stay enforced. Tokens carrying arbitrary temporal claims are signed
  // straight through the wire kit with the amphora key so aegis resolves by kid.
  describe("temporal-skip flags (verifyExpiration / verifyNotBefore / verifyIssuedAt / verifyAuthTime)", () => {
    afterEach(() => MockDate.set(new Date("2024-01-01T08:00:00.000Z")));

    const nowSec = () => Math.floor(Date.now() / 1000);

    const signWire = (claims: Record<string, unknown>) =>
      new JwtKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign({
        iss: issuer,
        sub: "s",
        ...claims,
      });

    test("expired token: rejected by default, accepted with verifyExpiration:false", async () => {
      const token = signWire({ exp: nowSec() - 3600 }); // expired an hour ago

      await expect(aegis.verify(token)).rejects.toThrow();
      await expect(
        aegis.verify(token, undefined, { verifyExpiration: false }),
      ).resolves.toBeDefined();
    });

    test("verifyExpiration:false still rejects a signature-tampered token", async () => {
      const token = signWire({ exp: nowSec() - 3600 });
      // Corrupt the signature segment: the token still decodes, but the signature
      // no longer verifies — the flag must not weaken authenticity.
      const [header, payload, signature] = token.split(".");
      const tampered = `${header}.${payload}.${signature.slice(0, -1)}${
        signature.slice(-1) === "A" ? "B" : "A"
      }`;

      await expect(
        aegis.verify(tampered, undefined, { verifyExpiration: false }),
      ).rejects.toMatchObject({ code: "jwt_signature_invalid" });
    });

    test("verifyExpiration:false still rejects an aud mismatch", async () => {
      const token = signWire({ exp: nowSec() - 3600, aud: ["saga"] });

      await expect(
        aegis.verify(token, { audience: "elsewhere" }, { verifyExpiration: false }),
      ).rejects.toThrow();
      await expect(
        aegis.verify(token, { audience: "saga" }, { verifyExpiration: false }),
      ).resolves.toBeDefined();
    });

    test("verifyExpiration:false still rejects an iss mismatch", async () => {
      const token = signWire({ exp: nowSec() - 3600 });

      await expect(
        aegis.verify(
          token,
          { issuer: "https://attacker.example/" },
          { verifyExpiration: false },
        ),
      ).rejects.toThrow();
    });

    test("presence is independent: verifyExpiration:false + expPresence required rejects an exp-less token", async () => {
      const token = signWire({}); // no exp at all

      await expect(
        aegis.verify(token, undefined, { verifyExpiration: false }),
      ).rejects.toMatchObject({ code: "jwt_missing_claim_exp" });

      // Presence is the only gate left — relaxing it lets the exp-less token through.
      await expect(
        aegis.verify(token, undefined, {
          verifyExpiration: false,
          expPresence: "optional",
        }),
      ).resolves.toBeDefined();
    });

    test("verifyNotBefore:false accepts a not-yet-valid (future nbf) token", async () => {
      const token = signWire({ exp: nowSec() + 7200, nbf: nowSec() + 3600 });

      await expect(aegis.verify(token)).rejects.toThrow();
      await expect(
        aegis.verify(token, undefined, { verifyNotBefore: false }),
      ).resolves.toBeDefined();
    });

    test("verifyIssuedAt:false accepts a future-iat token", async () => {
      const token = signWire({ exp: nowSec() + 7200, iat: nowSec() + 3600 });

      await expect(aegis.verify(token)).rejects.toThrow();
      await expect(
        aegis.verify(token, undefined, { verifyIssuedAt: false }),
      ).resolves.toBeDefined();
    });

    test("verifyAuthTime:false accepts a future auth_time token", async () => {
      const token = signWire({ exp: nowSec() + 7200, auth_time: nowSec() + 3600 });

      await expect(aegis.verify(token)).rejects.toThrow();
      await expect(
        aegis.verify(token, undefined, { verifyAuthTime: false }),
      ).resolves.toBeDefined();
    });

    test("maxTokenAge stays enforced independently of verifyIssuedAt:false", async () => {
      // iat 600s old; exp still valid.
      const token = signWire({ exp: nowSec() + 3600, iat: nowSec() - 600 });

      // verifyIssuedAt:false drops the iat UPPER bound, but an explicit maxTokenAge
      // applies its own lower bound + presence regardless.
      await expect(
        aegis.verify(token, undefined, { verifyIssuedAt: false, maxTokenAge: 300 }),
      ).rejects.toThrow();
      await expect(
        aegis.verify(token, undefined, { verifyIssuedAt: false, maxTokenAge: 900 }),
      ).resolves.toBeDefined();
    });
  });

  // Regression (bug fixed 2026-07): the RAW `aegis.jwt.verify` wrapper
  // (internal/utils/raw-verify-jwt.ts) once MANUALLY enumerated the options it
  // forwarded to `JwtKit.verify`, so the per-claim temporal-skip flags were
  // SILENTLY DROPPED — `aegis.jwt.verify(token, assert, { verifyExpiration: false })`
  // on an expired token still failed temporally. The fix forwards STRUCTURALLY
  // (`const { key, ...verifyOptions } = options`). These exercise the raw path
  // directly (NOT the `aegis.verify` domain path the block above covers).
  describe("raw jwt.verify forwards verify options structurally (regression)", () => {
    afterEach(() => MockDate.set(new Date("2024-01-01T08:00:00.000Z")));

    const nowSec = () => Math.floor(Date.now() / 1000);

    const signWire = (claims: Record<string, unknown>) =>
      new JwtKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign({
        iss: issuer,
        sub: "s",
        ...claims,
      });

    test("expired token: raw verify rejects by default, resolves with verifyExpiration:false", async () => {
      const token = signWire({ exp: nowSec() - 3600 }); // expired an hour ago

      // Default: the present exp is range-checked in the kit → temporal failure.
      await expect(aegis.jwt.verify(token)).rejects.toThrow();

      // The regression assertion: without the structural forward the flag is
      // dropped and this still rejects.
      const parsed = await aegis.jwt.verify(token, undefined, {
        verifyExpiration: false,
      });
      expect(parsed.payload.sub).toBe("s");
    });

    test("verifyExpiration:false still verifies the signature on the raw path", async () => {
      const token = signWire({ exp: nowSec() - 3600 });
      // Corrupt only the signature segment: the token still decodes, but no longer
      // verifies — skipping the exp RANGE must not weaken authenticity.
      const [header, payload, signature] = token.split(".");
      const tampered = `${header}.${payload}.${signature.slice(0, -1)}${
        signature.slice(-1) === "A" ? "B" : "A"
      }`;

      await expect(
        aegis.jwt.verify(tampered, undefined, { verifyExpiration: false }),
      ).rejects.toThrow();
    });

    test("verifyNotBefore:false: raw verify rejects a future-nbf token by default, resolves with the flag", async () => {
      const token = signWire({ exp: nowSec() + 7200, nbf: nowSec() + 3600 });

      await expect(aegis.jwt.verify(token)).rejects.toThrow();
      const parsed = await aegis.jwt.verify(token, undefined, {
        verifyNotBefore: false,
      });
      expect(parsed.payload.sub).toBe("s");
    });

    test("verifyIssuedAt:false: raw verify rejects a future-iat token by default, resolves with the flag", async () => {
      const token = signWire({ exp: nowSec() + 7200, iat: nowSec() + 3600 });

      await expect(aegis.jwt.verify(token)).rejects.toThrow();
      const parsed = await aegis.jwt.verify(token, undefined, {
        verifyIssuedAt: false,
      });
      expect(parsed.payload.sub).toBe("s");
    });

    test("verifyAuthTime:false: raw verify rejects a future-auth_time token by default, resolves with the flag", async () => {
      const token = signWire({ exp: nowSec() + 7200, auth_time: nowSec() + 3600 });

      await expect(aegis.jwt.verify(token)).rejects.toThrow();
      const parsed = await aegis.jwt.verify(token, undefined, {
        verifyAuthTime: false,
      });
      expect(parsed.payload.sub).toBe("s");
    });

    // A NON-flag option (currentDate) also reaches the kit through the raw path —
    // proves the fix forwards the whole options struct, not just the four flags.
    test("currentDate reaches the kit through the raw path", async () => {
      const token = signWire({ exp: nowSec() + 3600 }); // exp at 09:00

      MockDate.set(new Date("2024-01-01T10:00:00.000Z")); // travel past expiry

      // Against the travelled clock the token is expired.
      await expect(aegis.jwt.verify(token)).rejects.toThrow();

      // A currentDate BEFORE expiry revives it — only possible if currentDate is
      // forwarded to the kit's temporal range check.
      const parsed = await aegis.jwt.verify(token, undefined, {
        currentDate: new Date("2024-01-01T08:30:00.000Z"),
      });
      expect(parsed.payload.sub).toBe("s");
    });
  });
});
