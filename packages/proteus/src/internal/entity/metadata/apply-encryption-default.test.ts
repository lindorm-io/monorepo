import { KryptosKit } from "@lindorm/kryptos";
import { makeField } from "../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../types/metadata.js";
import { applyEncryptionDefault } from "./apply-encryption-default.js";
import { describe, expect, test } from "vitest";

const KEK = KryptosKit.generate.enc.oct({
  algorithm: "A128KW",
  issuer: "https://test.proteus/",
});

const createMetadata = (fields: Array<ReturnType<typeof makeField>>): EntityMetadata =>
  ({ entity: { name: "TestEntity" }, fields }) as unknown as EntityMetadata;

describe("applyEncryptionDefault", () => {
  test("should return metadata untouched when there is no default", () => {
    const metadata = createMetadata([
      makeField("secret", { encrypted: { kryptos: null, condition: null } }),
    ]);

    expect(applyEncryptionDefault(metadata, undefined)).toBe(metadata);
    expect(applyEncryptionDefault(metadata, {})).toBe(metadata);
  });

  test("should fill a bare @Encrypted field with the default condition", () => {
    const metadata = createMetadata([
      makeField("secret", { encrypted: { kryptos: null, condition: null } }),
    ]);

    const resolved = applyEncryptionDefault(metadata, {
      condition: { purpose: "pylon:kek" },
    });

    expect(resolved.fields[0].encrypted).toEqual({
      kryptos: null,
      condition: { purpose: "pylon:kek" },
    });
  });

  test("should fill a bare @Encrypted field with the default kryptos", () => {
    const metadata = createMetadata([
      makeField("secret", { encrypted: { kryptos: null, condition: null } }),
    ]);

    const resolved = applyEncryptionDefault(metadata, { kryptos: KEK });

    expect(resolved.fields[0].encrypted).toEqual({ kryptos: KEK, condition: null });
  });

  test("should not override a decorator that names its own key", () => {
    const metadata = createMetadata([
      makeField("secret", {
        encrypted: { kryptos: null, condition: { purpose: "field:kek" } },
      }),
    ]);

    const resolved = applyEncryptionDefault(metadata, { kryptos: KEK });

    // Descriptor-wise, not key-wise: a key-wise merge would leave the source KEK
    // in place and let it outrank the condition the decorator asked for.
    expect(resolved.fields[0].encrypted).toEqual({
      kryptos: null,
      condition: { purpose: "field:kek" },
    });
  });

  test("should leave non-encrypted fields alone", () => {
    const metadata = createMetadata([makeField("id"), makeField("name")]);

    const resolved = applyEncryptionDefault(metadata, { kryptos: KEK });

    expect(resolved.fields.map((f) => f.encrypted)).toEqual([null, null]);
  });

  test("should not mutate the original metadata", () => {
    const metadata = createMetadata([
      makeField("secret", { encrypted: { kryptos: null, condition: null } }),
    ]);

    applyEncryptionDefault(metadata, { kryptos: KEK });

    expect(metadata.fields[0].encrypted).toEqual({ kryptos: null, condition: null });
  });
});
