import { Amphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Aegis } from "../../classes/Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * THE ISSUER SCOPE, against two REAL remote JWKS documents that serve the SAME
 * `kid`.
 *
 * A `kid` is unique only per issuer, so two registered peers may legitimately
 * publish the same one. ⚠ An UNSCOPED lookup would search the whole vault and
 * break the tie by `createdAt` — a value taken straight off the FETCHED JWK's own
 * `iat`, so a registered issuer picks its own tiebreak and nothing compares the
 * resolved key's issuer to the token's `iss`.
 *
 * ⚠ It lives beside `resolve-key.ts` because that is the code under test, and it
 * cannot be a conformance row: the collision only exists once TWO issuers have
 * been registered and their JWKS fetched over HTTP, and the scenario table's
 * world is one vault with one issuer. The unit-level scope behaviour — matching,
 * non-matching, non-URI, URN, expired, injected — is in `resolve-key.test.ts`;
 * what is here is the END-TO-END consequence, through the public doors, with the
 * keys arriving the way a deployment's really do.
 */
describe("resolveKey — a colliding kid across two registered issuers", () => {
  const SELF = "https://self.lindorm.io/";
  const ISSUER_A = "https://iss-a.lindorm.io/";
  const ISSUER_B = "https://iss-b.lindorm.io/";
  const AUDIENCE = "https://rs.lindorm.io/";

  const SHARED_KID = "shared-kid";

  let logger: ILogger;
  let amphora: Amphora;
  let aegis: Aegis;

  // Issuer A's real signing key, and peer B's — SAME algorithm and SAME kid, so
  // nothing but the issuer scope distinguishes them. A differing `alg` would let
  // the kit's algorithm-match check reject the forgery for the wrong reason.
  let keyA: IKryptos;
  let keyB: IKryptos;

  // The public JWK each issuer serves. `iat` drives kryptos's `createdAt`, so B
  // publishes the NEWER one and would win an unscoped most-recent tiebreak. That
  // is what makes the forgery below a real test rather than a coincidence.
  const publicJwk = (kryptos: IKryptos, iat: number): Record<string, unknown> => {
    const jwk = { ...kryptos.toJWK("public"), kid: SHARED_KID, iat };
    delete jwk.iss;
    return jwk;
  };

  const claims = (iss: string): Record<string, unknown> => ({
    iss,
    sub: "user-1",
    aud: [AUDIENCE],
    iat: 1704096000,
    exp: 1704096120,
  });

  /**
   * A token signed by `kryptos` claiming whatever `iss` the caller asks for —
   * the RAW namespace, because minting through the domain pipeline would stamp
   * the honest issuer and there would be no forgery to present.
   */
  const craftJwt = async (kryptos: IKryptos, iss: string): Promise<string> => {
    const signer = new Aegis({
      amphora: new Amphora({ internal: { issuer: iss }, logger }),
      logger,
    });

    const { token } = await signer.jwt.sign(
      { ...claims(iss), jti: "token-1" },
      { key: { kryptos } },
    );

    return token;
  };

  // COSE is not left out: a CWT is a COSE_Sign1 and its payload is cleartext
  // CBOR, so the pre-verify decode reads the same UNVERIFIED `iss` the JOSE
  // decode does and scopes on it.
  const craftCwt = async (kryptos: IKryptos, iss: string): Promise<string> => {
    const signer = new Aegis({
      amphora: new Amphora({ internal: { issuer: iss }, logger }),
      logger,
    });

    const { token } = await signer.cwt.sign(
      { ...claims(iss), cti: "token-1" },
      { key: { kryptos } },
    );

    return token;
  };

  beforeEach(async () => {
    logger = createMockLogger();

    keyA = KryptosKit.generate.sig.ec({
      algorithm: "ES256",
      id: SHARED_KID,
      issuer: ISSUER_A,
      publish: true,
    });
    keyB = KryptosKit.generate.sig.ec({
      algorithm: "ES256",
      id: SHARED_KID,
      issuer: ISSUER_B,
      publish: true,
    });

    nock("https://iss-a.lindorm.io")
      .get("/.well-known/jwks.json")
      .times(1)
      .reply(200, { keys: [publicJwk(keyA, 1704067260)] });
    nock("https://iss-b.lindorm.io")
      .get("/.well-known/jwks.json")
      .times(1)
      .reply(200, { keys: [publicJwk(keyB, 1704070860)] });

    amphora = new Amphora({
      internal: { issuer: SELF },
      logger,
      external: [
        { issuer: ISSUER_A, jwksUri: "https://iss-a.lindorm.io/.well-known/jwks.json" },
        { issuer: ISSUER_B, jwksUri: "https://iss-b.lindorm.io/.well-known/jwks.json" },
      ],
    });

    await amphora.setup();

    aegis = new Aegis({ amphora, issuer: SELF, logger });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  // Without this every assertion below could hold over a vault that simply had
  // no collision in it.
  test("the collision is real, and B's key is the one the old tiebreak would pick", () => {
    const held = amphora.vault.filter((key) => key.id === SHARED_KID);

    expect(held).toHaveLength(2);
    expect(held.map((key) => key.issuer).sort()).toEqual([ISSUER_A, ISSUER_B]);

    const [newest] = [...held].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    expect(newest.issuer).toBe(ISSUER_B);
  });

  // ⭐ THE FORGERY. Peer B signs a token claiming to come from A, naming the kid
  // both issuers serve. Resolution is scoped to the `iss` the token asserts, so
  // A's key answers — and A's key did not make this signature.
  describe("a peer forging another registered issuer", () => {
    test("is refused by the domain verify", async () => {
      await expect(aegis.verify(await craftJwt(keyB, ISSUER_A))).rejects.toThrow(
        expect.objectContaining({ code: "jwt_signature_invalid" }),
      );
    });

    test("is refused by the raw claims verify", async () => {
      await expect(aegis.jwt.verify(await craftJwt(keyB, ISSUER_A))).rejects.toThrow(
        expect.objectContaining({ code: "jwt_signature_invalid" }),
      );
    });

    test("is refused on the COSE wire too", async () => {
      await expect(aegis.cwt.verify(await craftCwt(keyB, ISSUER_A))).rejects.toThrow(
        expect.objectContaining({ code: "cose_signature_invalid" }),
      );
    });

    test("is refused by the profile-less domain verify on the COSE wire", async () => {
      await expect(aegis.verify(await craftCwt(keyB, ISSUER_A))).rejects.toThrow(
        expect.objectContaining({ code: "cose_signature_invalid" }),
      );
    });
  });

  // The benign half of the same hole: an unscoped most-recent rule returns B's
  // newer colliding key for A's honest token, which then fails to verify. Scoping
  // has to narrow, not blacklist.
  describe("an honest token from either issuer", () => {
    test("issuer A's verifies despite B holding a newer colliding kid", async () => {
      await expect(aegis.verify(await craftJwt(keyA, ISSUER_A))).resolves.toMatchObject({
        claims: { issuer: ISSUER_A, subject: "user-1" },
      });
    });

    test("issuer B's verifies too", async () => {
      await expect(aegis.verify(await craftJwt(keyB, ISSUER_B))).resolves.toMatchObject({
        claims: { issuer: ISSUER_B, subject: "user-1" },
      });
    });

    test("issuer A's CWT verifies on the COSE wire", async () => {
      await expect(
        aegis.cwt.verify(await craftCwt(keyA, ISSUER_A)),
      ).resolves.toMatchObject({ payload: { iss: ISSUER_A, sub: "user-1" } });
    });
  });

  // NO FALLBACK. Were the scope to retry unscoped on a miss, an attacker would
  // not even need a collision: any kid plus any unrelated `iss` would do.
  describe("an issuer that does not hold the kid", () => {
    test("is a miss on the JOSE wire, never an unscoped retry", async () => {
      await expect(
        aegis.verify(await craftJwt(keyB, "https://iss-c.lindorm.io/")),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "verify_key_not_found",
          data: expect.objectContaining({
            kid: SHARED_KID,
            issuer: "https://iss-c.lindorm.io/",
          }),
        }),
      );
    });

    test("is a miss on the COSE wire too", async () => {
      await expect(
        aegis.cwt.verify(await craftCwt(keyB, "https://iss-c.lindorm.io/")),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "verify_key_not_found",
          data: expect.objectContaining({ issuer: "https://iss-c.lindorm.io/" }),
        }),
      );
    });
  });

  /**
   * ⭐ OUR OWN tokens are scoped too, and both halves matter: our token verifies
   * under our own scope, and our kid is NOT reachable from a peer's scope — so
   * the internal issuer is a real boundary and not a label.
   */
  test("a self-issued token is scoped to this service's own issuer", async () => {
    const keySelf = KryptosKit.generate.sig.ec({
      algorithm: "ES256",
      id: "self-kid",
      issuer: SELF,
      publish: true,
    });

    amphora.add(keySelf);

    const { token } = await aegis.jwt.sign({ ...claims(SELF), jti: "token-1" });

    await expect(aegis.jwt.verify(token)).resolves.toMatchObject({
      payload: { iss: SELF, sub: "user-1" },
    });

    // The same key, the same kid, a peer's `iss` — the scope must not find it.
    await expect(aegis.jwt.verify(await craftJwt(keySelf, ISSUER_A))).rejects.toThrow(
      expect.objectContaining({
        code: "verify_key_not_found",
        data: expect.objectContaining({ kid: "self-kid", issuer: ISSUER_A }),
      }),
    );
  });

  // A token with no `iss` has nothing to scope by, so it resolves unscoped — and
  // that is exactly when the vault's own ambiguity has to surface as an error
  // rather than as a guess.
  test("an ambiguous kid with no iss to scope by surfaces as a refusal", async () => {
    const signer = new Aegis({
      amphora: new Amphora({ internal: { issuer: ISSUER_B }, logger }),
      logger,
    });

    const { token } = await signer.jwt.sign(
      { sub: "user-1", aud: [AUDIENCE], iat: 1704096000, exp: 1704096120 },
      { key: { kryptos: keyB } },
    );

    await expect(aegis.jwt.verify(token)).rejects.toThrow(
      expect.objectContaining({
        code: "verify_key_not_found",
        debug: expect.objectContaining({ error: "Ambiguous Kryptos id" }),
      }),
    );
  });

  // The rationale `findById` exists for must survive issuer scoping: a token
  // signed by a key that has since EXPIRED still verifies. Time is the floor's
  // job, never selection's.
  test("a scoped lookup still resolves an expired key, so its tokens still verify", async () => {
    const expiring = KryptosKit.generate.sig.ec({
      algorithm: "ES256",
      issuer: SELF,
      expiresAt: new Date("2024-01-01T09:00:00.000Z"),
      publish: true,
    });

    amphora.add(expiring);

    const local = new Aegis({ amphora, issuer: SELF, logger });
    const { token } = await local.jwt.sign(
      { ...claims(SELF), exp: 4102444800, jti: "token-2" },
      { key: { kryptos: expiring } },
    );

    MockDate.set(new Date("2024-01-01T10:00:00.000Z"));

    expect(amphora.vault.find((key) => key.id === expiring.id)?.isExpired).toBe(true);

    await expect(local.jwt.verify(token)).resolves.toMatchObject({
      payload: { iss: SELF, sub: "user-1" },
    });

    MockDate.set(new Date("2024-01-01T08:00:00.000Z"));
  });
});
