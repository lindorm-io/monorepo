import { Amphora, type IAmphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { importJWK, SignJWT } from "jose";
import MockDate from "mockdate";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG } from "../__fixtures__/keys.js";
import { AegisDomainError } from "../errors/index.js";
import { B64U } from "../internal/constants/format.js";
import { createJoseSignature } from "../internal/utils/jose-signature.js";
import { Aegis } from "./Aegis.js";
import { beforeEach, describe, expect, test } from "vitest";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const RESOURCE = "https://rs.lindorm.io/";

// Hand-built JWS so the header/payload carry EXACTLY the given fields — mint
// always stamps a typ and auto-injects iat, so a typ-less or iat-less token
// can only be produced at the wire level.
const craftToken = (header: Dict, payload: Dict): string => {
  const encodedHeader = B64.encode(JSON.stringify(header), B64U);
  const encodedPayload = B64.encode(JSON.stringify(payload), B64U);
  const signature = createJoseSignature({
    header: encodedHeader,
    payload: encodedPayload,
    kryptos: TEST_EC_KEY_SIG,
  });
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

const wireHeader = {
  alg: TEST_EC_KEY_SIG.algorithm,
  kid: TEST_EC_KEY_SIG.id,
};

// A per-token-issuer payload (iss = sub = the client), the shape `delegation`
// carries on the wire.
const perTokenPayload = {
  iss: "client-1",
  sub: "client-1",
  aud: [ISSUER],
  iat: 1704096000,
  exp: 1704096120,
  jti: "token-1",
};

describe("Aegis profiled verify floor (§4.4)", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  const mintAccessToken = () =>
    aegis.mint("access_token", {
      subject: "user-1",
      audience: [RESOURCE],
      clientId: "client-1",
    });

  test("accepts a token whose aud contains the verifier identity", async () => {
    const { token } = await mintAccessToken();

    await expect(
      aegis.verify("access_token", token, undefined, { audience: RESOURCE }),
    ).resolves.toMatchObject({
      claims: { subject: "user-1" },
    });
  });

  test("rejects when aud does not contain the verifier identity", async () => {
    const { token } = await mintAccessToken();

    await expect(
      aegis.verify("access_token", token, undefined, { audience: "https://wrong-rs" }),
    ).rejects.toThrow(AegisDomainError);
  });

  // A pinned issuer now bites EARLIER than the floor: it scopes the key lookup,
  // so a token whose `kid` is not registered under the pinned issuer is refused
  // before its signature is ever checked. Same verdict, sharper reason — and it
  // is the whole point of the scope (a colliding kid from another registered
  // issuer never reaches the signature). The floor's `issuer_mismatch` still
  // owns the case where the key IS under the pinned issuer but the `iss` claim
  // disagrees — covered by the per-token-issuer tests below.
  test("rejects a wrong issuer, at key resolution", async () => {
    const { token } = await mintAccessToken();

    await expect(
      aegis.verify("access_token", token, undefined, {
        audience: RESOURCE,
        issuer: "https://not-the-issuer/",
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        code: "verify_key_not_found",
        data: expect.objectContaining({ issuer: "https://not-the-issuer/" }),
      }),
    );
  });

  // The floor's issuer check is NOT dead: when the key IS registered under the
  // pinned issuer, resolution succeeds and the claim comparison is what rejects.
  test("rejects a token whose iss claim disagrees with a resolvable pinned issuer", async () => {
    const token = craftToken(
      { ...wireHeader, typ: "application/at+jwt" },
      {
        iss: "https://someone-else.lindorm.io/",
        sub: "user-1",
        aud: [RESOURCE],
        iat: 1704096000,
        exp: 1704096120,
        jti: "token-1",
        client_id: "client-1",
      },
    );

    await expect(
      aegis.verify("access_token", token, undefined, {
        audience: RESOURCE,
        issuer: ISSUER,
      }),
    ).rejects.toThrow(expect.objectContaining({ code: "issuer_mismatch" }));
  });

  test("rejects a typ mismatch (id_token verified as access_token)", async () => {
    const { token } = await aegis.mint("id_token", {
      subject: "user-1",
      audience: [RESOURCE],
    });

    await expect(
      aegis.verify("access_token", token, undefined, { audience: RESOURCE }),
    ).rejects.toThrow(AegisDomainError);
  });

  test("rejects an absent typ for a required-presence profile", async () => {
    const token = craftToken(wireHeader, {
      ...perTokenPayload,
      iss: ISSUER,
      sub: "user-1",
      aud: [RESOURCE],
      client_id: "client-1",
    });

    await expect(
      aegis.verify("access_token", token, undefined, { audience: RESOURCE }),
    ).rejects.toThrow(expect.objectContaining({ code: "profile_typ_mismatch" }));
  });

  test("rejects an access token with no iat — presence policy lives in the floor", async () => {
    // The parse gate does not require iat, so the profile floor is what keeps
    // RFC 9068's REQUIRED iat honest.
    const token = craftToken(
      { ...wireHeader, typ: "application/at+jwt" },
      {
        iss: ISSUER,
        sub: "user-1",
        aud: [RESOURCE],
        exp: 1704096120,
        jti: "access-1",
        client_id: "client-1",
      },
    );

    await expect(
      aegis.verify("access_token", token, undefined, { audience: RESOURCE }),
    ).rejects.toThrow(
      expect.objectContaining({
        code: "required_claims_missing",
        data: expect.objectContaining({ missing: ["issuedAt"] }),
      }),
    );
  });

  test("raw jwt.verify ACCEPTS a typ-less JWT (typ presence is a profile/domain policy now)", async () => {
    // The raw kit keeps only typ WELL-FORMEDNESS-if-present (D3): typ presence is
    // a profile / domain policy, not a raw-kit gate. So the raw wire surface
    // accepts a typ-less signed token and returns its native WIRE payload.
    const token = craftToken(wireHeader, {
      ...perTokenPayload,
      iss: ISSUER,
      sub: "user-1",
      aud: [RESOURCE],
    });

    const parsed = await aegis.jwt.verify(token);
    expect(parsed.payload.iss).toBe(ISSUER);
    expect(parsed.protectedHeader.typ).toBeUndefined();
  });

  describe("mint → profiled verify round trips", () => {
    test("access_token", async () => {
      const { token } = await mintAccessToken();

      await expect(
        aegis.verify("access_token", token, undefined, { audience: RESOURCE }),
      ).resolves.toMatchObject({
        claims: { subject: "user-1", clientId: "client-1" },
      });
    });

    test("id_token", async () => {
      const { token } = await aegis.mint("id_token", {
        subject: "user-1",
        audience: ["client-1"],
      });

      await expect(
        aegis.verify("id_token", token, undefined, { audience: "client-1" }),
      ).resolves.toMatchObject({
        claims: { subject: "user-1", issuer: ISSUER },
      });
    });

    test("security_event (COSE) — subjectId and events reach the floor", async () => {
      const { token } = await aegis.mint(
        "security_event",
        {
          audience: ["https://receiver"],
          subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
          events: { "urn:lindorm:event:test": {} },
        },
        { format: "cwt" },
      );

      await expect(
        aegis.verify("security_event", token, undefined, {
          audience: "https://receiver",
        }),
      ).resolves.toMatchObject({
        claims: {
          subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
          events: { "urn:lindorm:event:test": {} },
        },
      });
    });

    test("security_event (JOSE) — exp-less SET round-trips, subjectId and events reach the floor", async () => {
      // exp presence is now POLICY, not structure: the security_event profile
      // has `lifetime: null`, so profiled verify passes expPresence "optional"
      // and the exp-less JOSE SET verifies — mirroring the COSE path above.
      const { token } = await aegis.mint("security_event", {
        audience: ["https://receiver"],
        subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
        events: { "urn:lindorm:event:test": {} },
      });

      // JOSE parse is domain-keyed via the registry-complete `joseToDomain`
      // translator (Phase 4): both `subjectId` (wire `sub_id`, RFC 9493) AND
      // `events` (wire `events`, RFC 8417) are registered, so both are
      // domain-extracted onto `payload` — `events` no longer falls through to
      // the custom `payload.claims` bag.
      await expect(
        aegis.verify("security_event", token, undefined, {
          audience: "https://receiver",
        }),
      ).resolves.toMatchObject({
        claims: {
          subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
          events: { "urn:lindorm:event:test": {} },
        },
      });
    });
  });

  describe("exp presence policy (parse-time structure vs verify-time policy)", () => {
    // A profile-less (raw) verify: exp presence defaults to "required", so an
    // exp-less token is rejected at the matcher — NOT at the parse gate, which
    // no longer requires exp. Passing `expPresence: "optional"` accepts it.
    // Hand-built via craftToken (signed with the amphora-registered key), the
    // wire-level way to put an exp-less JWS on the wire.
    const explessToken = () =>
      craftToken(
        { ...wireHeader, typ: "application/at+jwt" },
        { iss: ISSUER, sub: "user-1", aud: [RESOURCE], iat: 1704096000, jti: "no-exp-1" },
      );

    test("profile-less verify REJECTS an exp-less token by default (clear error)", async () => {
      await expect(aegis.verify(explessToken())).rejects.toThrow(
        expect.objectContaining({ code: "missing_claim_exp" }),
      );
    });

    test("profile-less verify ACCEPTS an exp-less token with expPresence 'optional'", async () => {
      await expect(
        aegis.verify(explessToken(), undefined, { expPresence: "optional" }),
      ).resolves.toMatchObject({
        claims: { subject: "user-1", issuer: ISSUER },
      });
    });

    test("a finite-lifetime profile still REJECTS an exp-less token (floor)", async () => {
      // access_token has a finite lifetime, so verifyProfile keeps expPresence
      // "required" — the exp-less craftToken token is rejected. (enforceVerifyFloor
      // is the belt-and-suspenders backstop for the same rule.)
      const token = craftToken(
        { ...wireHeader, typ: "application/at+jwt" },
        {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          iat: 1704096000,
          jti: "access-no-exp",
          client_id: "client-1",
        },
      );

      await expect(
        aegis.verify("access_token", token, undefined, { audience: RESOURCE }),
      ).rejects.toThrow(expect.objectContaining({ code: "missing_claim_exp" }));
    });
  });

  describe("delegation (per-token issuer)", () => {
    const delegationHeader = { ...wireHeader, typ: "application/delegation+jwt" };

    test("mints and verifies its own delegation token", async () => {
      const { token } = await aegis.mint("delegation", {
        issuer: "client-1",
        subject: "customer-sub",
        audience: [ISSUER],
      });

      // jti auto-injected at mint; the floor's required-claims check passes.
      await expect(
        aegis.verify("delegation", token, undefined, {
          audience: ISSUER,
          issuer: "client-1",
        }),
      ).resolves.toMatchObject({
        claims: { issuer: "client-1", subject: "customer-sub" },
      });
    });

    test("accepts a token WITHOUT an iat claim (the profile does not require it)", async () => {
      // The mirror of the access_token case above: the parse gate does not
      // require iat, and the floor requires it only where the profile asks.
      // `delegation` omits `issuedAt` from `required` (iat is RECOMMENDED, not
      // REQUIRED), so an iat-less delegation resolves.
      const { iat: _iat, ...withoutIat } = perTokenPayload;
      const token = craftToken(delegationHeader, withoutIat);

      const parsed = await aegis.verify("delegation", token, undefined, {
        audience: ISSUER,
        issuer: "client-1",
      });

      expect(parsed.claims.issuedAt).toBeUndefined();
      expect(parsed).toMatchObject({
        claims: { issuer: "client-1", subject: "client-1", tokenId: "token-1" },
      });
    });

    test("rejects a token missing the required jti", async () => {
      const { jti: _jti, ...withoutJti } = perTokenPayload;
      const token = craftToken(delegationHeader, withoutJti);

      await expect(
        aegis.verify("delegation", token, undefined, {
          audience: ISSUER,
          issuer: "client-1",
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "required_claims_missing",
          data: expect.objectContaining({ missing: ["tokenId"] }),
        }),
      );
    });

    test("rejects a token with an empty-string jti", async () => {
      const token = craftToken(delegationHeader, { ...perTokenPayload, jti: "" });

      await expect(
        aegis.verify("delegation", token, undefined, {
          audience: ISSUER,
          issuer: "client-1",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "required_claims_missing" }));
    });
  });

  /**
   * `algClass` is a claim about what a valid signature PROVES, so it has to bite
   * where someone else's token is checked — `access_token` declares
   * `asymmetric` precisely because a shared MAC secret lets every holder FORGE a
   * token, and a mint-only constraint defends nobody against that.
   *
   * Every token here is signed with `jose` and an HS256 key the vault also
   * holds. It cannot be built with `aegis.mint`: the same `algClass` is part of
   * the SIGNING floor, so mint never selects a symmetric key for these profiles
   * — a mint-built fixture could not reach the hole this covers.
   */
  describe("algClass floor on verify", () => {
    const hsHeader = {
      alg: "HS256" as const,
      kid: TEST_OCT_KEY_SIG.id,
    };

    const signHs256 = async (claims: Dict, typ?: string): Promise<string> => {
      const key = await importJWK(
        TEST_OCT_KEY_SIG.export("jwk") as Record<string, unknown>,
        "HS256",
      );

      return new SignJWT(claims)
        .setProtectedHeader({ ...hsHeader, ...(typ ? { typ } : {}) })
        .sign(key);
    };

    beforeEach(() => {
      amphora.add(TEST_OCT_KEY_SIG);
    });

    test("rejects an HS-signed access token — a shared secret cannot prove who issued it", async () => {
      const token = await signHs256(
        {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          iat: 1704096000,
          exp: 1704096120,
          jti: "forged-1",
          client_id: "client-1",
        },
        "application/at+jwt",
      );

      await expect(
        aegis.verify("access_token", token, undefined, { audience: RESOURCE }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "algorithm_not_permitted",
          data: expect.objectContaining({ algorithm: "HS256" }),
        }),
      );
    });

    test("rejects an HS-signed external access token", async () => {
      const token = await signHs256({
        iss: ISSUER,
        sub: "user-1",
        aud: [RESOURCE],
        iat: 1704096000,
        exp: 1704096120,
        jti: "forged-2",
      });

      await expect(
        aegis.verify("external_access_token", token, undefined, {
          audience: RESOURCE,
          issuer: ISSUER,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "algorithm_not_permitted" }));
    });

    test("rejects an HS-signed delegation token", async () => {
      const token = await signHs256(
        { ...perTokenPayload, aud: [ISSUER] },
        "application/delegation+jwt",
      );

      await expect(
        aegis.verify("delegation", token, undefined, {
          audience: ISSUER,
          issuer: "client-1",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "algorithm_not_permitted" }));
    });

    // The rule is the profile's, not a blanket ban: a profile that declares no
    // algClass still accepts an HS-signed token. `security_event` is the RFC
    // 8417 / SSF case whose own example header is `{"alg":"HS256"}`.
    test("accepts an HS-signed token for a profile that declares no algClass", async () => {
      const token = await signHs256(
        {
          iss: ISSUER,
          aud: ["https://receiver"],
          iat: 1704096000,
          jti: "set-1",
          sub_id: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
          events: { "urn:lindorm:event:test": {} },
        },
        "application/secevent+jwt",
      );

      await expect(
        aegis.verify("security_event", token, undefined, {
          audience: "https://receiver",
        }),
      ).resolves.toMatchObject({ claims: { issuer: ISSUER } });
    });

    // The asymmetric round trip is untouched — the floor rejects the CLASS, not
    // every token that reaches it.
    test("still accepts the asymmetric access token it always did", async () => {
      const { token } = await mintAccessToken();

      await expect(
        aegis.verify("access_token", token, undefined, { audience: RESOURCE }),
      ).resolves.toMatchObject({ claims: { subject: "user-1" } });
    });
  });
});
