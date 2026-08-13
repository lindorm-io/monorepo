import { AesKit } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_ENC } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { AegisError } from "../../errors/index.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const PLAINTEXT = "cookie-session-payload";

/**
 * The AES namespace's READ side (`aegis.aes.decrypt`).
 *
 * A sealed record names its OWN key, so the read resolves by that id through
 * `findById` — deliberately unfiltered, so a key that has since expired or been
 * un-published still opens what it sealed. The one case that lookup cannot serve
 * is a key the vault never held, which is what the per-call injected key is for;
 * every other option here exists to make the failure modes LOUD, because
 * silently decrypting with a different key would be worse than not decrypting.
 *
 * ⚠ Beside the function rather than in the conformance table: an AES record is
 * neither a JOSE nor a COSE token, so there is no wire to state it on.
 */

const octEnc = (id: string, privateKey: string) => ({
  id,
  privateKey,
  algorithm: "dir" as const,
  expiresAt: new Date("2024-06-01T00:00:00.000Z"),
  notBefore: new Date("2023-01-01T01:00:00.000Z"),
  publicKey: "",
  type: "oct" as const,
  use: "enc" as const,
});

// A published enc key the vault holds — the ordinary path.
const VAULT_KEY = KryptosKit.from.b64({
  ...octEnc(
    "f1a2b3c4-0002-5aaa-9bbb-0123456789ab",
    "u5Z2h3wSNEGF6Z8vjEN71q-JowHMZ8IVC7v8aCZCB_Q",
  ),
  purpose: "cookie",
  publish: true,
  createdAt: new Date("2023-06-01T00:00:00.000Z"),
});

// An INTERNAL, unpublished key. `publish: false` hides a key from vault QUERIES,
// so sealing with it needs a selector — but `findById` is unfiltered, so reading
// it back needs nothing.
const INTERNAL_KEY = KryptosKit.from.b64({
  ...octEnc(
    "f1a2b3c4-0003-5aaa-9bbb-0123456789ab",
    "mtw71kr9yojcS2RCAW5g0xfhXuwFEekY6KakBw3srwA",
  ),
  purpose: "cookie",
  internal: true,
  publish: false,
  createdAt: new Date("2023-06-01T00:00:00.000Z"),
});

// A key the vault NEVER holds.
const DETACHED_KEY = KryptosKit.from.b64({
  ...octEnc(
    "f1a2b3c4-0004-5aaa-9bbb-0123456789ab",
    "PGfkV3lCX92QGq3cCbt8E01GkOyub6bQbfuWyktr2pY",
  ),
  purpose: "detached",
});

describe("rawDecryptAes — the AES read side", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });

    await amphora.setup();

    amphora.add(VAULT_KEY);
    amphora.add(INTERNAL_KEY);
  });

  // Every output mode is a different serialisation of the same record, and the
  // read side has to recover the key id from each of them — a mode that parsed
  // to a keyless record would resolve nothing.
  test("round-trips every output mode", async () => {
    const cbor = await aegis.aes.encrypt(PLAINTEXT);
    const record = await aegis.aes.encrypt(PLAINTEXT, "record");
    const serialised = await aegis.aes.encrypt(PLAINTEXT, "serialised");

    await expect(aegis.aes.decrypt(cbor)).resolves.toBe(PLAINTEXT);
    await expect(aegis.aes.decrypt(record)).resolves.toBe(PLAINTEXT);
    await expect(aegis.aes.decrypt(serialised)).resolves.toBe(PLAINTEXT);
  });

  // The read side needs no selector to reach a key the write side needed one
  // for. Applying the publish filter here would strand every record an internal
  // key ever sealed.
  test("reads a record sealed by an internal, unpublished key with no selector", async () => {
    const encoded = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
      key: { condition: { purpose: "cookie", publish: false } },
    });

    expect(AesKit.parse(encoded).keyId).toBe(INTERNAL_KEY.id);
    await expect(aegis.aes.decrypt(encoded)).resolves.toBe(PLAINTEXT);
  });

  describe("a record sealed with an injected key", () => {
    test("round-trips when the same key is supplied back", async () => {
      const encoded = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
        key: { kryptos: DETACHED_KEY },
      });

      await expect(
        aegis.aes.decrypt(encoded, { key: { kryptos: DETACHED_KEY } }),
      ).resolves.toBe(PLAINTEXT);
    });

    /**
     * Without the key the record's `kid` resolves against a vault that never
     * held it and the read fails loudly. Sealing succeeding while reading failed
     * is the gap the decrypt-side selector closes, so the gap being REAL is part
     * of the statement.
     *
     * ⚠ It surfaces as an `AegisError`: catching that class is this package's
     * contract, so amphora's own `kryptos_not_found_by_id` escaping the
     * `findById` branch would be invisible to a consumer that honours it.
     */
    test("fails loudly when the key is not supplied back", async () => {
      const encoded = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
        key: { kryptos: DETACHED_KEY },
      });

      const error = await aegis.aes.decrypt(encoded).catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("decrypt_key_not_found");
      expect((error as AegisError).data).toMatchObject({ kid: DETACHED_KEY.id });
    });

    // Silently ignoring the supplied key would send the read to a vault key that
    // cannot open this record; preferring it would decrypt with the wrong key
    // material. Both are worse than saying so.
    test("refuses a supplied key that is not the one the record names", async () => {
      const encoded = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
        key: { kryptos: DETACHED_KEY },
      });

      const error = await aegis.aes
        .decrypt(encoded, { key: { kryptos: VAULT_KEY } })
        .catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("decrypt_key_mismatch");
      expect((error as AegisError).data).toMatchObject({
        kid: DETACHED_KEY.id,
        suppliedKid: VAULT_KEY.id,
        operation: "decrypt",
      });
    });

    // `hasPrivateKey` IS the decrypt floor, and it applies to a supplied key
    // exactly as it applies to a vault resident — injection is not an escape
    // hatch from policy.
    test("refuses a supplied key that violates the decrypt floor", async () => {
      const encoded = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
        key: { kryptos: DETACHED_KEY },
      });

      const publicOnly = KryptosKit.from.jwk({
        ...TEST_EC_KEY_ENC.toJWK("public"),
        kid: AesKit.parse(encoded).keyId,
      });

      const error = await aegis.aes
        .decrypt(encoded, { key: { kryptos: publicOnly } })
        .catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("decrypt_key_policy_violation");
    });
  });
});
