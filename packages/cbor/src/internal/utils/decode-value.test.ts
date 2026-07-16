import { describe, expect, test } from "vitest";
import { CborError } from "../../errors/index.js";
import type { ResolvedCborField } from "../types/resolved-cbor-spec.js";
import { decodeValue } from "./decode-value.js";
import { encodeValue } from "./encode-value.js";

const field = (partial: Partial<ResolvedCborField>): ResolvedCborField => ({
  key: "x",
  label: 1,
  kind: "text",
  ...partial,
});

describe("decodeValue", () => {
  test("should decode text", () => {
    expect(decodeValue(field({ kind: "text" }), "hello")).toEqual("hello");
  });

  test("should decode int", () => {
    expect(decodeValue(field({ kind: "int" }), 42)).toEqual(42);
  });

  test("should decode bool", () => {
    expect(decodeValue(field({ kind: "bool" }), false)).toEqual(false);
  });

  test("should decode unix seconds to a Date", () => {
    expect(decodeValue(field({ kind: "date" }), 1784160000)).toEqual(
      new Date("2026-07-16T00:00:00.000Z"),
    );
  });

  describe("enum", () => {
    const enumField = field({
      kind: "enum",
      enum: { pwd: 1, otp: 2 },
      reverseEnum: { 1: "pwd", 2: "otp" },
    });

    test("should decode a known wire code to its enum value", () => {
      expect(decodeValue(enumField, 1)).toEqual("pwd");
    });

    test("should throw on an unknown wire code", () => {
      expect(() => decodeValue(enumField, 99)).toThrowError(
        expect.objectContaining({ code: "unknown_enum_int" }),
      );
      expect(() => decodeValue(enumField, 99)).toThrow(CborError);
    });
  });

  describe("bstr", () => {
    test("should decode wire bytes to a Buffer", () => {
      const result = decodeValue(field({ kind: "bstr" }), new Uint8Array([1, 2, 3]));

      expect(Buffer.isBuffer(result)).toEqual(true);
      expect(Array.from(result as Buffer)).toEqual([1, 2, 3]);
    });

    test("should decode wire bytes to a base64url string when encoding is set", () => {
      const result = decodeValue(
        field({ kind: "bstr", encoding: "b64u" }),
        new Uint8Array([1, 2, 3]),
      );

      expect(result).toEqual("AQID");
    });
  });

  describe("bstrArray", () => {
    test("should decode an array of wire bytes to Buffers", () => {
      const result = decodeValue(field({ kind: "bstrArray" }), [
        new Uint8Array([1]),
        new Uint8Array([2]),
      ]) as Array<Buffer>;

      expect(result).toHaveLength(2);
      expect(Array.from(result[0])).toEqual([1]);
      expect(Array.from(result[1])).toEqual([2]);
    });
  });

  test("should decode a bespoke value via the field decoder", () => {
    const bespoke = field({
      kind: "bespoke",
      encode: (v) => v,
      decode: (v) => (v as number) / 2,
    });

    expect(decodeValue(bespoke, 42)).toEqual(21);
  });

  describe("round-trip", () => {
    test("should round-trip a base64url bstr string", () => {
      const b64uField = field({ kind: "bstr", encoding: "b64u" });
      const wire = encodeValue(b64uField, "SGVsbG8");

      expect(decodeValue(b64uField, wire)).toEqual("SGVsbG8");
    });

    test("should round-trip a base64 bstr string", () => {
      const b64Field = field({ kind: "bstr", encoding: "base64" });
      const wire = encodeValue(b64Field, "SGVsbG8=");

      expect(decodeValue(b64Field, wire)).toEqual("SGVsbG8=");
    });
  });
});
