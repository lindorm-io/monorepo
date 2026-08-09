import { Amphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Aegis } from "./Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * A `kid` is unique only PER ISSUER. Two registered issuers can therefore serve
 * the SAME kid, and the read side used to resolve a bare kid across the whole
 * vault — picking the most recent by `createdAt`, a value that comes straight
 * off the FETCHED JWK's own `iat`. A registered issuer thus chose its own
 * tiebreak, and nothing anywhere compared the resolved key's issuer to the
 * token's `iss`.
 *
 * These tests pin both directions of that hole shut:
 *   FORGERY  — peer B mints a token claiming `iss: A`, signed with B's key,
 *              naming the colliding kid. It must NOT verify.
 *   BENIGN   — A's own valid token must still verify even though B holds a
 *              colliding, NEWER kid that would previously have won.
 */
describe("Aegis issuer-scoped key resolution", () => {
  const SELF = "https://self.lindorm.io/";
  const ISSUER_A = "https://iss-a.lindorm.io/";
  const ISSUER_B = "https://iss-b.lindorm.io/";
  const AUDIENCE = "https://rs.lindorm.io/";

  const SHARED_KID = "shared-kid";

  let logger: ILogger;
  let amphora: Amphora;
  let aegis: Aegis;

  // Issuer A's real signing key, and peer B's — SAME algorithm and SAME kid, so
  // nothing but the issuer scope distinguishes them. (A differing `alg` would let
  // the kit's algorithm-match check reject the forgery for the wrong reason.)
  let keyA: IKryptos;
  let keyB: IKryptos;

  // The public JWK each issuer serves. `iat` drives kryptos's `createdAt`, and
  // `createdAt` was the old tiebreak — so B publishes the NEWER one, i.e. B wins
  // the collision under the old rule. That is what makes the forgery test a real
  // regression test rather than a coincidence.
  const publicJwk = (kryptos: IKryptos, iat: number) => {
    const jwk = { ...kryptos.toJWK("public"), kid: SHARED_KID, iat };
    delete jwk.iss;
    return jwk;
  };

  // A token signed by `kryptos` under the given `kid`, claiming whatever `iss`
  // the caller asks for — the raw wire, because minting through aegis would
  // stamp the honest issuer.
  const craft = async (kryptos: IKryptos, iss: string): Promise<string> => {
    const signer = new Aegis({
      amphora: new Amphora({ internal: { issuer: iss }, logger }),
      logger,
    });

    const { token } = await signer.jwt.sign(
      {
        iss,
        sub: "user-1",
        aud: [AUDIENCE],
        iat: 1704096000,
        exp: 1704096120,
        jti: "token-1",
      },
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
      // NEWER than A — B would win the old `createdAt` tiebreak.
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

  test("the collision is real and B's key is the one the old tiebreak would pick", () => {
    const held = amphora.vault.filter((k) => k.id === SHARED_KID);

    expect(held).toHaveLength(2);
    expect(held.map((k) => k.issuer).sort()).toEqual([ISSUER_A, ISSUER_B]);

    const [newest] = [...held].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    expect(newest.issuer).toBe(ISSUER_B);
  });

  // ⭐ THE FORGERY. Peer B signs a token that claims to come from A, naming the
  // kid both issuers serve. Resolution is scoped to the `iss` the token asserts,
  // so A's key answers, and A's key did not make this signature.
  test("rejects a token forging another registered issuer with a colliding kid", async () => {
    const forged = await craft(keyB, ISSUER_A);

    await expect(aegis.verify(forged)).rejects.toThrow(
      expect.objectContaining({ code: "jwt_signature_invalid" }),
    );
  });

  test("rejects the same forgery through the raw jwt namespace", async () => {
    const forged = await craft(keyB, ISSUER_A);

    await expect(aegis.jwt.verify(forged)).rejects.toThrow(
      expect.objectContaining({ code: "jwt_signature_invalid" }),
    );
  });

  // The benign half of the same hole: under the old most-recent rule B's newer
  // colliding key was returned for A's honest token, and it failed to verify.
  test("accepts issuer A's own token despite B holding a newer colliding kid", async () => {
    const honest = await craft(keyA, ISSUER_A);

    await expect(aegis.verify(honest)).resolves.toMatchObject({
      claims: { issuer: ISSUER_A, subject: "user-1" },
    });
  });

  test("accepts issuer B's own token too — scoping narrows, it does not blacklist", async () => {
    const honest = await craft(keyB, ISSUER_B);

    await expect(aegis.verify(honest)).resolves.toMatchObject({
      claims: { issuer: ISSUER_B, subject: "user-1" },
    });
  });

  // NO FALLBACK: an `iss` naming an issuer that does not hold the kid must fail,
  // never retry unscoped. Were it to fall back, an attacker would not even need
  // a collision — any kid plus any unrelated `iss` would do.
  test("does NOT fall back to an unscoped search when the named issuer lacks the kid", async () => {
    const forged = await craft(keyB, "https://iss-c.lindorm.io/");

    await expect(aegis.verify(forged)).rejects.toThrow(
      expect.objectContaining({
        code: "verify_key_not_found",
        data: expect.objectContaining({
          kid: SHARED_KID,
          issuer: "https://iss-c.lindorm.io/",
        }),
      }),
    );
  });

  // A token with no `iss` has nothing to scope by, so it resolves unscoped — and
  // that is exactly when the vault's own ambiguity has to surface as an error
  // rather than a guess.
  test("surfaces the ambiguity when a token carries no iss to scope by", async () => {
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

  // COSE is not the format left out. A CWT is a COSE_Sign1 and a CWM a
  // COSE_Mac0 — the payload is cleartext CBOR either way — so the pre-verify
  // decode reads the same UNVERIFIED `iss` the JOSE decode does, and scopes on it.
  describe("COSE", () => {
    const cwt = (kryptos: IKryptos, iss: string) =>
      new Aegis({
        amphora: new Amphora({ internal: { issuer: iss }, logger }),
        logger,
      }).cwt.sign(
        {
          iss,
          sub: "user-1",
          aud: [AUDIENCE],
          iat: 1704096000,
          exp: 1704096120,
          cti: "token-1",
        },
        { key: { kryptos } },
      );

    test("rejects a CWT forging another registered issuer with a colliding kid", async () => {
      const { token } = await cwt(keyB, ISSUER_A);

      await expect(aegis.cwt.verify(token)).rejects.toThrow(
        expect.objectContaining({ code: "cose_signature_invalid" }),
      );
    });

    test("accepts issuer A's own CWT despite B holding a newer colliding kid", async () => {
      const { token } = await cwt(keyA, ISSUER_A);

      await expect(aegis.cwt.verify(token)).resolves.toMatchObject({
        payload: { iss: ISSUER_A, sub: "user-1" },
      });
    });

    test("rejects the forgery through the profile-less domain verify too", async () => {
      const { token } = await cwt(keyB, ISSUER_A);

      await expect(aegis.verify(token)).rejects.toThrow(
        expect.objectContaining({ code: "cose_signature_invalid" }),
      );
    });

    test("does NOT fall back when the CWT names an issuer without the kid", async () => {
      const { token } = await cwt(keyB, "https://iss-c.lindorm.io/");

      await expect(aegis.cwt.verify(token)).rejects.toThrow(
        expect.objectContaining({
          code: "verify_key_not_found",
          data: expect.objectContaining({ issuer: "https://iss-c.lindorm.io/" }),
        }),
      );
    });
  });

  // Issuer scoping makes two separately-configured strings load-bearing: amphora
  // stamps every key we add with ITS issuer, a token we mint carries AEGIS's. A
  // difference that was invisible before is now a hard failure to resolve our
  // own signing key, and the error it produces does not point at the cause — so
  // say it once, at construction.
  describe("issuer coherence", () => {
    test("warns when the aegis issuer differs from the amphora issuer", () => {
      const child = createMockLogger();
      const parent = createMockLogger();
      vi.mocked(parent.child).mockReturnValue(child);

      new Aegis({ amphora, issuer: "https://other.lindorm.io/", logger: parent });

      expect(child.warn).toHaveBeenCalledWith(
        "Aegis issuer differs from the amphora issuer; verification of self-issued tokens will fail",
        { aegis: "https://other.lindorm.io/", amphora: SELF },
      );
    });

    test("stays silent when they agree", () => {
      const child = createMockLogger();
      const parent = createMockLogger();
      vi.mocked(parent.child).mockReturnValue(child);

      new Aegis({ amphora, issuer: SELF, logger: parent });

      expect(child.warn).not.toHaveBeenCalled();
    });

    // A verify-only deployment declares no issuer of its own on amphora; there is
    // nothing to disagree with, so an aegis issuer is not a misconfiguration.
    test("stays silent when amphora declares no internal issuer", () => {
      const child = createMockLogger();
      const parent = createMockLogger();
      vi.mocked(parent.child).mockReturnValue(child);

      new Aegis({
        amphora: new Amphora({ logger: parent }),
        issuer: "https://only-aegis.lindorm.io/",
        logger: parent,
      });

      expect(child.warn).not.toHaveBeenCalled();
    });
  });

  // The rationale `findById` exists for must survive issuer scoping: a token
  // signed by a key that has since EXPIRED still verifies. Time is the floor's
  // job (VERIFY_FLOOR forbids `isPending`, not `isExpired`), never selection's.
  test("a scoped lookup still resolves an EXPIRED key, so its tokens still verify", async () => {
    const expiring = KryptosKit.generate.sig.ec({
      algorithm: "ES256",
      issuer: SELF,
      expiresAt: new Date("2024-01-01T09:00:00.000Z"),
      publish: true,
    });
    amphora.add(expiring);

    const local = new Aegis({ amphora, issuer: SELF, logger });
    const { token } = await local.jwt.sign(
      {
        iss: SELF,
        sub: "user-1",
        aud: [AUDIENCE],
        iat: 1704096000,
        exp: 4102444800,
        jti: "token-2",
      },
      { key: { kryptos: expiring } },
    );

    MockDate.set(new Date("2024-01-01T10:00:00.000Z"));

    expect(amphora.vault.find((k) => k.id === expiring.id)?.isExpired).toBe(true);

    await expect(local.jwt.verify(token)).resolves.toMatchObject({
      payload: { iss: SELF, sub: "user-1" },
    });

    MockDate.set(new Date("2024-01-01T08:00:00.000Z"));
  });
});
