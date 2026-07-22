import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import { CompactEncrypt, importJWK } from "jose";
import MockDate from "mockdate";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_SIG,
  TEST_RSA_KEY_ENC,
} from "../__fixtures__/keys.js";
import type { AegisSignPredicate } from "../types/index.js";
import { AegisError } from "../errors/index.js";
import { Aegis } from "./Aegis.js";
import { JweKit } from "./JweKit.js";
import { JwsKit } from "./JwsKit.js";
import { beforeEach, describe, expect, test } from "vitest";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const PLAINTEXT = "key selection";

// A key as amphora ingests it from a remote JWKS: the PUBLIC half only, and
// external. `operations` is derived from the key material, so these report only
// what a public half can actually do — that is what the Aegis key queries lean
// on. The kid is overridden so a public-only key and its private twin can sit in
// the same vault.
const publicOnly = (kryptos: IKryptos, kid: string): IKryptos =>
  KryptosKit.from.jwk({ ...kryptos.toJWK("public"), kid });

const PUBLIC_SIG_KID = "5c0f2f0e-1f1a-5a2b-8f4c-0d1e2f3a4b5c";
const PUBLIC_ENC_KID = "6d1a3b1f-2a2b-5b3c-9a5d-1e2f3a4b5c6d";

const foreignJwe = async (
  kryptos: IKryptos,
  alg: string,
  kid: string,
): Promise<string> => {
  const key = await importJWK(kryptos.toJWK("public") as never, alg);

  // A foreign JWE MUST name our recipient key's `kid` — a real client copies it
  // from our published JWKS. Aegis resolves the decryption key by that `kid`
  // (findById) and the DECRYPT_FLOOR post-checks the named key; it will NOT
  // search the vault by the JWE's declared `alg` (RFC 8725 §3.1). A kid-less
  // JWE is rejected outright with `decrypt_key_missing_kid`.
  return new CompactEncrypt(new TextEncoder().encode(PLAINTEXT))
    .setProtectedHeader({ alg, enc: "A256GCM", typ: "JWE", kid })
    .encrypt(key);
};

describe("Aegis key selection", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ domain: ISSUER, logger });
    aegis = new Aegis({ amphora, logger });

    await amphora.setup();
  });

  describe("sig", () => {
    test("a public-only external sig key reports verify only", () => {
      expect(publicOnly(TEST_EC_KEY_SIG, PUBLIC_SIG_KID).operations).toEqual(["verify"]);
    });

    test("a public-only external sig key is not selected for signing", async () => {
      amphora.add(publicOnly(TEST_EC_KEY_SIG, PUBLIC_SIG_KID));

      const error = await aegis.jws.sign("data").catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("sign_key_not_found");
    });

    test("the private key is selected for signing when a public-only twin is present", async () => {
      amphora.add(publicOnly(TEST_EC_KEY_SIG, PUBLIC_SIG_KID));
      amphora.add(TEST_EC_KEY_SIG);

      const { token } = await aegis.jws.sign("data");

      expect(JwsKit.decodeSegments(token).header.kid).toBe(TEST_EC_KEY_SIG.id);
    });
  });

  describe("enc", () => {
    test("a public-only RSA-OAEP key reports encrypt and wrapKey only", () => {
      expect(publicOnly(TEST_RSA_KEY_ENC, PUBLIC_ENC_KID).operations).toEqual([
        "encrypt",
        "wrapKey",
      ]);
    });

    test("a public-only RSA-OAEP key named by the JWE's kid is rejected by the decrypt floor", async () => {
      // The JWE names the PUBLIC-ONLY key's kid, so `findById` returns it — and
      // the DECRYPT_FLOOR post-check rejects it (no private half). A public-only
      // key still cannot decrypt; the rejection is now a post-check on the named
      // key, not a query filter that excluded it from selection.
      const jwe = await foreignJwe(TEST_RSA_KEY_ENC, "RSA-OAEP-256", PUBLIC_ENC_KID);

      amphora.add(publicOnly(TEST_RSA_KEY_ENC, PUBLIC_ENC_KID));

      const error = await aegis.jwe.decrypt(jwe).catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("decrypt_key_policy_violation");
    });

    test("the private key is selected when the JWE names its kid, even beside a public-only twin", async () => {
      // The JWE names the PRIVATE key's kid → `findById` returns it → floor
      // passes → decrypt succeeds. The public-only twin (a different kid) is
      // irrelevant: selection is kid-driven, not a query that could pick it.
      const jwe = await foreignJwe(TEST_RSA_KEY_ENC, "RSA-OAEP-256", TEST_RSA_KEY_ENC.id);

      amphora.add(publicOnly(TEST_RSA_KEY_ENC, PUBLIC_ENC_KID));
      amphora.add(TEST_RSA_KEY_ENC);

      const decrypted = await aegis.jwe.decrypt(jwe);

      expect(decrypted.payload).toBe(PLAINTEXT);
    });

    test("a public-only RSA-OAEP key IS selected for encryption", async () => {
      amphora.add(publicOnly(TEST_RSA_KEY_ENC, PUBLIC_ENC_KID));

      const { token } = await aegis.jwe.encrypt(PLAINTEXT);

      expect(token).toEqual(expect.any(String));
    });

    // THE BUG S4 FIXES. ECDH-ES derives with the recipient's public key on one
    // side and its private key on the other, so `operations` reports
    // [deriveKey, deriveBits] for BOTH halves and can NEVER separate encrypt
    // from decrypt. The decrypt FLOOR asks about the key's halves instead
    // (`hasPrivateKey`), which is the question that actually has an answer — and
    // it now post-checks the key the JWE's kid names, rather than filtering a
    // vault query.
    test("a public-only ECDH-ES key named by the JWE's kid is rejected by the decrypt floor", async () => {
      const publicKey = publicOnly(TEST_EC_KEY_ENC, PUBLIC_ENC_KID);

      // The declared operations are identical for both halves — the trap.
      expect(publicKey.operations).toEqual(["deriveKey", "deriveBits"]);
      expect(publicKey.hasPrivateKey).toBe(false);

      const jwe = await foreignJwe(TEST_EC_KEY_ENC, "ECDH-ES", PUBLIC_ENC_KID);

      amphora.add(publicKey);

      // `findById` returns the public-only key the kid names; the floor rejects
      // it on `hasPrivateKey`, before any derivation is attempted.
      const error = await aegis.jwe.decrypt(jwe).catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("decrypt_key_policy_violation");
    });

    test("the private ECDH-ES key is selected when the JWE names its kid, even beside a public-only twin", async () => {
      const jwe = await foreignJwe(TEST_EC_KEY_ENC, "ECDH-ES", TEST_EC_KEY_ENC.id);

      amphora.add(publicOnly(TEST_EC_KEY_ENC, PUBLIC_ENC_KID));
      amphora.add(TEST_EC_KEY_ENC);

      const decrypted = await aegis.jwe.decrypt(jwe);

      expect(decrypted.payload).toBe(PLAINTEXT);
    });
  });

  // #7 / #8: the floor must always win the merge, and a caller-supplied
  // `undefined` predicate value must neither erase a real constraint nor become
  // match-all. Both are exercised here against a REAL Amphora, not a mock.
  describe("floor and undefined-predicate invariants", () => {
    test("a per-call `{ algorithm: undefined }` does not erase the deployment allowlist", async () => {
      // The deployment pins EdDSA. Both keys are asymmetric sig keys the vault
      // could sign with, so only the allowlist keeps them apart.
      amphora.add(TEST_OKP_KEY_SIG);
      amphora.add(TEST_EC_KEY_SIG); // added last — a match-all would pick this one

      const aegis = new Aegis({
        amphora,
        logger,
        sign: { predicate: { algorithm: { $in: ["EdDSA"] } } },
      });

      // Models an OIDC client that registered no signing alg: the per-call value
      // is `undefined`. It must fall back to the deployment allowlist, not
      // match-all — so the EdDSA key is chosen, never the ES512 one.
      const { token } = await aegis.jws.sign("data", {
        key: { predicate: { algorithm: undefined } },
      });

      expect(JwsKit.decodeSegments(token).header.kid).toBe(TEST_OKP_KEY_SIG.id);
    });

    test("a selector cannot smuggle `use: enc` past the sign floor", async () => {
      amphora.add(TEST_EC_KEY_SIG);
      amphora.add(TEST_EC_KEY_ENC);

      // `use` is a floor field the sign predicate type excludes; a config/JSON
      // predicate can still carry it at runtime. The floor wins the merge, so
      // the enc key is never selected — the sig key signs, and no throw.
      const { token } = await aegis.jws.sign("data", {
        key: { predicate: { use: "enc" } as AegisSignPredicate },
      });

      expect(JwsKit.decodeSegments(token).header.kid).toBe(TEST_EC_KEY_SIG.id);
    });
  });

  // Finding #11: the per-call key selector now lives INSIDE each operation's
  // options object under `key`, which makes three surfaces reachable that a
  // trailing positional arg never exposed on jwe/jws. These prove each one is
  // HONOURED — not merely type-accepted — because the whole point of the fix is
  // that they were unreachable before (e.g. AegisDecryptKey.kryptos's RFC 9101
  // encrypted-request-object case).
  describe("per-call key on jwe / jws (finding #11)", () => {
    describe("jwe.decrypt(jwe, { key: { kryptos } }) — injected, never a vault resident", () => {
      test("decrypts ciphertext written to a key the vault has NEVER held (RFC 9101)", async () => {
        // The recipient key is never `amphora.add`-ed: without the injected
        // `kryptos` the ciphertext's kid resolves against an empty vault and can
        // never be read again. This is the case the type comment names.
        const jwe = await foreignJwe(
          TEST_RSA_KEY_ENC,
          "RSA-OAEP-256",
          TEST_RSA_KEY_ENC.id,
        );

        await expect(amphora.findById(TEST_RSA_KEY_ENC.id)).rejects.toThrow();

        const decrypted = await aegis.jwe.decrypt(jwe, {
          key: { kryptos: TEST_RSA_KEY_ENC },
        });

        expect(decrypted.payload).toBe(PLAINTEXT);
      });

      test("an injected key whose kid does NOT match the ciphertext throws, never silently works", async () => {
        // The ciphertext names the RSA key; the injected key is the EC one (a
        // valid private enc key, so it clears the floor). Selection is driven by
        // the ciphertext's own kid, so a key naming a different kid is a caller
        // error — decrypting with the wrong material would be worse.
        const jwe = await foreignJwe(
          TEST_RSA_KEY_ENC,
          "RSA-OAEP-256",
          TEST_RSA_KEY_ENC.id,
        );

        const error = await aegis.jwe
          .decrypt(jwe, { key: { kryptos: TEST_EC_KEY_ENC } })
          .catch((err: Error) => err);

        expect(error).toBeInstanceOf(AegisError);
        expect((error as AegisError).code).toBe("decrypt_key_mismatch");
        expect((error as AegisError).data).toMatchObject({
          kid: TEST_RSA_KEY_ENC.id,
          suppliedKid: TEST_EC_KEY_ENC.id,
          operation: "decrypt",
        });
      });
    });

    describe("jwe.decrypt(jwe, { key: { predicate } }) — a CHECK on the kid-resolved key", () => {
      test("a predicate the kid-resolved key FAILS is rejected before decryption", async () => {
        const jwe = await foreignJwe(
          TEST_RSA_KEY_ENC,
          "RSA-OAEP-256",
          TEST_RSA_KEY_ENC.id,
        );
        amphora.add(TEST_RSA_KEY_ENC);

        // The kid resolves the RSA key; the per-call predicate demands an oct
        // key. The floor post-check on the named key rejects it — a token must
        // not pick the class of key that opens it.
        const error = await aegis.jwe
          .decrypt(jwe, { key: { predicate: { type: "oct" } } })
          .catch((err: Error) => err);

        expect(error).toBeInstanceOf(AegisError);
        expect((error as AegisError).code).toBe("decrypt_key_policy_violation");
      });

      test("a predicate the kid-resolved key SATISFIES decrypts", async () => {
        const jwe = await foreignJwe(
          TEST_RSA_KEY_ENC,
          "RSA-OAEP-256",
          TEST_RSA_KEY_ENC.id,
        );
        amphora.add(TEST_RSA_KEY_ENC);

        const decrypted = await aegis.jwe.decrypt(jwe, {
          key: { predicate: { type: "RSA" } },
        });

        expect(decrypted.payload).toBe(PLAINTEXT);
      });
    });

    describe("jws.verify(token, { key: { predicate } }) — RFC 8725 §3.1", () => {
      test("a predicate the signing key FAILS rejects the JWS (no kid-picks-its-own-class)", async () => {
        amphora.add(TEST_EC_KEY_SIG);
        const { token } = await aegis.jws.sign("data");

        // The token's kid names the EC (asymmetric) key; the caller only trusts
        // symmetric signatures. The CHECK fires before the signature is touched.
        const error = await aegis.jws
          .verify(token, { key: { predicate: { algClass: "symmetric" } } })
          .catch((err: Error) => err);

        expect(error).toBeInstanceOf(AegisError);
        expect((error as AegisError).code).toBe("verify_key_policy_violation");
      });

      test("a predicate the signing key SATISFIES verifies", async () => {
        amphora.add(TEST_EC_KEY_SIG);
        const { token } = await aegis.jws.sign("data");

        const parsed = await aegis.jws.verify(token, {
          key: { predicate: { algClass: "asymmetric" } },
        });

        expect(parsed.payload).toBe("data");
      });
    });

    describe("jws.verify(token, { key: { kryptos } }) — RFC 7523 client_secret_jwt", () => {
      test("verifies a JWS signed by a key the vault never held (an injected client secret)", async () => {
        // The oct key is a client secret held out-of-band — an HS256 MAC key,
        // never a vault resident. It signs the assertion and verifies it.
        await expect(amphora.findById(TEST_OCT_KEY_SIG.id)).rejects.toThrow();

        const { token } = await aegis.jws.sign("assertion", {
          key: { kryptos: TEST_OCT_KEY_SIG },
        });

        // Without the key, verify resolves the token's kid against the vault —
        // which does not hold it — and fails; the header-named key is never
        // trusted as a key source (RFC 8725 §3.1).
        const notFound = await aegis.jws.verify(token).catch((err: Error) => err);
        expect(notFound).toBeInstanceOf(AegisError);
        expect((notFound as AegisError).code).toBe("verify_key_not_found");

        // Injecting the same secret verifies it — the client_secret_jwt case.
        const parsed = await aegis.jws.verify(token, {
          key: { kryptos: TEST_OCT_KEY_SIG },
        });
        expect(parsed.payload).toBe("assertion");
      });

      test("an injected key whose kid does NOT match the token throws, never silently works", async () => {
        const { token } = await aegis.jws.sign("assertion", {
          key: { kryptos: TEST_OCT_KEY_SIG },
        });

        // A different key (same class, so it clears the sig floor) that names
        // another kid: selection is driven by the token's own kid, so a key
        // naming a different one is a caller error — the guard fires before the
        // signature is touched, even though the shared secret would verify.
        const other = KryptosKit.clone(TEST_OCT_KEY_SIG, {
          id: "9a8b7c6d-0000-4000-8000-00000000000b",
        });

        const error = await aegis.jws
          .verify(token, { key: { kryptos: other } })
          .catch((err: Error) => err);

        expect(error).toBeInstanceOf(AegisError);
        expect((error as AegisError).code).toBe("verify_key_mismatch");
        expect((error as AegisError).data).toMatchObject({
          kid: TEST_OCT_KEY_SIG.id,
          suppliedKid: other.id,
          operation: "verify",
        });
      });
    });

    describe("jwe.encrypt(data, { key }) — per-call recipient selection / injection is honoured", () => {
      test("a per-call predicate selects WHICH vault key seals it (asserted by kid, not a bare round-trip)", async () => {
        // Both enc keys are present. The predicate must pick the EC one, which
        // is DELIBERATELY the older key — the RSA key is newest, so amphora's
        // default sort would hand it back if the predicate were ignored. A bare
        // round-trip cannot tell which KEK sealed the ciphertext, so assert the
        // sealed token's kid IS the selected key and NOT the newest default.
        amphora.add(TEST_EC_KEY_ENC); // createdAt 00:02 — older
        amphora.add(TEST_RSA_KEY_ENC); // createdAt 00:07 — newest, the default

        const { token } = await aegis.jwe.encrypt(PLAINTEXT, {
          key: { predicate: { type: "EC" } },
        });

        expect(JweKit.decodeSegments(token).header.kid).toBe(TEST_EC_KEY_ENC.id);
        expect(JweKit.decodeSegments(token).header.kid).not.toBe(TEST_RSA_KEY_ENC.id);
      });

      test("an injected key seals it even though the vault never held it, and round-trips back", async () => {
        await expect(amphora.findById(TEST_RSA_KEY_ENC.id)).rejects.toThrow();

        const { token } = await aegis.jwe.encrypt(PLAINTEXT, {
          key: { kryptos: TEST_RSA_KEY_ENC },
        });

        expect(JweKit.decodeSegments(token).header.kid).toBe(TEST_RSA_KEY_ENC.id);

        const decrypted = await aegis.jwe.decrypt(token, {
          key: { kryptos: TEST_RSA_KEY_ENC },
        });

        expect(decrypted.payload).toBe(PLAINTEXT);
      });
    });
  });
});
