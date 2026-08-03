import { Amphora } from "@lindorm/amphora";
import { AesKit } from "@lindorm/aes";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { ProteusError } from "../../../errors/index.js";
import { makeField } from "../../__fixtures__/make-field.js";
import type { MetaEncrypted } from "../types/metadata.js";
import { dehydrateFieldValue } from "./dehydrate-field-value.js";
import { deserialise } from "./deserialise.js";

const KEK = KryptosKit.generate.enc.oct({
  algorithm: "A128KW",
  issuer: "https://test.proteus/",
  purpose: "kek",
});

const createAmphora = () => {
  const amphora = new Amphora({
    logger: createMockLogger(),
    domain: "https://test.lindorm.io",
  });
  amphora.add(KEK);
  return amphora;
};

const ENCRYPTED: MetaEncrypted = { kryptos: null, condition: { purpose: "kek" } };

const open = (cipher: unknown): unknown =>
  new AesKit({ kryptos: KEK }).decrypt(cipher as string);

describe("dehydrateFieldValue", () => {
  describe("plaintext fields", () => {
    test("should apply transform.to before the driver coercion", () => {
      const field = makeField("label", {
        transform: { to: (v: any) => `${v}!`, from: (v: any) => v },
      });

      expect(
        dehydrateFieldValue("hi", field, "Entity", {
          coerce: (v) => `<${v as string}>`,
        }),
      ).toBe("<hi!>");
    });

    test("should not apply transform.to to a null value", () => {
      const field = makeField("label", {
        transform: {
          to: () => "should-not-run",
          from: (v: any) => v,
        },
      });

      expect(dehydrateFieldValue(null, field, "Entity")).toBeNull();
    });

    test("should pass the value through untouched with no coercion and no field", () => {
      expect(dehydrateFieldValue("raw", null, "Entity")).toBe("raw");
    });
  });

  describe("encrypted fields", () => {
    test("should encrypt instead of applying the driver coercion", () => {
      const field = makeField("secret", { encrypted: ENCRYPTED });
      const amphora = createAmphora();

      const result = dehydrateFieldValue("plain", field, "Entity", {
        amphora,
        coerce: () => "COERCED",
      });

      expect(result).not.toBe("COERCED");
      expect(open(result)).toBe("plain");
    });

    test("should encrypt AFTER transform.to", () => {
      const field = makeField("secret", {
        encrypted: ENCRYPTED,
        transform: { to: (v: any) => (v as string).toUpperCase(), from: (v: any) => v },
      });

      const result = dehydrateFieldValue("plain", field, "Entity", {
        amphora: createAmphora(),
      });

      expect(open(result)).toBe("PLAIN");
    });

    test("should serialise a Date to an ISO string the read path restores", () => {
      const field = makeField("secretAt", { type: "timestamp", encrypted: ENCRYPTED });
      const value = new Date("2021-03-04T05:06:07.008Z");

      const result = dehydrateFieldValue(value, field, "Entity", {
        amphora: createAmphora(),
      });

      expect(open(result)).toBe("2021-03-04T05:06:07.008Z");
      expect(deserialise(open(result), "timestamp")).toEqual(value);
    });

    test("should serialise a bigint to a decimal string the read path restores", () => {
      const field = makeField("secretAmount", { type: "bigint", encrypted: ENCRYPTED });

      const result = dehydrateFieldValue(9007199254740993n, field, "Entity", {
        amphora: createAmphora(),
      });

      expect(open(result)).toBe("9007199254740993");
      expect(deserialise(open(result), "bigint")).toBe(9007199254740993n);
    });

    test("should serialise a typed bigint array element-wise", () => {
      const field = makeField("amounts", {
        type: "array",
        arrayType: "bigint",
        encrypted: ENCRYPTED,
      });

      const result = dehydrateFieldValue([1n, 2n], field, "Entity", {
        amphora: createAmphora(),
      });

      expect(open(result)).toEqual(["1", "2"]);
      expect(deserialise(open(result), "array", null, "bigint")).toEqual([1n, 2n]);
    });

    test("should leave a null value null without touching the vault", () => {
      const field = makeField("secret", { encrypted: ENCRYPTED });

      expect(dehydrateFieldValue(null, field, "Entity")).toBeNull();
    });

    // The guard used to read `field.encrypted && amphora`, so a source that had
    // connected without setup() silently wrote the PLAINTEXT into a sealed
    // column. Downgrading an @Encrypted column is a security failure, not a
    // fallback — the write must fail.
    test("should throw missing_amphora rather than write plaintext", () => {
      const field = makeField("secret", { encrypted: ENCRYPTED });

      expect(() => dehydrateFieldValue("plain", field, "Entity")).toThrow(ProteusError);
      expect(() => dehydrateFieldValue("plain", field, "Entity")).toThrow(
        /requires an amphora/,
      );
    });
  });
});
