import { describe, expect, test } from "vitest";
import { TEST_KEY_ENV_KEK } from "../../__fixtures__/keys.js";
import { hasEncryptionKey } from "./has-encryption-key.js";

describe("hasEncryptionKey", () => {
  test.each([
    { name: "a kryptos", key: { kryptos: TEST_KEY_ENV_KEK }, expected: true },
    { name: "a predicate", key: { predicate: { purpose: "message" } }, expected: true },
    {
      name: "both",
      key: { kryptos: TEST_KEY_ENV_KEK, predicate: { purpose: "message" } },
      expected: true,
    },
    { name: "nothing", key: {}, expected: false },
    // An empty predicate is not a predicate: `find({})` is the unscoped lookup
    // that hands out whatever key is newest.
    { name: "an empty predicate", key: { predicate: {} }, expected: false },
    { name: "an undefined predicate", key: { predicate: undefined }, expected: false },
  ])("should be $expected for $name", ({ key, expected }) => {
    expect(hasEncryptionKey(key)).toBe(expected);
  });
});
