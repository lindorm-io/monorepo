import { describe, expect, test } from "vitest";
import { TEST_KEY_ENC_MESSAGE, TEST_KEY_ENV_KEK } from "../../__fixtures__/keys.js";
import { mergeEncryptionKey } from "./merge-encryption-key.js";

describe("mergeEncryptionKey", () => {
  test("falls back to the source default when the message names no key", () => {
    expect(mergeEncryptionKey({}, { predicate: { purpose: "message" } })).toEqual({
      predicate: { purpose: "message" },
    });
  });

  test("an EMPTY predicate does not count as naming a key — the default still applies", () => {
    expect(
      mergeEncryptionKey({ predicate: {} }, { predicate: { purpose: "message" } }),
    ).toEqual({ predicate: { purpose: "message" } });
  });

  // The security property: the descriptor is resolved AS A WHOLE. A message that
  // names a PREDICATE must not have a source-level KRYPTOS leak past it — that
  // would seal the message with a key it never named.
  test("a message predicate wins WHOLE — a source kryptos does not leak past it", () => {
    const merged = mergeEncryptionKey(
      { predicate: { purpose: "audit" } },
      { kryptos: TEST_KEY_ENV_KEK },
    );

    expect(merged.predicate).toEqual({ purpose: "audit" });
    expect(merged.kryptos).toBeUndefined();
  });

  test("a message kryptos wins over the source default's kryptos", () => {
    expect(
      mergeEncryptionKey({ kryptos: TEST_KEY_ENV_KEK }, { kryptos: TEST_KEY_ENC_MESSAGE })
        .kryptos?.id,
    ).toBe(TEST_KEY_ENV_KEK.id);
  });

  test("produces nothing from nothing", () => {
    expect(mergeEncryptionKey({}, undefined)).toEqual({});
  });
});
