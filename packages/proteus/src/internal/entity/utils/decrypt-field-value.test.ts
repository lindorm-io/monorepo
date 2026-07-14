import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusError } from "../../../errors/index.js";
import type { MetaEncrypted } from "../types/metadata.js";
import { decryptFieldValue } from "./decrypt-field-value.js";
import { encryptFieldValue } from "./encrypt-field-value.js";
import { describe, expect, test } from "vitest";

const createKek = () =>
  KryptosKit.generate.enc.oct({
    algorithm: "A128KW",
    issuer: "https://test.proteus/",
    purpose: "kek",
  });

const createAmphora = (...keys: Array<ReturnType<typeof createKek>>) => {
  const amphora = new Amphora({
    logger: createMockLogger(),
    domain: "https://test.lindorm.io",
  });
  for (const key of keys) amphora.add(key);
  return amphora;
};

const VAULT: MetaEncrypted = { kryptos: null, predicate: { purpose: "kek" } };

describe("decryptFieldValue", () => {
  test("should decrypt a previously encrypted string", () => {
    const amphora = createAmphora(createKek());
    const original = "hello world";
    const cipher = encryptFieldValue(original, VAULT, amphora, "field", "Entity");
    expect(decryptFieldValue(cipher, VAULT, amphora, "field", "Entity")).toBe(original);
  });

  describe("round-trip preserves value", () => {
    test("string", () => {
      const amphora = createAmphora(createKek());
      const value = "sensitive string";
      const cipher = encryptFieldValue(value, VAULT, amphora, "f", "E");
      expect(decryptFieldValue(cipher, VAULT, amphora, "f", "E")).toBe(value);
    });

    test("number", () => {
      const amphora = createAmphora(createKek());
      const value = 42.5;
      const cipher = encryptFieldValue(value, VAULT, amphora, "f", "E");
      expect(decryptFieldValue(cipher, VAULT, amphora, "f", "E")).toBe(value);
    });

    test("boolean", () => {
      const amphora = createAmphora(createKek());
      const value = true;
      const cipher = encryptFieldValue(value, VAULT, amphora, "f", "E");
      expect(decryptFieldValue(cipher, VAULT, amphora, "f", "E")).toBe(value);
    });

    test("object", () => {
      const amphora = createAmphora(createKek());
      const value = { nested: "data", count: 3 };
      const cipher = encryptFieldValue(value, VAULT, amphora, "f", "E");
      expect(decryptFieldValue(cipher, VAULT, amphora, "f", "E")).toEqual(value);
    });

    test("array", () => {
      const amphora = createAmphora(createKek());
      const value = [1, "two", false];
      const cipher = encryptFieldValue(value, VAULT, amphora, "f", "E");
      expect(decryptFieldValue(cipher, VAULT, amphora, "f", "E")).toEqual(value);
    });
  });

  // The sharp edge: an injected KEK is not necessarily a vault resident. Without
  // consulting it on the read side, such a column encrypts fine and then fails to
  // decrypt forever.
  test("should decrypt with an injected kryptos that is absent from the vault", () => {
    const injected: MetaEncrypted = { kryptos: createKek(), predicate: null };
    const amphora = createAmphora();

    const cipher = encryptFieldValue("secret", injected, amphora, "f", "E");

    expect(decryptFieldValue(cipher, injected, amphora, "f", "E")).toBe("secret");
  });

  // Rows written BEFORE a key was injected were encrypted by a vault key. The
  // ciphertext names it, so it must still resolve through the vault.
  test("should fall back to the vault when the ciphertext names another key", () => {
    const vaultKey = createKek();
    const amphora = createAmphora(vaultKey);

    const cipher = encryptFieldValue("legacy", VAULT, amphora, "f", "E");

    const injected: MetaEncrypted = { kryptos: createKek(), predicate: null };
    expect(decryptFieldValue(cipher, injected, amphora, "f", "E")).toBe("legacy");
  });

  test("should throw ProteusError when amphora is undefined", () => {
    expect(() =>
      decryptFieldValue("cipher", VAULT, undefined as any, "secret", "TestEntity"),
    ).toThrow(ProteusError);
    expect(() =>
      decryptFieldValue("cipher", VAULT, undefined as any, "secret", "TestEntity"),
    ).toThrow("Encryption requires an amphora instance but none was provided");
  });

  test("should throw ProteusError when amphora is null", () => {
    expect(() =>
      decryptFieldValue("cipher", VAULT, null as any, "secret", "TestEntity"),
    ).toThrow(ProteusError);
  });

  test("should throw with entity/field context on a garbage cipher", () => {
    const amphora = createAmphora(createKek());
    expect(() =>
      decryptFieldValue("not-a-valid-cipher", VAULT, amphora, "myField", "MyEntity"),
    ).toThrow('Failed to decrypt field "myField" on entity "MyEntity"');
  });

  test("should throw with entity/field context when the key is not found", () => {
    const cipher = encryptFieldValue(
      "value",
      VAULT,
      createAmphora(createKek()),
      "f",
      "E",
    );

    // A second amphora, holding a different key than the one that encrypted.
    const other = createAmphora(createKek());

    expect(() => decryptFieldValue(cipher, VAULT, other, "myField", "MyEntity")).toThrow(
      ProteusError,
    );
    expect(() => decryptFieldValue(cipher, VAULT, other, "myField", "MyEntity")).toThrow(
      'Failed to decrypt field "myField" on entity "MyEntity"',
    );
  });
});
