import { describe, expect, test } from "vitest";
import { CborError } from "../../errors/index.js";
import type { ResolvedCborField } from "../types/resolved-cbor-spec.js";
import { encodeValue } from "./encode-value.js";

const field = (partial: Partial<ResolvedCborField>): ResolvedCborField => ({
  key: "x",
  label: 1,
  kind: "text",
  ...partial,
});

describe("encodeValue", () => {
  test("should encode text", () => {
    expect(encodeValue(field({ kind: "text" }), "hello")).toEqual("hello");
  });

  test("should encode int", () => {
    expect(encodeValue(field({ kind: "int" }), 42)).toEqual(42);
  });

  test("should encode bool", () => {
    expect(encodeValue(field({ kind: "bool" }), true)).toEqual(true);
  });

  test("should encode a Date to unix seconds", () => {
    expect(
      encodeValue(field({ kind: "date" }), new Date("2026-07-16T00:00:00.000Z")),
    ).toEqual(1784160000);
  });

  test("should pass a numeric date through as unix seconds", () => {
    expect(encodeValue(field({ kind: "date" }), 1784160000)).toEqual(1784160000);
  });

  describe("enum", () => {
    const enumField = field({ kind: "enum", enum: { pwd: 1, otp: 2 } });

    test("should encode a known enum value to its wire code", () => {
      expect(encodeValue(enumField, "otp")).toEqual(2);
    });

    test("should throw on an unknown enum value", () => {
      expect(() => encodeValue(enumField, "face")).toThrowError(
        expect.objectContaining({ code: "unknown_enum_value" }),
      );
      expect(() => encodeValue(enumField, "face")).toThrow(CborError);
    });
  });

  describe("bstr", () => {
    test("should encode a Buffer to a plain Uint8Array (not a Buffer)", () => {
      const result = encodeValue(field({ kind: "bstr" }), Buffer.from([1, 2, 3]));

      expect(result).toBeInstanceOf(Uint8Array);
      expect(Buffer.isBuffer(result)).toEqual(false);
      expect(Array.from(result as Uint8Array)).toEqual([1, 2, 3]);
    });

    test("should encode a Uint8Array to a plain Uint8Array", () => {
      const result = encodeValue(field({ kind: "bstr" }), new Uint8Array([9, 8, 7]));

      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result as Uint8Array)).toEqual([9, 8, 7]);
    });

    test("should decode a base64url string to a plain Uint8Array", () => {
      const result = encodeValue(field({ kind: "bstr", encoding: "b64u" }), "AQID");

      expect(result).toBeInstanceOf(Uint8Array);
      expect(Buffer.isBuffer(result)).toEqual(false);
      expect(Array.from(result as Uint8Array)).toEqual([1, 2, 3]);
    });
  });

  describe("bstrArray", () => {
    test("should encode an array of Buffers to plain Uint8Arrays", () => {
      const result = encodeValue(field({ kind: "bstrArray" }), [
        Buffer.from([1]),
        Buffer.from([2]),
      ]) as Array<Uint8Array>;

      expect(result).toHaveLength(2);
      result.forEach((item) => {
        expect(item).toBeInstanceOf(Uint8Array);
        expect(Buffer.isBuffer(item)).toEqual(false);
      });
      expect(Array.from(result[0])).toEqual([1]);
      expect(Array.from(result[1])).toEqual([2]);
    });
  });

  test("should encode a bespoke value via the field encoder", () => {
    const bespoke = field({
      kind: "bespoke",
      encode: (v) => (v as number) * 2,
      decode: (v) => v,
    });

    expect(encodeValue(bespoke, 21)).toEqual(42);
  });
});
