import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import { IrisEncryptionError } from "../../../errors/IrisEncryptionError.js";
import {
  TEST_KEY_ENC_AUDIT,
  TEST_KEY_ENC_MESSAGE,
  TEST_KEY_ENC_PUBLIC_ONLY,
  TEST_KEY_ENC_PUBLISHED,
  TEST_KEY_ENV_KEK,
  TEST_KEY_ENV_SIG,
  TEST_KEY_SIG_MESSAGE,
} from "../../__fixtures__/keys.js";
import {
  resolveEncryptionKey,
  type ResolveEncryptionKeyOptions,
} from "./resolve-encryption-key.js";

/**
 * A REAL Amphora, on purpose. Every one of these cases went green against a
 * `find: vi.fn()` mock — which is exactly why an unscoped `find({})` could hand
 * a SIGNING key to an `AesKit` for as long as it did.
 */
describe("resolveEncryptionKey", () => {
  let amphora: IAmphora;

  const rejection = async (
    options: ResolveEncryptionKeyOptions,
  ): Promise<IrisEncryptionError> =>
    (await resolveEncryptionKey(options).catch((error) => error)) as IrisEncryptionError;

  beforeEach(async () => {
    amphora = new Amphora({
      domain: "https://test.lindorm.io/",
      logger: createMockLogger(),
    });
    await amphora.setup();

    amphora.add([
      TEST_KEY_ENC_MESSAGE,
      TEST_KEY_ENC_AUDIT,
      TEST_KEY_SIG_MESSAGE,
      TEST_KEY_ENC_PUBLISHED,
      TEST_KEY_ENC_PUBLIC_ONLY,
    ]);
  });

  describe("the floor", () => {
    test("the vault WOULD hand out a signing key — this is what the floor is for", async () => {
      // Not a test of iris: a test of the ground truth iris stands on. The vault
      // answers an unfloored consumer predicate with a SIGNING key, because it is
      // the newest match. Anything that queries amphora without pinning `use`
      // hands that key to its crypto layer.
      await expect(
        amphora.find({ purpose: "message", publish: false }),
      ).resolves.toMatchObject({ id: TEST_KEY_SIG_MESSAGE.id, use: "sig" });
    });

    test("should NOT select a signing key, even when it is the newest match", async () => {
      // The vault's newest `purpose: "message"` key IS a signing key. That is the
      // bug: without `use: "enc"` on the floor, `find({ purpose: "message" })`
      // returns it and hands it straight to an AesKit.
      const kryptos = await resolveEncryptionKey({
        amphora,
        key: { predicate: { purpose: "message" } },
      });

      expect(kryptos.id).toBe(TEST_KEY_ENC_MESSAGE.id);
      expect(kryptos.use).toBe("enc");
    });

    test("should not select a public-only key, which could encrypt but never decrypt", async () => {
      // Both `recipient` keys are published and the public-only one is newer, so
      // the vault offers it first — `hasPrivateKey` is what refuses it.
      const kryptos = await resolveEncryptionKey({
        amphora,
        key: { predicate: { purpose: "recipient", publish: true } },
      });

      expect(kryptos.id).toBe(TEST_KEY_ENC_PUBLISHED.id);
      expect(kryptos.hasPrivateKey).toBe(true);
    });

    test("should reject an INJECTED signing key", async () => {
      const error = await rejection({ amphora, key: { kryptos: TEST_KEY_ENV_SIG } });

      expect(error).toBeInstanceOf(IrisEncryptionError);
      expect(error.code).toBe("encryption_key_policy_violation");
      expect(error.data).toMatchObject({ kid: TEST_KEY_ENV_SIG.id, use: "sig" });
    });

    test("should reject an INJECTED public-only key", async () => {
      const error = await rejection({
        amphora,
        key: { kryptos: TEST_KEY_ENC_PUBLIC_ONLY },
      });

      expect(error).toBeInstanceOf(IrisEncryptionError);
      expect(error.code).toBe("encryption_key_policy_violation");
    });

    test("should reject a signing key PINNED by an encrypted payload's kid", async () => {
      // `findById` is unfiltered by design, so a payload gets to name any key in
      // the vault. The floor is the only thing between that and the crypto layer.
      const error = await rejection({
        amphora,
        key: { predicate: { purpose: "message" } },
        id: TEST_KEY_SIG_MESSAGE.id,
      });

      expect(error).toBeInstanceOf(IrisEncryptionError);
      expect(error.code).toBe("encryption_key_policy_violation");
    });
  });

  describe("the selector", () => {
    test("should select by purpose, not by recency", async () => {
      // The `audit` KEK is the newer of the two. A purpose-scoped predicate must
      // still get the key it asked for.
      await expect(
        resolveEncryptionKey({ amphora, key: { predicate: { purpose: "message" } } }),
      ).resolves.toMatchObject({ id: TEST_KEY_ENC_MESSAGE.id });

      await expect(
        resolveEncryptionKey({ amphora, key: { predicate: { purpose: "audit" } } }),
      ).resolves.toMatchObject({ id: TEST_KEY_ENC_AUDIT.id });
    });

    test("should select by id", async () => {
      await expect(
        resolveEncryptionKey({
          amphora,
          key: { predicate: { id: TEST_KEY_ENC_AUDIT.id } },
        }),
      ).resolves.toMatchObject({ id: TEST_KEY_ENC_AUDIT.id });
    });

    test("should default to unpublished keys", async () => {
      // A message KEK never leaves the service, so the published `recipient` key
      // is invisible until a caller asks for it by name.
      const error = await rejection({
        amphora,
        key: { predicate: { purpose: "recipient" } },
      });

      expect(error).toBeInstanceOf(IrisEncryptionError);
      expect(error.code).toBe("encryption_key_not_found");
    });

    test("should let the caller override the publish default", async () => {
      await expect(
        resolveEncryptionKey({
          amphora,
          key: { predicate: { purpose: "recipient", publish: true } },
        }),
      ).resolves.toMatchObject({ id: TEST_KEY_ENC_PUBLISHED.id });
    });

    test("should throw when no key satisfies the policy", async () => {
      const error = await rejection({
        amphora,
        key: { predicate: { purpose: "nonexistent" } },
      });

      expect(error).toBeInstanceOf(IrisEncryptionError);
      expect(error.code).toBe("encryption_key_not_found");
      expect(error.data).toMatchObject({
        policy: {
          use: "enc",
          hasPrivateKey: true,
          publish: false,
          purpose: "nonexistent",
        },
      });
    });
  });

  describe("an injected kryptos", () => {
    test("should be used outright, without touching the vault", async () => {
      await expect(
        resolveEncryptionKey({ amphora, key: { kryptos: TEST_KEY_ENV_KEK } }),
      ).resolves.toBe(TEST_KEY_ENV_KEK);
    });

    test("should win over a predicate when both survive the merge", async () => {
      await expect(
        resolveEncryptionKey({
          amphora,
          key: { kryptos: TEST_KEY_ENV_KEK, predicate: { purpose: "message" } },
        }),
      ).resolves.toBe(TEST_KEY_ENV_KEK);
    });

    test("should answer for its own kid on the decrypt path, though it is not in the vault", async () => {
      // The sharp edge: an injected KEK encrypts fine and — without this — could
      // never decrypt, because `findById` only knows the vault.
      await expect(
        resolveEncryptionKey({
          amphora,
          key: { kryptos: TEST_KEY_ENV_KEK },
          id: TEST_KEY_ENV_KEK.id,
        }),
      ).resolves.toBe(TEST_KEY_ENV_KEK);
    });

    test("should NOT answer for another key's kid — the vault does", async () => {
      // A rotation: messages already on the wire name the old vault key, and the
      // injected KEK must not shadow it.
      await expect(
        resolveEncryptionKey({
          amphora,
          key: { kryptos: TEST_KEY_ENV_KEK },
          id: TEST_KEY_ENC_MESSAGE.id,
        }),
      ).resolves.toMatchObject({ id: TEST_KEY_ENC_MESSAGE.id });
    });

    test("should throw when a payload names a key nobody holds", async () => {
      const error = await rejection({
        amphora,
        key: { kryptos: TEST_KEY_ENV_KEK },
        id: "key_0000000000000000000000000000",
      });

      expect(error).toBeInstanceOf(IrisEncryptionError);
      expect(error.code).toBe("encryption_key_not_found");
    });
  });

  describe("a descriptor that names no key", () => {
    test.each([
      { name: "nothing at all", key: {} },
      { name: "an empty predicate", key: { predicate: {} } },
    ])("should refuse an unscoped lookup: $name", async ({ key }) => {
      const error = await rejection({ amphora, key });

      expect(error).toBeInstanceOf(IrisEncryptionError);
      expect(error.code).toBe("missing_encryption_key");
    });
  });
});
