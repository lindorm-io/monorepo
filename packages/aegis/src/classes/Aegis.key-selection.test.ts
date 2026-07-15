import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import { CompactEncrypt, importJWK } from "jose";
import MockDate from "mockdate";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_SIG,
  TEST_OKP_KEY_SIG,
  TEST_RSA_KEY_ENC,
} from "../__fixtures__/keys.js";
import type { AegisSignPredicate } from "../types/index.js";
import { AegisError } from "../errors/index.js";
import { Aegis } from "./Aegis.js";
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

const foreignJwe = async (kryptos: IKryptos, alg: string): Promise<string> => {
  const key = await importJWK(kryptos.toJWK("public") as never, alg);

  // No `kid` — a foreign JWE need not name our key, which is precisely when
  // Aegis resolves the decryption key by QUERY instead of by id.
  return new CompactEncrypt(new TextEncoder().encode(PLAINTEXT))
    .setProtectedHeader({ alg, enc: "A256GCM", typ: "JWE" })
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

      expect(JwsKit.decode(token).header.kid).toBe(TEST_EC_KEY_SIG.id);
    });
  });

  describe("enc", () => {
    test("a public-only RSA-OAEP key reports encrypt and wrapKey only", () => {
      expect(publicOnly(TEST_RSA_KEY_ENC, PUBLIC_ENC_KID).operations).toEqual([
        "encrypt",
        "wrapKey",
      ]);
    });

    test("a public-only RSA-OAEP key is not selected for decryption", async () => {
      const jwe = await foreignJwe(TEST_RSA_KEY_ENC, "RSA-OAEP-256");

      amphora.add(publicOnly(TEST_RSA_KEY_ENC, PUBLIC_ENC_KID));

      const error = await aegis.jwe.decrypt(jwe).catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("decrypt_key_not_found");
    });

    test("the private key is selected for decryption when a public-only twin is present", async () => {
      const jwe = await foreignJwe(TEST_RSA_KEY_ENC, "RSA-OAEP-256");

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
    // from decrypt — which is why the old `$or: [{operations: [...]}]` decrypt
    // query admitted a public-only ECDH-ES key and failed deep in the crypto
    // layer. The decrypt FLOOR asks about the key's halves instead
    // (`hasPrivateKey`), which is the question that actually has an answer.
    test("a public-only ECDH-ES key is NOT selected for decryption", async () => {
      const publicKey = publicOnly(TEST_EC_KEY_ENC, PUBLIC_ENC_KID);

      // The declared operations are identical for both halves — the trap.
      expect(publicKey.operations).toEqual(["deriveKey", "deriveBits"]);
      expect(publicKey.hasPrivateKey).toBe(false);

      const jwe = await foreignJwe(TEST_EC_KEY_ENC, "ECDH-ES");

      amphora.add(publicKey);

      // Rejected in KEY SELECTION now, not in the crypto layer.
      const error = await aegis.jwe.decrypt(jwe).catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("decrypt_key_not_found");
    });

    test("the private ECDH-ES key is selected when a public-only twin is present", async () => {
      const jwe = await foreignJwe(TEST_EC_KEY_ENC, "ECDH-ES");

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
        sign: { predicate: { algorithm: undefined } },
      });

      expect(JwsKit.decode(token).header.kid).toBe(TEST_OKP_KEY_SIG.id);
    });

    test("a selector cannot smuggle `use: enc` past the sign floor", async () => {
      amphora.add(TEST_EC_KEY_SIG);
      amphora.add(TEST_EC_KEY_ENC);

      // `use` is a floor field the sign predicate type excludes; a config/JSON
      // predicate can still carry it at runtime. The floor wins the merge, so
      // the enc key is never selected — the sig key signs, and no throw.
      const { token } = await aegis.jws.sign("data", {
        sign: { predicate: { use: "enc" } as AegisSignPredicate },
      });

      expect(JwsKit.decode(token).header.kid).toBe(TEST_EC_KEY_SIG.id);
    });
  });
});
