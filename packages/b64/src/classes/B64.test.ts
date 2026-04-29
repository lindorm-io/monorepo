import { B64 } from "./B64.js";
import { describe, expect, test } from "vitest";

describe("B64", () => {
  describe("encode", () => {
    test("should encode base64", () => {
      expect(B64.encode("hello there - general kenobi")).toEqual(
        "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ==",
      );

      expect(B64.encode("hello there - general kenobi", "base64")).toEqual(
        "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ==",
      );

      expect(B64.encode("hello there - general kenobi", "b64")).toEqual(
        "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ==",
      );
    });

    test("should encode base64Url", () => {
      expect(B64.encode("hello there - general kenobi", "base64url")).toEqual(
        "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ",
      );

      expect(B64.encode("hello there - general kenobi", "b64url")).toEqual(
        "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ",
      );

      expect(B64.encode("hello there - general kenobi", "b64u")).toEqual(
        "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ",
      );
    });

    test("should encode a Buffer", () => {
      expect(B64.encode(Buffer.from("hello there - general kenobi"))).toEqual(
        "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ==",
      );
    });

    test("should encode a Uint8Array", () => {
      const bytes = new TextEncoder().encode("hello there - general kenobi");

      expect(B64.encode(bytes)).toEqual("aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ==");
      expect(B64.encode(bytes, "base64url")).toEqual(
        "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ",
      );
    });
  });

  describe("decode to buffer", () => {
    test("should decode base64", () => {
      expect(B64.toBuffer("aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ==")).toEqual(
        Buffer.from("hello there - general kenobi"),
      );
    });

    test("should decode base64Url", () => {
      expect(B64.toBuffer("aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ")).toEqual(
        Buffer.from("hello there - general kenobi"),
      );
    });
  });

  describe("decode to bytes", () => {
    test("should decode base64", () => {
      const bytes = B64.toBytes("aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ==");

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes).toEqual(new TextEncoder().encode("hello there - general kenobi"));
    });

    test("should decode base64Url", () => {
      const bytes = B64.toBytes("aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ");

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes).toEqual(new TextEncoder().encode("hello there - general kenobi"));
    });
  });

  describe("decode to string", () => {
    test("should decode base64", () => {
      expect(B64.toString("aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ==")).toEqual(
        "hello there - general kenobi",
      );
    });

    test("should decode base64Url", () => {
      expect(B64.toString("aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ")).toEqual(
        "hello there - general kenobi",
      );
    });
  });
});
