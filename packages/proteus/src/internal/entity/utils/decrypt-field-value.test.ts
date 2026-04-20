import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusError } from "../../../errors";
import { decryptFieldValue } from "./decrypt-field-value";
import { encryptFieldValue } from "./encrypt-field-value";
import { describe, expect, test } from "vitest";

const createTestAmphora = () => {
  const key = KryptosKit.generate.enc.oct({
    algorithm: "A128KW",
    issuer: "https://test.proteus/",
  });
  const amphora = new Amphora({
    logger: createMockLogger(),
    domain: "https://test.lindorm.io",
  });
  amphora.add(key);
  return amphora;
};

describe("decryptFieldValue", () => {
  test("should decrypt a previously encrypted string", () => {
    const amphora = createTestAmphora();
    const original = "hello world";
    const cipher = encryptFieldValue(original, null, amphora, "field", "Entity");
    const result = decryptFieldValue(cipher, amphora, "field", "Entity");
    expect(result).toBe(original);
  });

  describe("round-trip preserves value", () => {
    test("string", () => {
      const amphora = createTestAmphora();
      const value = "sensitive string";
      const cipher = encryptFieldValue(value, null, amphora, "f", "E");
      expect(decryptFieldValue(cipher, amphora, "f", "E")).toBe(value);
    });

    test("number", () => {
      const amphora = createTestAmphora();
      const value = 42.5;
      const cipher = encryptFieldValue(value, null, amphora, "f", "E");
      expect(decryptFieldValue(cipher, amphora, "f", "E")).toBe(value);
    });

    test("boolean", () => {
      const amphora = createTestAmphora();
      const value = true;
      const cipher = encryptFieldValue(value, null, amphora, "f", "E");
      expect(decryptFieldValue(cipher, amphora, "f", "E")).toBe(value);
    });

    test("object", () => {
      const amphora = createTestAmphora();
      const value = { nested: "data", count: 3 };
      const cipher = encryptFieldValue(value, null, amphora, "f", "E");
      expect(decryptFieldValue(cipher, amphora, "f", "E")).toEqual(value);
    });

    test("array", () => {
      const amphora = createTestAmphora();
      const value = [1, "two", false];
      const cipher = encryptFieldValue(value, null, amphora, "f", "E");
      expect(decryptFieldValue(cipher, amphora, "f", "E")).toEqual(value);
    });
  });

  test("should throw ProteusError when amphora is undefined", () => {
    expect(() =>
      decryptFieldValue("cipher", undefined as any, "secret", "TestEntity"),
    ).toThrow(ProteusError);
    expect(() =>
      decryptFieldValue("cipher", undefined as any, "secret", "TestEntity"),
    ).toThrow("Encryption requires an amphora instance but none was provided");
  });

  test("should throw ProteusError when amphora is null", () => {
    expect(() =>
      decryptFieldValue("cipher", null as any, "secret", "TestEntity"),
    ).toThrow(ProteusError);
  });

  test("should throw ProteusError with entity/field context when decryption fails on garbage cipher", () => {
    const amphora = createTestAmphora();
    expect(() =>
      decryptFieldValue("not-a-valid-cipher", amphora, "myField", "MyEntity"),
    ).toThrow(ProteusError);
    expect(() =>
      decryptFieldValue("not-a-valid-cipher", amphora, "myField", "MyEntity"),
    ).toThrow('Failed to decrypt field "myField" on entity "MyEntity"');
  });

  test("should throw ProteusError with entity/field context when key not found", () => {
    const amphora1 = createTestAmphora();
    const cipher = encryptFieldValue("value", null, amphora1, "f", "E");

    // Second amphora without the key used for encryption
    const amphora2 = new Amphora({
      logger: createMockLogger(),
      domain: "https://other.lindorm.io",
    });
    const differentKey = KryptosKit.generate.enc.oct({
      algorithm: "A128KW",
      issuer: "https://test.proteus/",
    });
    amphora2.add(differentKey);

    expect(() => decryptFieldValue(cipher, amphora2, "myField", "MyEntity")).toThrow(
      ProteusError,
    );
    expect(() => decryptFieldValue(cipher, amphora2, "myField", "MyEntity")).toThrow(
      'Failed to decrypt field "myField" on entity "MyEntity"',
    );
  });
});
