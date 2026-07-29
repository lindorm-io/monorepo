import { parseAes } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import { IrisEncryptionError } from "../../../errors/IrisEncryptionError.js";
import { IrisNotSupportedError } from "../../../errors/IrisNotSupportedError.js";
import { IrisSerializationError } from "../../../errors/IrisSerializationError.js";
import {
  TEST_KEY_ENC_AUDIT,
  TEST_KEY_ENC_MESSAGE,
  TEST_KEY_ENV_KEK,
  TEST_KEY_ENV_SIG,
  TEST_KEY_SIG_MESSAGE,
} from "../../__fixtures__/keys.js";
import type { MessageEncryptionContext } from "../types/encryption-context.js";
import { decryptPayload, encryptPayload } from "./encrypt.js";

/**
 * Real Amphora, real AesKit, real ciphertext. The mocked AesKit that used to
 * stand here is why nothing ever went red: a `find: vi.fn()` cannot select the
 * wrong key, and a `decrypt: vi.fn()` cannot fail to unwrap what it wrapped.
 */
describe("encryptPayload / decryptPayload", () => {
  let amphora: IAmphora;
  let context: MessageEncryptionContext;

  const data = Buffer.from("classified-info");

  beforeEach(async () => {
    amphora = new Amphora({
      domain: "https://test.lindorm.io/",
      logger: createMockLogger(),
    });
    await amphora.setup();

    amphora.add([TEST_KEY_ENC_MESSAGE, TEST_KEY_ENC_AUDIT, TEST_KEY_SIG_MESSAGE]);

    context = { amphora };
  });

  describe("a key selected from the vault", () => {
    test("should round-trip a payload", async () => {
      const encrypted = { condition: { purpose: "message" } };

      const token = await encryptPayload(data, context, encrypted);

      expect(token).not.toContain("classified-info");
      await expect(decryptPayload(token, context, encrypted)).resolves.toEqual(data);
    });

    test("should encrypt with the encryption key, never the newer signing key", async () => {
      const token = await encryptPayload(data, context, {
        condition: { purpose: "message" },
      });

      expect(parseAes(token).keyId).toBe(TEST_KEY_ENC_MESSAGE.id);
    });

    test("should select the purpose it was given", async () => {
      const token = await encryptPayload(data, context, {
        condition: { purpose: "audit" },
      });

      expect(parseAes(token).keyId).toBe(TEST_KEY_ENC_AUDIT.id);
    });
  });

  describe("an injected kryptos", () => {
    test("should encrypt with exactly that key — and decrypt it, though it is not in the vault", async () => {
      const encrypted = { kryptos: TEST_KEY_ENV_KEK };

      const token = await encryptPayload(data, context, encrypted);

      expect(parseAes(token).keyId).toBe(TEST_KEY_ENV_KEK.id);
      await expect(amphora.findById(TEST_KEY_ENV_KEK.id)).rejects.toThrow();

      await expect(decryptPayload(token, context, encrypted)).resolves.toEqual(data);
    });

    test("should be refused when it violates the floor", async () => {
      const error = await encryptPayload(data, context, {
        kryptos: TEST_KEY_ENV_SIG,
      }).catch((e) => e);

      expect(error).toBeInstanceOf(IrisEncryptionError);
      expect(error.code).toBe("encryption_key_policy_violation");
    });
  });

  describe("the source-level default", () => {
    test("should supply the key when the decorator names none", async () => {
      context = { amphora, key: { kryptos: TEST_KEY_ENV_KEK } };

      const token = await encryptPayload(data, context, {});

      expect(parseAes(token).keyId).toBe(TEST_KEY_ENV_KEK.id);
      await expect(decryptPayload(token, context, {})).resolves.toEqual(data);
    });

    test("should lose to the decorator's own condition", async () => {
      context = { amphora, key: { condition: { purpose: "audit" } } };

      const token = await encryptPayload(data, context, {
        condition: { purpose: "message" },
      });

      expect(parseAes(token).keyId).toBe(TEST_KEY_ENC_MESSAGE.id);
    });
  });

  describe("failures", () => {
    test("should throw when no key is named at all", async () => {
      const error = await encryptPayload(data, context, {}).catch((e) => e);

      expect(error).toBeInstanceOf(IrisEncryptionError);
      expect(error.code).toBe("missing_encryption_key");
    });

    test("should throw when no amphora was configured", async () => {
      await expect(
        encryptPayload(data, undefined, { condition: { purpose: "message" } }),
      ).rejects.toThrow(IrisNotSupportedError);

      await expect(
        decryptPayload("token", undefined, { condition: { purpose: "message" } }),
      ).rejects.toThrow(IrisNotSupportedError);
    });

    test("should throw when the payload is not an aes token", async () => {
      await expect(
        decryptPayload("not-a-token", context, { condition: { purpose: "message" } }),
      ).rejects.toThrow(IrisSerializationError);
    });

    test("should throw when the payload names a key nobody holds", async () => {
      const token = await encryptPayload(data, context, { kryptos: TEST_KEY_ENV_KEK });

      // A consumer that holds the vault but not the env KEK.
      const error = await decryptPayload(token, context, {
        condition: { purpose: "message" },
      }).catch((e) => e);

      expect(error).toBeInstanceOf(IrisEncryptionError);
      expect(error.code).toBe("encryption_key_not_found");
    });
  });
});
