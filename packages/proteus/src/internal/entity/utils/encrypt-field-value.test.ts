import { Amphora } from "@lindorm/amphora";
import { parseAes } from "@lindorm/aes";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusError } from "../../../errors/index.js";
import type { MetaEncrypted } from "../types/metadata.js";
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

const selector = (predicate: MetaEncrypted["predicate"]): MetaEncrypted => ({
  kryptos: null,
  predicate,
});

describe("encryptFieldValue", () => {
  test("should encrypt a string value and return a string", () => {
    const amphora = createAmphora(createKek());
    const result = encryptFieldValue(
      "hello world",
      selector({ purpose: "kek" }),
      amphora,
      "secret",
      "TestEntity",
    );
    expect(typeof result).toBe("string");
  });

  test("should produce output different from input", () => {
    const amphora = createAmphora(createKek());
    const input = "sensitive data";
    const result = encryptFieldValue(
      input,
      selector({ purpose: "kek" }),
      amphora,
      "secret",
      "TestEntity",
    );
    expect(result).not.toBe(input);
  });

  test("should encrypt with an injected kryptos that is absent from the vault", () => {
    const kek = createKek();
    const amphora = createAmphora();

    const result = encryptFieldValue(
      "test value",
      { kryptos: kek, predicate: null },
      amphora,
      "field",
      "Entity",
    );

    expect(parseAes(result).keyId).toBe(kek.id);
  });

  test("should prefer an injected kryptos over the vault predicate", () => {
    const vaultKey = createKek();
    const injected = createKek();
    const amphora = createAmphora(vaultKey);

    const result = encryptFieldValue(
      "test value",
      { kryptos: injected, predicate: { purpose: "kek" } },
      amphora,
      "field",
      "Entity",
    );

    expect(parseAes(result).keyId).toBe(injected.id);
  });

  test("should throw ProteusError when amphora is undefined", () => {
    expect(() =>
      encryptFieldValue(
        "value",
        selector({ purpose: "kek" }),
        undefined as any,
        "secret",
        "TestEntity",
      ),
    ).toThrow(ProteusError);
    expect(() =>
      encryptFieldValue(
        "value",
        selector({ purpose: "kek" }),
        undefined as any,
        "secret",
        "TestEntity",
      ),
    ).toThrow("Encryption requires an amphora instance but none was provided");
  });

  test("should throw ProteusError when amphora is null", () => {
    expect(() =>
      encryptFieldValue(
        "value",
        selector({ purpose: "kek" }),
        null as any,
        "secret",
        "TestEntity",
      ),
    ).toThrow(ProteusError);
  });

  test("should throw with entity/field context when no key matches the predicate", () => {
    const amphora = createAmphora();

    expect(() =>
      encryptFieldValue(
        "value",
        selector({ purpose: "kek" }),
        amphora,
        "myField",
        "MyEntity",
      ),
    ).toThrow('No encryption key matches field "myField" on entity "MyEntity"');
  });

  test("should throw when an injected kryptos violates the encryption floor", () => {
    const sigKey = KryptosKit.generate.sig.oct({
      algorithm: "HS256",
      issuer: "https://test.proteus/",
    });
    const amphora = createAmphora(createKek());

    expect(() =>
      encryptFieldValue(
        "value",
        { kryptos: sigKey, predicate: null },
        amphora,
        "badField",
        "BadEntity",
      ),
    ).toThrow(
      'Encryption key for field "badField" on entity "BadEntity" violates the encryption floor',
    );
  });
});
