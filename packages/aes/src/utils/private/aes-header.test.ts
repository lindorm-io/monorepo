import { B64 } from "@lindorm/b64";
import { AesError } from "../../errors";
import {
  buildAesHeader,
  computeAad,
  decodeAesHeader,
  encodeAesHeader,
  headerToDecryptionParams,
} from "./aes-header";

describe("aes-header", () => {
  describe("buildAesHeader", () => {
    test("should build a minimal header (dir mode)", () => {
      const header = buildAesHeader({
        algorithm: "dir",
        contentType: "text/plain",
        encryption: "A256GCM",
        keyId: "test-key-id",
      });

      expect(header.alg).toBe("dir");
      expect(header.cty).toBe("text/plain");
      expect(header.enc).toBe("A256GCM");
      expect(header.kid).toBe("test-key-id");
      expect(header.v).toBe("1.0");
      expect(header.epk).toBeUndefined();
      expect(header.p2c).toBeUndefined();
      expect(header.p2s).toBeUndefined();
    });

    test("should build a header with ECDH-ES epk", () => {
      const header = buildAesHeader({
        algorithm: "ECDH-ES",
        contentType: "text/plain",
        encryption: "A256GCM",
        keyId: "test-key-id",
        publicEncryptionJwk: {
          crv: "P-256",
          kty: "EC",
          x: "x-value",
          y: "y-value",
        },
      });

      expect(header.epk).toEqual({
        crv: "P-256",
        kty: "EC",
        x: "x-value",
        y: "y-value",
      });
    });

    test("should build a header with PBES2 params", () => {
      const header = buildAesHeader({
        algorithm: "PBES2-HS256+A128KW",
        contentType: "text/plain",
        encryption: "A128GCM",
        keyId: "test-key-id",
        pbkdfIterations: 10000,
        pbkdfSalt: Buffer.from("salt-value"),
      });

      expect(header.p2c).toBe(10000);
      expect(header.p2s).toEqual(expect.any(String));
    });

    test("should build a header with GCMKW params", () => {
      const header = buildAesHeader({
        algorithm: "A128GCMKW",
        contentType: "text/plain",
        encryption: "A256GCM",
        keyId: "test-key-id",
        publicEncryptionIv: Buffer.from("gcmkw-iv-data"),
        publicEncryptionTag: Buffer.from("gcmkw-tag-data"),
      });

      expect(header.iv).toEqual(expect.any(String));
      expect(header.tag).toEqual(expect.any(String));
    });

    test("should sort keys alphabetically and remove undefined values", () => {
      const header = buildAesHeader({
        algorithm: "dir",
        contentType: "text/plain",
        encryption: "A256GCM",
        keyId: "test-key-id",
      });

      const keys = Object.keys(header);
      expect(keys).toEqual(keys.sort());
      // Undefined values should not be present as keys
      expect(keys).not.toContain("epk");
      expect(keys).not.toContain("p2c");
      expect(keys).not.toContain("p2s");
    });
  });

  describe("encodeAesHeader / decodeAesHeader", () => {
    test("should round-trip encode and decode a header", () => {
      const header = buildAesHeader({
        algorithm: "dir",
        contentType: "text/plain",
        encryption: "A256GCM",
        keyId: "test-key-id",
      });

      const encoded = encodeAesHeader(header);
      expect(typeof encoded).toBe("string");

      const decoded = decodeAesHeader(encoded);
      expect(decoded).toEqual(header);
    });

    test("should round-trip a header with all fields", () => {
      const header = buildAesHeader({
        algorithm: "PBES2-HS256+A128KW",
        contentType: "application/json",
        encryption: "A128GCM",
        keyId: "test-key-id",
        pbkdfIterations: 50000,
        pbkdfSalt: Buffer.from("salt"),
        publicEncryptionJwk: {
          crv: "P-256",
          kty: "EC",
          x: "x-val",
          y: "y-val",
        },
        publicEncryptionIv: Buffer.from("iv-data"),
        publicEncryptionTag: Buffer.from("tag-data"),
      });

      const encoded = encodeAesHeader(header);
      const decoded = decodeAesHeader(encoded);
      expect(decoded).toEqual(header);
    });

    test("should throw for invalid base64url input", () => {
      expect(() => decodeAesHeader("!!!invalid!!!")).toThrow(AesError);
    });

    test("should throw for missing required fields", () => {
      const json = JSON.stringify({ v: "1.0" }); // Missing alg and enc
      const encoded = B64.encode(Buffer.from(json, "utf8"), "b64u");
      expect(() => decodeAesHeader(encoded)).toThrow("missing required fields");
    });

    test("should throw for invalid version", () => {
      const json = JSON.stringify({ alg: "dir", enc: "A256GCM", v: "2.0" });
      const encoded = B64.encode(Buffer.from(json, "utf8"), "b64u");
      expect(() => decodeAesHeader(encoded)).toThrow("Incompatible AES version");
    });
  });

  describe("computeAad", () => {
    test("should return ASCII buffer from base64url header string", () => {
      const headerB64 = "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0";
      const aad = computeAad(headerB64);

      expect(aad).toBeInstanceOf(Buffer);
      expect(aad.toString("ascii")).toBe(headerB64);
    });
  });

  describe("headerToDecryptionParams", () => {
    test("should convert a minimal header to decryption params", () => {
      const header = buildAesHeader({
        algorithm: "dir",
        contentType: "text/plain",
        encryption: "A256GCM",
        keyId: "test-key-id",
      });

      const params = headerToDecryptionParams(header);

      expect(params.algorithm).toBe("dir");
      expect(params.contentType).toBe("text/plain");
      expect(params.encryption).toBe("A256GCM");
      expect(params.keyId).toBe("test-key-id");
      expect(params.version).toBe("1.0");
      expect(params.pbkdfIterations).toBeUndefined();
      expect(params.pbkdfSalt).toBeUndefined();
      expect(params.publicEncryptionIv).toBeUndefined();
      expect(params.publicEncryptionJwk).toBeUndefined();
      expect(params.publicEncryptionTag).toBeUndefined();
    });

    test("should convert a header with PBES2 params", () => {
      const salt = Buffer.from("test-salt");
      const header = buildAesHeader({
        algorithm: "PBES2-HS256+A128KW",
        contentType: "text/plain",
        encryption: "A128GCM",
        keyId: "test-key-id",
        pbkdfIterations: 10000,
        pbkdfSalt: salt,
      });

      const params = headerToDecryptionParams(header);

      expect(params.pbkdfIterations).toBe(10000);
      expect(params.pbkdfSalt).toEqual(salt);
    });

    test("should convert a header with GCMKW params", () => {
      const iv = Buffer.from("gcmkw-iv");
      const tag = Buffer.from("gcmkw-tag");
      const header = buildAesHeader({
        algorithm: "A128GCMKW",
        contentType: "text/plain",
        encryption: "A256GCM",
        keyId: "test-key-id",
        publicEncryptionIv: iv,
        publicEncryptionTag: tag,
      });

      const params = headerToDecryptionParams(header);

      expect(params.publicEncryptionIv).toEqual(iv);
      expect(params.publicEncryptionTag).toEqual(tag);
    });
  });
});
