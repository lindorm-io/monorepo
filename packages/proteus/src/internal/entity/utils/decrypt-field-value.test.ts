import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusError } from "../../../errors/index.js";
import type { MetaEncrypted } from "../types/metadata.js";
import { decryptFieldValue } from "./decrypt-field-value.js";
import { encryptFieldValue } from "./encrypt-field-value.js";
import { afterEach, describe, expect, test, vi } from "vitest";

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

const VAULT: MetaEncrypted = { kryptos: null, condition: { purpose: "kek" } };

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
    const injected: MetaEncrypted = { kryptos: createKek(), condition: null };
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

    const injected: MetaEncrypted = { kryptos: createKek(), condition: null };
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

  // `findByIdSync` is unfiltered by design — the ciphertext names the key that
  // answers for it. So the read floor is the only check standing between that
  // claim and the crypto layer, and it is deliberately NOT the write floor.
  describe("the time floor", () => {
    // Same kid, a different lifetime. The ciphertext still names it.
    const rotate = (
      key: ReturnType<typeof createKek>,
      notBefore: Date,
      expiresAt: Date,
    ) => KryptosKit.clone(key, { notBefore, expiresAt });

    afterEach(() => {
      vi.useRealTimers();
    });

    // THE ROTATION PROPERTY. A KEK is minted once and read for years; a column
    // written under last year's key must keep opening after this year's rotation.
    // If the read floor demanded `isActive`, every rotation would destroy the data
    // the old key left behind. This is the test that must never regress.
    //
    // The clock has to MOVE for this to be honest: `Amphora.add` refuses a key
    // that is already expired, so the only way a vault holds one is the way a
    // deployment gets one — it was added while valid, and it aged.
    test("should still DECRYPT with a key that has since expired", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-01T00:00:00.000Z"));

      const key = rotate(
        createKek(),
        new Date("2024-01-01T00:00:00.000Z"),
        new Date("2025-01-01T00:00:00.000Z"),
      );
      const amphora = createAmphora(key);

      const cipher = encryptFieldValue("sealed while valid", VAULT, amphora, "f", "E");

      // Two years on: the key has expired, the row has not.
      vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
      expect(key.isExpired).toBe(true);

      expect(decryptFieldValue(cipher, VAULT, amphora, "f", "E")).toBe(
        "sealed while valid",
      );
    });

    test("should refuse to DECRYPT against a key that is not yet valid", () => {
      // A key whose `notBefore` has not passed cannot have encrypted anything,
      // ever — so nothing that names it is real, however well-formed.
      const key = createKek();
      const cipher = encryptFieldValue(
        "value",
        { kryptos: key, condition: null },
        createAmphora(),
        "f",
        "E",
      );

      const pending = rotate(key, new Date("2099-01-01"), new Date("2100-01-01"));
      expect(pending.isPending).toBe(true);

      const amphora = createAmphora(pending);

      expect(() =>
        decryptFieldValue(cipher, VAULT, amphora, "myField", "MyEntity"),
      ).toThrow(ProteusError);
      expect(() =>
        decryptFieldValue(cipher, VAULT, amphora, "myField", "MyEntity"),
      ).toThrow(
        'Decryption key for field "myField" on entity "MyEntity" violates the decryption floor',
      );
    });

    test("should refuse to DECRYPT against an INJECTED key that is not yet valid", () => {
      const key = createKek();
      const cipher = encryptFieldValue(
        "value",
        { kryptos: key, condition: null },
        createAmphora(),
        "f",
        "E",
      );

      const pending = rotate(key, new Date("2099-01-01"), new Date("2100-01-01"));

      expect(() =>
        decryptFieldValue(
          cipher,
          { kryptos: pending, condition: null },
          createAmphora(),
          "f",
          "E",
        ),
      ).toThrow(
        'Decryption key for field "f" on entity "E" violates the decryption floor',
      );
    });

    test("should refuse to DECRYPT against a signing key the ciphertext names", () => {
      // The other half of the same hole: an unfloored `findByIdSync` lets the
      // ciphertext hand an `AesKit` whatever key it likes.
      const key = createKek();
      const cipher = encryptFieldValue(
        "value",
        { kryptos: key, condition: null },
        createAmphora(),
        "f",
        "E",
      );

      const sig = KryptosKit.clone(
        KryptosKit.generate.sig.oct({
          algorithm: "HS256",
          issuer: "https://test.proteus/",
          purpose: "kek",
        }),
        { id: key.id },
      );

      expect(() =>
        decryptFieldValue(cipher, VAULT, createAmphora(sig), "f", "E"),
      ).toThrow(
        'Decryption key for field "f" on entity "E" violates the decryption floor',
      );
    });
  });
});
