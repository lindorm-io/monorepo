import { describe, expect, test } from "vitest";
import { TEST_KEY_ENC_MESSAGE, TEST_KEY_ENV_KEK } from "../../__fixtures__/keys.js";
import { mergeEncryptionKey } from "./merge-encryption-key.js";

describe("mergeEncryptionKey", () => {
  test("should fall back to the source default", () => {
    expect(
      mergeEncryptionKey({}, { predicate: { purpose: "message" } }),
    ).toMatchSnapshot();
  });

  test("should let the decorator win, key by key", () => {
    expect(
      mergeEncryptionKey(
        { predicate: { purpose: "audit" } },
        { predicate: { purpose: "message", publish: true } },
      ),
    ).toMatchSnapshot();
  });

  test("should let the decorator's kryptos win over the source default's", () => {
    expect(
      mergeEncryptionKey({ kryptos: TEST_KEY_ENV_KEK }, { kryptos: TEST_KEY_ENC_MESSAGE })
        .kryptos?.id,
    ).toBe(TEST_KEY_ENV_KEK.id);
  });

  test("should keep the source default's kryptos when the decorator names none", () => {
    expect(
      mergeEncryptionKey(
        { predicate: { purpose: "audit" } },
        { kryptos: TEST_KEY_ENV_KEK },
      ).kryptos?.id,
    ).toBe(TEST_KEY_ENV_KEK.id);
  });

  test("should produce nothing from nothing", () => {
    expect(mergeEncryptionKey({}, undefined)).toMatchSnapshot();
  });
});
