import { ShaKit } from "@lindorm/sha";
import type { SensitiveDigest } from "../types/metadata.js";
import { EntityMetadataError } from "../errors/EntityMetadataError.js";
import { digestFormatRegex } from "./digest-format.js";
import { describe, expect, test } from "vitest";

// Real fixtures produced by the argon2 npm lib (the shape behind @lindorm/enigma)
const ARGON2ID_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$BX32mY7d1Ze35yl60vSt8g$OzUIrSls4ygVrk4peci3Cr7VU9e7BiTkotwvaCyo6HU";
const ARGON2D_HASH =
  "$argon2d$v=19$m=65536,t=3,p=4$XvvyWukjcmY6B0icYiaP5g$0bNiSj2jOo6aJ6GlUcU/JBR2Mfb7AF4KT9Pydhz6bmI";

describe("digestFormatRegex", () => {
  describe("sha256", () => {
    const regex = digestFormatRegex("sha256");

    test("should accept the real ShaKit.S256 output", () => {
      expect(regex.test(ShaKit.S256("hunter2"))).toBe(true);
    });

    test("should reject plaintext", () => {
      expect(regex.test("hunter2")).toBe(false);
    });

    test("should reject a wrong-length digest", () => {
      expect(regex.test(ShaKit.S512("hunter2"))).toBe(false);
    });

    test("should reject a padded standard-base64 digest", () => {
      expect(regex.test("LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=")).toBe(false);
    });
  });

  describe("sha384", () => {
    const regex = digestFormatRegex("sha384");

    test("should accept the real ShaKit.S384 output", () => {
      expect(regex.test(ShaKit.S384("hunter2"))).toBe(true);
    });

    test("should reject a sha256-length digest", () => {
      expect(regex.test(ShaKit.S256("hunter2"))).toBe(false);
    });
  });

  describe("sha512", () => {
    const regex = digestFormatRegex("sha512");

    test("should accept the real ShaKit.S512 output", () => {
      expect(regex.test(ShaKit.S512("hunter2"))).toBe(true);
    });

    test("should reject a sha256-length digest", () => {
      expect(regex.test(ShaKit.S256("hunter2"))).toBe(false);
    });
  });

  describe("md5", () => {
    const regex = digestFormatRegex("md5");

    test("should accept a lowercase hex-32 digest", () => {
      expect(regex.test("5d41402abc4b2a76b9719d911017c592")).toBe(true);
    });

    test("should accept an uppercase hex-32 digest (case-insensitive)", () => {
      expect(regex.test("5D41402ABC4B2A76B9719D911017C592")).toBe(true);
    });

    test("should reject a wrong-length value", () => {
      expect(regex.test("5d41402abc4b2a76b9719d911017c59")).toBe(false);
    });

    test("should reject a non-hex alphabet", () => {
      expect(regex.test("5g41402abc4b2a76b9719d911017c592")).toBe(false);
    });
  });

  describe("argon2", () => {
    const regex = digestFormatRegex("argon2");

    test("should accept a real argon2id PHC string", () => {
      expect(regex.test(ARGON2ID_HASH)).toBe(true);
    });

    test("should accept a real argon2d PHC string", () => {
      expect(regex.test(ARGON2D_HASH)).toBe(true);
    });

    test("should reject plaintext", () => {
      expect(regex.test("hunter2")).toBe(false);
    });

    test("should reject reordered parameters", () => {
      expect(
        regex.test(
          "$argon2id$v=19$t=3,m=65536,p=4$BX32mY7d1Ze35yl60vSt8g$OzUIrSls4ygVrk4peci3Cr7VU9e7BiTkotwvaCyo6HU",
        ),
      ).toBe(false);
    });

    test("should reject an unknown variant", () => {
      expect(
        regex.test(
          "$argon2x$v=19$m=65536,t=3,p=4$BX32mY7d1Ze35yl60vSt8g$OzUIrSls4ygVrk4peci3Cr7VU9e7BiTkotwvaCyo6HU",
        ),
      ).toBe(false);
    });

    test("should reject a base64url alphabet in the hash body", () => {
      expect(regex.test("$argon2id$v=19$m=65536,t=3,p=4$BX32mY7d$Oz-UIrSls_4yg")).toBe(
        false,
      );
    });
  });

  describe("unknown digest", () => {
    test("should throw an EntityMetadataError", () => {
      expect(() => digestFormatRegex("sha1" as SensitiveDigest)).toThrow(
        EntityMetadataError,
      );
    });
  });
});
