import { describe, expect, test } from "vitest";
import { TEST_KEY_ENV_KEK } from "../../__fixtures__/keys.js";
import { hasEncryptionKey } from "./has-encryption-key.js";

describe("hasEncryptionKey", () => {
  test.each([
    { name: "a kryptos", key: { kryptos: TEST_KEY_ENV_KEK }, expected: true },
    { name: "a condition", key: { condition: { purpose: "message" } }, expected: true },
    {
      name: "both",
      key: { kryptos: TEST_KEY_ENV_KEK, condition: { purpose: "message" } },
      expected: true,
    },
    { name: "nothing", key: {}, expected: false },
    // An empty condition is not a condition: `find({})` is the unscoped lookup
    // that hands out whatever key is newest.
    { name: "an empty condition", key: { condition: {} }, expected: false },
    { name: "an undefined condition", key: { condition: undefined }, expected: false },
  ])("should be $expected for $name", ({ key, expected }) => {
    expect(hasEncryptionKey(key)).toBe(expected);
  });
});
