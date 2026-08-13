import { Amphora, type IAmphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import { KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
} from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { JweKit } from "../../classes/JweKit.js";
import { JwtKit } from "../../classes/JwtKit.js";

const MOCKED = new Date("2024-01-01T08:00:00.000Z");

MockDate.set(MOCKED);

const ISSUER = "https://test.lindorm.io/";

/**
 * The `aegis.<kit>` NAMESPACE WRAPPERS — the `raw-sign-*`, `raw-verify-*` and
 * `raw-encrypt-*` modules beside this file, each of which stands between a
 * caller's option bag and the kit that consumes it.
 *
 * ⚠ THIS IS THE ONE THING THEY DO, AND THE ONLY THING THAT CAN GO WRONG IN THEM.
 * Each wrapper strips the aegis-only `key` SELECTOR and forwards the remainder to
 * the kit. Every one of them once enumerated the forwarded fields BY HAND, so a
 * field left off the list was accepted from the caller and silently dropped —
 * invisible in both directions, because the compiler sees a well-typed literal
 * and a dropped option does not raise, it just does nothing. The fix in each was
 * to forward STRUCTURALLY (`const { key, ...rest }`), and these are what hold it.
 *
 * ⚠ NOT conformance rows, and they cannot be. A row asserts a CAPABILITY of the
 * domain surface; this is a statement about one internal seam, and the option it
 * carries is deliberately arbitrary — the point is that WHATEVER the caller
 * states arrives, not that a particular parameter is honoured. The knob matrix
 * makes the equivalent statement for the DOMAIN bags (`VerifyOptions`,
 * `ProfileMintOptions`, `EncryptOptions`); the raw namespaces are the seam it
 * does not reach.
 *
 * The carrier option is `unprotected` throughout, chosen because it is the one
 * bag whose contents are visible on the wire without being derived from anything
 * else — a value that arrives there arrived because the wrapper carried it.
 */
describe("the raw namespace wrappers", () => {
  const X5U = "https://certs.lindorm.io/leaf.pem";

  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  // The COSE_Mac0 namespaces need a SYMMETRIC signing key, and it gets its own
  // vault: a second signing resident on the shared one would make the keyless
  // cwt/cws key selection non-deterministic.
  let macAmphora: IAmphora;
  let macAegis: Aegis;

  const claims = {
    iss: ISSUER,
    sub: "user-1",
    aud: ["https://rs.lindorm.io/"],
    exp: 1704099600, // 09:00:00Z
  };

  beforeEach(async () => {
    MockDate.set(MOCKED);

    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG); // ES512 — COSE_Sign1 / JWS
    amphora.add(TEST_EC_KEY_ENC); // ECDH-ES recipient — JWE
    amphora.add(TEST_OCT_KEY_ENC); // dir recipient — COSE_Encrypt0

    const macLogger = createMockLogger();
    macAmphora = new Amphora({ internal: { issuer: ISSUER }, logger: macLogger });
    macAegis = new Aegis({ amphora: macAmphora, logger: macLogger });
    await macAmphora.setup();
    macAmphora.add(TEST_OCT_KEY_SIG); // HS256 — COSE_Mac0
  });

  describe("a write wrapper forwards the caller's option bag to the kit", () => {
    test("cwt.sign", async () => {
      const { token } = await aegis.cwt.sign(claims, {
        tokenType: "at",
        unprotected: { x5u: X5U },
      });

      const parsed = await aegis.cwt.verify(token);

      expect(parsed.unprotectedHeader.x5u).toBe(X5U);
      expect(parsed.protectedHeader.typ).toBe("application/at+cwt");
    });

    test("cwm.sign", async () => {
      const signed = await macAegis.cwm.sign(claims, {
        tokenType: "at",
        unprotected: { x5u: X5U },
      });

      const parsed = await macAegis.cwm.verify(signed.token);

      expect(parsed.unprotectedHeader.x5u).toBe(X5U);
      // A COSE_Mac0 shares the CWT media type — the STRUCTURE is what tells the
      // two apart, not the typ.
      expect(parsed.protectedHeader.typ).toBe("application/at+cwt");
    });

    test("cws.sign", async () => {
      const signed = await aegis.cws.sign(
        { tid: "at_abc" },
        { tokenType: "at", unprotected: { x5u: X5U } },
      );

      const parsed = await aegis.cws.verify<Record<string, unknown>>(signed.token);

      expect(parsed.unprotectedHeader.x5u).toBe(X5U);
      expect(parsed.protectedHeader.typ).toBe("application/at+cws");
    });

    test("cwe.encrypt", async () => {
      const { token } = await aegis.cwe.encrypt("hello cose", {
        tokenType: "at",
        unprotected: { x5u: X5U },
      });

      const { protectedHeader, unprotectedHeader } = await aegis.cwe.decrypt(token);

      expect(unprotectedHeader.x5u).toBe(X5U);
      expect(protectedHeader.typ).toBe("application/at+cwe");
    });

    // The JOSE compact serialisation has no unprotected bucket (RFC 7515 §7.1),
    // so the carrier here is the ECDH-ES party info — two parameters that reach
    // the wire AND the key derivation, so a dropped one is doubly visible.
    test("jwe.encrypt", async () => {
      const partyProducer = B64.encode(Buffer.from("producer"), "b64u");
      const partyRecipient = B64.encode(Buffer.from("recipient"), "b64u");

      const { token } = await aegis.jwe.encrypt("opaque-payload", {
        tokenType: "at",
        partyProducer,
        partyRecipient,
        // ⚠ PINNED, and it must be. Party info is a key-AGREEMENT input (RFC 7518
        // §4.6), so it is correctly stripped for a symmetric `dir` recipient —
        // and this vault holds one. An unpinned recipient is whichever the query
        // returns first, which is a coin toss this test would then be measuring
        // instead of the forward. `key` is also the one aegis-only field the
        // wrapper must strip OUT, so pinning it exercises both halves at once.
        key: { condition: { id: TEST_EC_KEY_ENC.id } },
      });

      const { protectedHeader: header } = JweKit.decode(token);

      expect(header.apu).toBe(partyProducer);
      expect(header.apv).toBe(partyRecipient);
      expect(header.typ).toBe("application/at+jwe");

      // …and it still opens. A round trip with NON-empty party info is what shows
      // the KDF consumed the same values the header carries: decrypt re-derives
      // from the on-wire apu/apv unconditionally, so an encrypt that emitted them
      // without feeding them in would fail the AEAD here.
      const decrypted = await aegis.jwe.decrypt<string>(token);

      expect(decrypted.payload).toBe("opaque-payload");
    });
  });

  describe("a verify wrapper forwards the caller's option bag to the kit", () => {
    test("cwt.verify", async () => {
      const { token } = await aegis.cwt.sign(claims);

      MockDate.set(new Date("2024-01-01T10:00:00.000Z")); // past the 09:00 exp

      await expect(aegis.cwt.verify(token)).rejects.toThrow(/Invalid token/);

      // The flip: the SAME token and the SAME call, differing only in the option.
      // Without the structural forward the option never reaches the kit and this
      // rejects exactly as the line above does.
      const parsed = await aegis.cwt.verify(token, undefined, {
        verifyExpiration: false,
      });

      expect(parsed.payload.sub).toBe("user-1");
    });

    test("cwm.verify", async () => {
      const signed = await macAegis.cwm.sign(claims);

      MockDate.set(new Date("2024-01-01T10:00:00.000Z"));

      await expect(macAegis.cwm.verify(signed.token)).rejects.toThrow(/Invalid token/);

      const parsed = await macAegis.cwm.verify(signed.token, undefined, {
        verifyExpiration: false,
      });

      expect(parsed.payload.sub).toBe("user-1");
    });

    // The verification KEY may also be injected rather than resolved from the
    // vault — RFC 7523 §2.2 client assertions are MACed with a client secret that
    // is nobody's vault resident. The domain door's `key` option is covered by the
    // knob matrix; this is the raw door's.
    test("jwt.verify — an injected key", async () => {
      const external = new JwtKit({ logger, kryptos: TEST_OCT_KEY_SIG }).sign({
        iss: "client-1",
        sub: "client-1",
        aud: [ISSUER],
        exp: 1704099600,
        jti: "assertion-1",
      });

      const parsed = await aegis.jwt.verify(external, undefined, {
        key: { kryptos: TEST_OCT_KEY_SIG },
      });

      expect(parsed.payload.iss).toBe("client-1");

      // …and the injection is what carried it. The MAC key is not in the vault,
      // so without the option there is no key to resolve at all — which is what
      // makes the assertion above about the forward rather than about the vault.
      await expect(aegis.jwt.verify(external)).rejects.toThrow();
    });
  });

  /**
   * The other half of the same seam: the `key` selector the wrapper STRIPS
   * before forwarding, and therefore has to act on itself. Each wrapper reaches
   * the resolver on its own, so a wrapper that stripped the option and then
   * failed to pass it on would fall back to the vault silently — a caller's key
   * policy dropped without a trace, which is the failure mode the whole selector
   * exists to prevent.
   *
   * ⚠ The resolver's own rules — floor versus selector, injection, the issuer
   * scope, kid mismatch — are stated once beside it in `resolve-key.test.ts`.
   * What is here is only that each namespace REACHES it.
   */
  describe("a wrapper applies the caller's key selector", () => {
    test("jws.verify — an injected key the vault never held", async () => {
      // RFC 7523 §2.2 client assertions are MACed with a client secret that is
      // nobody's vault resident, so the injection is the only way to verify one.
      const { token } = await aegis.jws.sign("assertion", {
        key: { kryptos: TEST_OCT_KEY_SIG },
      });

      const parsed = await aegis.jws.verify(token, {
        key: { kryptos: TEST_OCT_KEY_SIG },
      });

      expect(parsed.payload).toBe("assertion");

      // …and the injection is what carried it: without the option the token's
      // own `kid` resolves against a vault that does not hold the secret, and the
      // header-named key is never trusted as a key source (RFC 8725 §3.1).
      await expect(aegis.jws.verify(token)).rejects.toMatchObject({
        code: "verify_key_not_found",
      });
    });

    // RFC 8725 §3.1: "Libraries MUST enable the caller to specify a supported set
    // of algorithms and MUST NOT use any other algorithms when performing
    // cryptographic operations." Selection is driven by the token's own `kid`, so
    // the caller's set is a CHECK applied before the signature is touched.
    test("jws.verify — a condition the signing key fails", async () => {
      const { token } = await aegis.jws.sign("data");

      await expect(
        aegis.jws.verify(token, { key: { condition: { algClass: "symmetric" } } }),
      ).rejects.toMatchObject({ code: "verify_key_policy_violation" });

      const parsed = await aegis.jws.verify(token, {
        key: { condition: { algClass: "asymmetric" } },
      });

      expect(parsed.payload).toBe("data");
    });

    test("jwe.encrypt — a per-call condition decides which vault key seals it", async () => {
      // Both enc keys are in the vault and the oct one is DELIBERATELY not the
      // default the deployment-wide query would return, so the sealed token's
      // `kid` — not a bare round trip — is what shows the condition was applied.
      amphora.add(TEST_OCT_KEY_ENC);

      const { token } = await aegis.jwe.encrypt("data", {
        key: { condition: { type: "oct" } },
      });

      expect(JweKit.decode(token).protectedHeader.kid).toBe(TEST_OCT_KEY_ENC.id);
      expect(JweKit.decode(token).protectedHeader.kid).not.toBe(TEST_EC_KEY_ENC.id);
    });

    test("jwe.decrypt — an injected key the vault never held", async () => {
      // RFC 9101 §6.1 has a client encrypt a request object to the authorization
      // server; the recipient key may be one this deployment holds out of band
      // and never registered, so without the injection the ciphertext's `kid`
      // resolves against an empty vault and can never be read again.
      const detached = KryptosKit.clone(TEST_OCT_KEY_ENC, { purpose: "detached" });

      const { token } = await aegis.jwe.encrypt("data", { key: { kryptos: detached } });

      await expect(
        aegis.jwe.decrypt(token, { key: { kryptos: detached } }),
      ).resolves.toMatchObject({ payload: "data" });
    });

    test("jwe.decrypt — a condition the kid-resolved key fails", async () => {
      // The recipient is PINNED so the conditions below are about the check and
      // not about which key the deployment-wide query happened to return.
      const { token } = await aegis.jwe.encrypt("data", {
        key: { condition: { id: TEST_EC_KEY_ENC.id } },
      });

      // The kid resolves the ECDH-ES key; the caller only trusts symmetric
      // recipients. A token must not pick the class of key that opens it.
      await expect(
        aegis.jwe.decrypt(token, { key: { condition: { type: "oct" } } }),
      ).rejects.toMatchObject({ code: "decrypt_key_policy_violation" });

      await expect(
        aegis.jwe.decrypt(token, { key: { condition: { type: "EC" } } }),
      ).resolves.toMatchObject({ payload: "data" });
    });
  });

  describe("a verify wrapper forwards the caller's ASSERT predicate", () => {
    // The predicate is a positional argument rather than an option, and it runs
    // against the WIRE claims — the raw surface has no domain matchers. A wrapper
    // that dropped it would report every token as matching whatever was asked.
    test("cwt.verify", async () => {
      const { token } = await aegis.cwt.sign(claims);

      await expect(
        aegis.cwt.verify(token, { aud: ["https://other.lindorm.io/"] }),
      ).rejects.toThrow(/Invalid token/);

      const parsed = await aegis.cwt.verify(token, {
        aud: ["https://rs.lindorm.io/"],
      });

      expect(parsed.payload.sub).toBe("user-1");
    });

    test("cwm.verify", async () => {
      const signed = await macAegis.cwm.sign(claims);

      await expect(
        macAegis.cwm.verify(signed.token, { aud: ["https://other.lindorm.io/"] }),
      ).rejects.toThrow(/Invalid token/);

      const parsed = await macAegis.cwm.verify(signed.token, {
        aud: ["https://rs.lindorm.io/"],
      });

      expect(parsed.payload.sub).toBe("user-1");
    });
  });

  // The namespace boundary itself: the raw wire verify range-checks a PRESENT
  // temporal claim and stops there. Expiry PRESENCE is a domain policy, so a raw
  // verify that enforced it would apply a rule the caller never asked for on a
  // surface whose whole purpose is to hand back what is on the wire.
  test("a raw wire verify does not enforce the domain expiry-presence policy", async () => {
    const { token } = await aegis.cwt.sign({
      iss: ISSUER,
      sub: "user-1",
      aud: ["https://rs.lindorm.io/"],
    });

    const parsed = await aegis.cwt.verify(token);

    expect(parsed.payload.sub).toBe("user-1");

    // …while the DOMAIN door, which owns that policy, refuses the same token.
    // Without the contrast this would pass just as well over a verify that
    // enforced nothing anywhere.
    await expect(
      aegis.verify(token, { audience: "https://rs.lindorm.io/" }),
    ).rejects.toMatchObject({ code: "missing_claim_exp" });
  });
});
