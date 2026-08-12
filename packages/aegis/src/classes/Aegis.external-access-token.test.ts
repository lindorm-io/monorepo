import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { importJWK, SignJWT } from "jose";
import MockDate from "mockdate";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const RESOURCE = "https://rs.lindorm.io/";
const SUBJECT = "user-1";

/**
 * `external_access_token` — the profile a resource server selects for access
 * tokens it did NOT issue. Every token here is signed with `jose`, not with
 * aegis's own mint: what is under test is whether the floor admits a wire that
 * an ordinary third-party authorization server actually emits, so a token built
 * by the code being tested would prove nothing.
 *
 * The `iss` is the vault's issuer only so the verifying key resolves — the
 * SHAPE of each token is the third party's, which is the whole point.
 */
describe("Aegis — the external_access_token profile", () => {
  let amphora: IAmphora;
  let aegis: Aegis;
  let key: Awaited<ReturnType<typeof importJWK>>;

  // The common third-party shape: bare `typ: JWT`, several audiences, no
  // `client_id`. RFC 9068 strict refuses all three; a resource server still has
  // to accept it.
  let thirdPartyAccessToken: string;
  // No `typ` at all — RFC 7515 §4.1.9 makes it optional and plenty of issuers
  // omit it.
  let bareAccessToken: string;
  // Keycloak's `typ: Bearer`, which the WIRE layer refuses (see below).
  let bearerTypAccessToken: string;

  const signAccessToken = (
    claims: Record<string, unknown>,
    typ?: string,
  ): Promise<string> =>
    new SignJWT(claims)
      .setProtectedHeader({
        alg: "ES512",
        kid: TEST_EC_KEY_SIG.id,
        ...(typ ? { typ } : {}),
      })
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime("1h")
      .setJti("token-1")
      .sign(key);

  beforeAll(async () => {
    const jwk = TEST_EC_KEY_SIG.export("jwk") as Record<string, unknown>;
    key = await importJWK(jwk as never, "ES512");

    thirdPartyAccessToken = await signAccessToken(
      { sub: SUBJECT, aud: [RESOURCE, "account"], scope: "openid profile" },
      "JWT",
    );

    bareAccessToken = await signAccessToken({ sub: SUBJECT, aud: [RESOURCE] });

    bearerTypAccessToken = await signAccessToken(
      { sub: SUBJECT, aud: [RESOURCE] },
      "Bearer",
    );
  });

  beforeEach(async () => {
    const logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  describe("what it accepts that access_token refuses", () => {
    test("should accept a bare typ: JWT token with several audiences and no client_id", async () => {
      const verified = await aegis.verify(
        "external_access_token",
        thirdPartyAccessToken,
        undefined,
        { audience: RESOURCE, issuer: ISSUER },
      );

      expect(verified.claims.subject).toBe(SUBJECT);
      expect(verified.claims.audience).toEqual([RESOURCE, "account"]);
      expect(verified.claims.clientId).toBeUndefined();
    });

    test("should accept a token with no typ header", async () => {
      await expect(
        aegis.verify("external_access_token", bareAccessToken, undefined, {
          audience: RESOURCE,
          issuer: ISSUER,
        }),
      ).resolves.toBeDefined();
    });

    /**
     * ⚠ KNOWN LIMIT, pinned rather than papered over. Keycloak stamps
     * `typ: Bearer`, and no profile can admit it: `JwtKit.verify` refuses a
     * PRESENT typ that is neither `JWT` nor a `<type>+jwt` media type
     * (`jwt_invalid_typ`) — a WIRE-grammar guard that keeps a JWS/JWE from being
     * verified as a JWT, and it runs before any profile floor. Admitting
     * `Bearer` means relaxing that guard, which is a decision about the wire
     * layer, not about this profile.
     */
    test("should NOT reach the profile for a typ the wire layer refuses", async () => {
      await expect(
        aegis.verify("external_access_token", bearerTypAccessToken, undefined, {
          audience: RESOURCE,
          issuer: ISSUER,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "jwt_invalid_typ" }));
    });

    // The strict profile stays strict — this is the whole reason for a second
    // name rather than a loosened `access_token`.
    test("should still be refused by the strict access_token profile", async () => {
      await expect(
        aegis.verify("access_token", thirdPartyAccessToken, undefined, {
          audience: RESOURCE,
          issuer: ISSUER,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "profile_typ_mismatch" }));
    });
  });

  /**
   * ⚠ THE ID-TOKEN DEFENCE. With `typ: none` there is no structural
   * discriminator left, and `typ: JWT` is exactly what an id_token carries. The
   * id_token below is well-formed AND satisfies every other floor check — right
   * issuer, `exp`/`iat`/`jti`/`sub` present, and an `aud` that names the
   * resource server rather than the client, which defeats the mount's audience
   * check on purpose. The ONLY thing standing between it and acceptance is the
   * profile's `forbidden` list.
   */
  describe("id_token refusal", () => {
    const idTokenClaims = {
      sub: SUBJECT,
      aud: [RESOURCE],
      nonce: "n-0S6_WzA2Mj",
      at_hash: "uby9Z8Gb_H_x4fPjwNzguw",
    };

    const signIdToken = (claims: Record<string, unknown>): Promise<string> =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: "ES512", kid: TEST_EC_KEY_SIG.id, typ: "JWT" })
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setExpirationTime("1h")
        .setJti("token-1")
        .sign(key);

    test("should refuse a real, well-formed id_token", async () => {
      const idToken = await signIdToken(idTokenClaims);

      await expect(
        aegis.verify("external_access_token", idToken, undefined, {
          audience: RESOURCE,
          issuer: ISSUER,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "forbidden_claims_present",
          data: expect.objectContaining({ forbidden: ["nonce", "accessTokenHash"] }),
        }),
      );
    });

    // Each id_token claim is refused ON ITS OWN, so a token carrying only one of
    // them cannot slip through.
    test.each([
      ["nonce", { nonce: "n-0S6_WzA2Mj" }, "nonce"],
      ["at_hash", { at_hash: "uby9Z8Gb_H_x4fPjwNzguw" }, "accessTokenHash"],
      ["c_hash", { c_hash: "TT-mXNvl57l-BcINg6sBWQ" }, "codeHash"],
      ["s_hash", { s_hash: "sRiXnuhZcAIVMpbUvyTPtw" }, "stateHash"],
    ])("should refuse a token carrying %s alone", async (_, claim, domain) => {
      const token = await signIdToken({ sub: SUBJECT, aud: [RESOURCE], ...claim });

      await expect(
        aegis.verify("external_access_token", token, undefined, {
          audience: RESOURCE,
          issuer: ISSUER,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "forbidden_claims_present",
          data: expect.objectContaining({ forbidden: [domain] }),
        }),
      );
    });

    // The same token WITHOUT the id_token claims passes every other check —
    // which is what proves the refusals above are the forbidden list biting,
    // not some incidental floor failure.
    test("should accept the same token once the id_token claims are gone", async () => {
      const token = await signIdToken({ sub: SUBJECT, aud: [RESOURCE] });

      await expect(
        aegis.verify("external_access_token", token, undefined, {
          audience: RESOURCE,
          issuer: ISSUER,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe("what it does NOT relax", () => {
    test("should require an exp (lifetime is non-null)", async () => {
      const token = await new SignJWT({ sub: SUBJECT, aud: [RESOURCE] })
        .setProtectedHeader({ alg: "ES512", kid: TEST_EC_KEY_SIG.id })
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setJti("token-1")
        .sign(key);

      await expect(
        aegis.verify("external_access_token", token, undefined, {
          audience: RESOURCE,
          issuer: ISSUER,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "missing_claim_exp" }));
    });

    test("should require sub and jti", async () => {
      const token = await new SignJWT({ aud: [RESOURCE] })
        .setProtectedHeader({ alg: "ES512", kid: TEST_EC_KEY_SIG.id })
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(key);

      await expect(
        aegis.verify("external_access_token", token, undefined, {
          audience: RESOURCE,
          issuer: ISSUER,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "required_claims_missing",
          data: expect.objectContaining({ missing: ["subject", "tokenId"] }),
        }),
      );
    });

    test("should require the verifier's own identity in aud", async () => {
      await expect(
        aegis.verify("external_access_token", thirdPartyAccessToken, undefined, {
          audience: "https://other-rs.lindorm.io/",
          issuer: ISSUER,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "audience_mismatch" }));
    });

    /**
     * The profile declares `use: "verify"`, so mint refuses it OUTRIGHT — a
     * profile that exists to check a third party's token has no business
     * emitting one under our own signature.
     *
     * `autoInject: []` used to be the only thing standing in the way, and it was
     * a mitigation rather than a guard: it made the ACCIDENTAL mint fail on the
     * `iss`/`iat`/`jti` it would not generate, while a caller who hand-supplied
     * all three still got a degraded access token. This supplies all three on
     * purpose, so the refusal cannot be the envelope's doing.
     */
    // `iat`/`jti` are envelope OPTIONS, not content — supplied here so the mint
    // is complete and the refusal cannot be mistaken for the old envelope
    // failure.
    const mintContent = { issuer: "https://other-idp.lindorm.io/", subject: SUBJECT, audience: [RESOURCE] }; // prettier-ignore
    const mintOptions = { sign: { issuedAt: new Date(), tokenId: "token-1" } };

    test("should refuse to mint — the profile is verify-only", async () => {
      await expect(
        // @ts-expect-error a verify-only profile takes no mint content
        // (`ProfileContentFor` resolves it to `never`) — the compiler kills the
        // call site as well as the runtime.
        aegis.mint("external_access_token", mintContent, mintOptions),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "profile_not_mintable",
          data: expect.objectContaining({
            profile: "external_access_token",
            use: "verify",
          }),
        }),
      );
    });

    test("should refuse to mint it as a CWT too", async () => {
      await expect(
        // @ts-expect-error a verify-only profile takes no mint content
        aegis.mint("external_access_token", mintContent, {
          ...mintOptions,
          format: "cwt",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "profile_not_mintable" }));
    });

    // `issuer: "per-token"` — the deployment's own issuer is never assumed for a
    // third party's token, so a mount that declares one gets it enforced exactly.
    test("should enforce the issuer the mount declared", async () => {
      await expect(
        aegis.verify("external_access_token", thirdPartyAccessToken, undefined, {
          audience: RESOURCE,
          issuer: "https://other-idp.lindorm.io/",
        }),
      ).rejects.toThrow();
    });
  });
});
