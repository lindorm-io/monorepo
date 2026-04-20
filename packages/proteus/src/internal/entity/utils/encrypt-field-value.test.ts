import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusError } from "../../../errors";
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

describe("encryptFieldValue", () => {
  test("should encrypt a string value and return a string", () => {
    const amphora = createTestAmphora();
    const result = encryptFieldValue(
      "hello world",
      null,
      amphora,
      "secret",
      "TestEntity",
    );
    expect(typeof result).toBe("string");
  });

  test("should produce output different from input", () => {
    const amphora = createTestAmphora();
    const input = "sensitive data";
    const result = encryptFieldValue(input, null, amphora, "secret", "TestEntity");
    expect(result).not.toBe(input);
  });

  test("should work with null predicate", () => {
    const amphora = createTestAmphora();
    const result = encryptFieldValue("test value", null, amphora, "field", "Entity");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("should throw ProteusError when amphora is undefined", () => {
    expect(() =>
      encryptFieldValue("value", null, undefined as any, "secret", "TestEntity"),
    ).toThrow(ProteusError);
    expect(() =>
      encryptFieldValue("value", null, undefined as any, "secret", "TestEntity"),
    ).toThrow("Encryption requires an amphora instance but none was provided");
  });

  test("should throw ProteusError when amphora is null", () => {
    expect(() =>
      encryptFieldValue("value", null, null as any, "secret", "TestEntity"),
    ).toThrow(ProteusError);
  });

  test("should throw ProteusError with entity/field context when findSync fails", () => {
    const amphora = new Amphora({
      logger: createMockLogger(),
      domain: "https://test.lindorm.io",
    });
    // No keys added, so findSync will fail
    expect(() =>
      encryptFieldValue("value", null, amphora, "myField", "MyEntity"),
    ).toThrow(ProteusError);
    expect(() =>
      encryptFieldValue("value", null, amphora, "myField", "MyEntity"),
    ).toThrow('Failed to encrypt field "myField" on entity "MyEntity"');
  });

  test("should throw ProteusError with entity/field context when encryption fails", () => {
    const sigKey = KryptosKit.generate.sig.oct({
      algorithm: "HS256",
      issuer: "https://test.proteus/",
    });
    const amphora = new Amphora({
      logger: createMockLogger(),
      domain: "https://test.lindorm.io",
    });
    amphora.add(sigKey);
    // sig key cannot be used for encryption (use: "enc" won't match)
    expect(() =>
      encryptFieldValue("value", null, amphora, "badField", "BadEntity"),
    ).toThrow(ProteusError);
    expect(() =>
      encryptFieldValue("value", null, amphora, "badField", "BadEntity"),
    ).toThrow('Failed to encrypt field "badField" on entity "BadEntity"');
  });
});
