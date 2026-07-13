import { describe, expect, it } from "vitest";
import { IrisMetadataError } from "../../../errors/index.js";
import type { SensitiveDigest } from "../types/metadata.js";
import { digestFormatRegex } from "./digest-format.js";

// Real digest fixtures — the SHA values are ShaKit output (unpadded base64url) for
// "hunter2"; the argon2 value is a strict PHC string from the argon2 npm lib.
const SHA256_HASH = "9S-9MrKzuG_4jvbEkGKChfSCrxXdyylUH5S89Saj9sc";
const SHA384_HASH = "myHEV67XVpgzsj3wQWgN66E51a9m-7ZKhBMWV4xFNMmMzQQh6fEOpLBbuxH4C0ak";
const SHA512_HASH =
  "a5ftaNFOs_GqlZzl1Jx9xhLh6x2v1zsecFhHSD_WpsgJ8s606N9v-ZhMYpj_AoXKzmYUv42qnwBwEBtsiYmeIg";
const MD5_HASH = "5d41402abc4b2a76b9719d911017c592"; // md5("hello")
const ARGON2_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$BX32mY7d1Ze35yl60vSt8g$OzUIrSls4ygVrk4peci3Cr7VU9e7BiTkotwvaCyo6HU";

describe("digestFormatRegex", () => {
  it.each([
    ["sha256", SHA256_HASH],
    ["sha384", SHA384_HASH],
    ["sha512", SHA512_HASH],
    ["md5", MD5_HASH],
    ["argon2", ARGON2_HASH],
  ] as Array<[SensitiveDigest, string]>)(
    "should accept a real %s digest",
    (digest, hash) => {
      expect(digestFormatRegex(digest).test(hash)).toBe(true);
    },
  );

  it.each([
    ["sha256", "hunter2"],
    ["sha384", "hunter2"],
    ["sha512", "hunter2"],
    ["md5", "hunter2"],
    ["argon2", "hunter2"],
  ] as Array<[SensitiveDigest, string]>)(
    "should reject plaintext for %s",
    (digest, value) => {
      expect(digestFormatRegex(digest).test(value)).toBe(false);
    },
  );

  it("should reject a sha digest of the wrong length", () => {
    expect(digestFormatRegex("sha256").test(SHA512_HASH)).toBe(false);
    expect(digestFormatRegex("sha384").test(SHA256_HASH)).toBe(false);
    expect(digestFormatRegex("sha512").test(SHA384_HASH)).toBe(false);
  });

  it("should reject a sha digest in the standard-base64 alphabet", () => {
    expect(digestFormatRegex("sha256").test(`${SHA256_HASH.slice(0, 41)}+/`)).toBe(false);
  });

  it("should accept an uppercase md5 digest", () => {
    expect(digestFormatRegex("md5").test(MD5_HASH.toUpperCase())).toBe(true);
  });

  it("should reject a non-hex md5 digest of the right length", () => {
    expect(digestFormatRegex("md5").test("z".repeat(32))).toBe(false);
  });

  it("should reject an md5 digest of the wrong length", () => {
    expect(digestFormatRegex("md5").test(MD5_HASH.slice(0, 31))).toBe(false);
  });

  it.each(["argon2i", "argon2d"])("should accept the %s variant", (variant) => {
    const hash = ARGON2_HASH.replace("argon2id", variant);

    expect(digestFormatRegex("argon2").test(hash)).toBe(true);
  });

  it("should reject a bcrypt hash for argon2", () => {
    expect(
      digestFormatRegex("argon2").test(
        "$2b$12$K3JNi5wG.Ijg8HkP5yQmO.9m6M9L1YQxq8m4KO6hIH5ROKzUJXhFa",
      ),
    ).toBe(false);
  });

  it("should reject an argon2 PHC string missing its parameters", () => {
    expect(digestFormatRegex("argon2").test("$argon2id$v=19$c2FsdA$aGFzaA")).toBe(false);
  });

  it("should throw on an unknown digest algorithm", () => {
    expect(() => digestFormatRegex("sha1" as SensitiveDigest)).toThrow(IrisMetadataError);
    expect(() => digestFormatRegex("sha1" as SensitiveDigest)).toThrow(
      /Unknown sensitive digest "sha1"/,
    );
  });
});
