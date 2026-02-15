import { KryptosEncryption } from "@lindorm/kryptos";
import { CipherGCM, DecipherGCM } from "crypto";
import { randomBytes } from "crypto";
import { AesError } from "../../../errors";
import { assertAuthTag, createAuthTag } from "./auth-tag";

describe("createAuthTag", () => {
  describe("GCM modes", () => {
    test("should call cipher.getAuthTag() for A128GCM", () => {
      const mockAuthTag = randomBytes(16);
      const mockCipher = {
        getAuthTag: jest.fn().mockReturnValue(mockAuthTag),
      } as unknown as CipherGCM;

      const result = createAuthTag({
        encryption: "A128GCM",
        cipher: mockCipher,
        content: randomBytes(64),
        hashKey: Buffer.alloc(0),
        initialisationVector: randomBytes(12),
      });

      expect(mockCipher.getAuthTag).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockAuthTag);
    });

    test("should call cipher.getAuthTag() for A192GCM", () => {
      const mockAuthTag = randomBytes(16);
      const mockCipher = {
        getAuthTag: jest.fn().mockReturnValue(mockAuthTag),
      } as unknown as CipherGCM;

      const result = createAuthTag({
        encryption: "A192GCM",
        cipher: mockCipher,
        content: randomBytes(64),
        hashKey: Buffer.alloc(0),
        initialisationVector: randomBytes(12),
      });

      expect(mockCipher.getAuthTag).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockAuthTag);
    });

    test("should call cipher.getAuthTag() for A256GCM", () => {
      const mockAuthTag = randomBytes(16);
      const mockCipher = {
        getAuthTag: jest.fn().mockReturnValue(mockAuthTag),
      } as unknown as CipherGCM;

      const result = createAuthTag({
        encryption: "A256GCM",
        cipher: mockCipher,
        content: randomBytes(64),
        hashKey: Buffer.alloc(0),
        initialisationVector: randomBytes(12),
      });

      expect(mockCipher.getAuthTag).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockAuthTag);
    });
  });

  describe("CBC modes (HMAC)", () => {
    test("should produce HMAC tag for A128CBC-HS256", () => {
      const mockCipher = {} as CipherGCM; // Not used for CBC
      const content = randomBytes(64);
      const hashKey = randomBytes(16);
      const initialisationVector = randomBytes(16);

      const result = createAuthTag({
        encryption: "A128CBC-HS256",
        cipher: mockCipher,
        content,
        hashKey,
        initialisationVector,
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(16); // SHA256 / 2
    });

    test("should produce HMAC tag for A192CBC-HS384", () => {
      const mockCipher = {} as CipherGCM; // Not used for CBC
      const content = randomBytes(64);
      const hashKey = randomBytes(24);
      const initialisationVector = randomBytes(16);

      const result = createAuthTag({
        encryption: "A192CBC-HS384",
        cipher: mockCipher,
        content,
        hashKey,
        initialisationVector,
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(24); // SHA384 / 2
    });

    test("should produce HMAC tag for A256CBC-HS512", () => {
      const mockCipher = {} as CipherGCM; // Not used for CBC
      const content = randomBytes(64);
      const hashKey = randomBytes(32);
      const initialisationVector = randomBytes(16);

      const result = createAuthTag({
        encryption: "A256CBC-HS512",
        cipher: mockCipher,
        content,
        hashKey,
        initialisationVector,
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(32); // SHA512 / 2
    });

    test("should be deterministic for CBC modes", () => {
      const mockCipher = {} as CipherGCM;
      const content = randomBytes(64);
      const hashKey = randomBytes(32);
      const initialisationVector = randomBytes(16);

      const result1 = createAuthTag({
        encryption: "A256CBC-HS512",
        cipher: mockCipher,
        content,
        hashKey,
        initialisationVector,
      });

      const result2 = createAuthTag({
        encryption: "A256CBC-HS512",
        cipher: mockCipher,
        content,
        hashKey,
        initialisationVector,
      });

      expect(result1).toEqual(result2);
    });
  });

  describe("Error cases", () => {
    test("should throw AesError for unsupported encryption algorithm", () => {
      const mockCipher = {} as CipherGCM;

      expect(() =>
        createAuthTag({
          encryption: "UNSUPPORTED" as KryptosEncryption,
          cipher: mockCipher,
          content: randomBytes(64),
          hashKey: randomBytes(32),
          initialisationVector: randomBytes(16),
        }),
      ).toThrow(AesError);

      expect(() =>
        createAuthTag({
          encryption: "UNSUPPORTED" as KryptosEncryption,
          cipher: mockCipher,
          content: randomBytes(64),
          hashKey: randomBytes(32),
          initialisationVector: randomBytes(16),
        }),
      ).toThrow("Unexpected algorithm");
    });
  });
});

describe("assertAuthTag", () => {
  describe("Missing authTag", () => {
    test("should throw AesError when authTag is undefined", () => {
      const mockDecipher = {} as DecipherGCM;

      expect(() =>
        assertAuthTag({
          authTag: undefined,
          content: randomBytes(64),
          hashKey: randomBytes(32),
          decipher: mockDecipher,
          encryption: "A256CBC-HS512",
          initialisationVector: randomBytes(16),
        }),
      ).toThrow(AesError);

      expect(() =>
        assertAuthTag({
          authTag: undefined,
          content: randomBytes(64),
          hashKey: randomBytes(32),
          decipher: mockDecipher,
          encryption: "A256CBC-HS512",
          initialisationVector: randomBytes(16),
        }),
      ).toThrow("Auth tag is missing");
    });
  });

  describe("GCM modes", () => {
    test("should call decipher.setAuthTag() for A128GCM", () => {
      const authTag = randomBytes(16);
      const mockDecipher = {
        setAuthTag: jest.fn(),
      } as unknown as DecipherGCM;

      assertAuthTag({
        authTag,
        content: randomBytes(64),
        hashKey: Buffer.alloc(0),
        decipher: mockDecipher,
        encryption: "A128GCM",
        initialisationVector: randomBytes(12),
      });

      expect(mockDecipher.setAuthTag).toHaveBeenCalledTimes(1);
      expect(mockDecipher.setAuthTag).toHaveBeenCalledWith(authTag);
    });

    test("should call decipher.setAuthTag() for A192GCM", () => {
      const authTag = randomBytes(16);
      const mockDecipher = {
        setAuthTag: jest.fn(),
      } as unknown as DecipherGCM;

      assertAuthTag({
        authTag,
        content: randomBytes(64),
        hashKey: Buffer.alloc(0),
        decipher: mockDecipher,
        encryption: "A192GCM",
        initialisationVector: randomBytes(12),
      });

      expect(mockDecipher.setAuthTag).toHaveBeenCalledTimes(1);
      expect(mockDecipher.setAuthTag).toHaveBeenCalledWith(authTag);
    });

    test("should call decipher.setAuthTag() for A256GCM", () => {
      const authTag = randomBytes(16);
      const mockDecipher = {
        setAuthTag: jest.fn(),
      } as unknown as DecipherGCM;

      assertAuthTag({
        authTag,
        content: randomBytes(64),
        hashKey: Buffer.alloc(0),
        decipher: mockDecipher,
        encryption: "A256GCM",
        initialisationVector: randomBytes(12),
      });

      expect(mockDecipher.setAuthTag).toHaveBeenCalledTimes(1);
      expect(mockDecipher.setAuthTag).toHaveBeenCalledWith(authTag);
    });
  });

  describe("CBC modes (HMAC verification)", () => {
    test("should not throw for valid A128CBC-HS256 tag", () => {
      const mockDecipher = {} as DecipherGCM; // Not used for CBC
      const content = randomBytes(64);
      const hashKey = randomBytes(16);
      const initialisationVector = randomBytes(16);
      const mockCipher = {} as CipherGCM;

      // Create valid tag
      const authTag = createAuthTag({
        encryption: "A128CBC-HS256",
        cipher: mockCipher,
        content,
        hashKey,
        initialisationVector,
      });

      expect(() =>
        assertAuthTag({
          authTag,
          content,
          hashKey,
          decipher: mockDecipher,
          encryption: "A128CBC-HS256",
          initialisationVector,
        }),
      ).not.toThrow();
    });

    test("should not throw for valid A192CBC-HS384 tag", () => {
      const mockDecipher = {} as DecipherGCM;
      const content = randomBytes(64);
      const hashKey = randomBytes(24);
      const initialisationVector = randomBytes(16);
      const mockCipher = {} as CipherGCM;

      const authTag = createAuthTag({
        encryption: "A192CBC-HS384",
        cipher: mockCipher,
        content,
        hashKey,
        initialisationVector,
      });

      expect(() =>
        assertAuthTag({
          authTag,
          content,
          hashKey,
          decipher: mockDecipher,
          encryption: "A192CBC-HS384",
          initialisationVector,
        }),
      ).not.toThrow();
    });

    test("should not throw for valid A256CBC-HS512 tag", () => {
      const mockDecipher = {} as DecipherGCM;
      const content = randomBytes(64);
      const hashKey = randomBytes(32);
      const initialisationVector = randomBytes(16);
      const mockCipher = {} as CipherGCM;

      const authTag = createAuthTag({
        encryption: "A256CBC-HS512",
        cipher: mockCipher,
        content,
        hashKey,
        initialisationVector,
      });

      expect(() =>
        assertAuthTag({
          authTag,
          content,
          hashKey,
          decipher: mockDecipher,
          encryption: "A256CBC-HS512",
          initialisationVector,
        }),
      ).not.toThrow();
    });

    test("should throw AesError for tampered content in CBC mode", () => {
      const mockDecipher = {} as DecipherGCM;
      const content = randomBytes(64);
      const tamperedContent = randomBytes(64);
      const hashKey = randomBytes(32);
      const initialisationVector = randomBytes(16);
      const mockCipher = {} as CipherGCM;

      const authTag = createAuthTag({
        encryption: "A256CBC-HS512",
        cipher: mockCipher,
        content,
        hashKey,
        initialisationVector,
      });

      expect(() =>
        assertAuthTag({
          authTag,
          content: tamperedContent,
          hashKey,
          decipher: mockDecipher,
          encryption: "A256CBC-HS512",
          initialisationVector,
        }),
      ).toThrow(AesError);

      expect(() =>
        assertAuthTag({
          authTag,
          content: tamperedContent,
          hashKey,
          decipher: mockDecipher,
          encryption: "A256CBC-HS512",
          initialisationVector,
        }),
      ).toThrow("Auth tag verification failed");
    });
  });

  describe("Error cases", () => {
    test("should throw AesError for unsupported encryption algorithm", () => {
      const mockDecipher = {} as DecipherGCM;

      expect(() =>
        assertAuthTag({
          authTag: randomBytes(16),
          content: randomBytes(64),
          hashKey: randomBytes(32),
          decipher: mockDecipher,
          encryption: "UNSUPPORTED" as KryptosEncryption,
          initialisationVector: randomBytes(16),
        }),
      ).toThrow(AesError);

      expect(() =>
        assertAuthTag({
          authTag: randomBytes(16),
          content: randomBytes(64),
          hashKey: randomBytes(32),
          decipher: mockDecipher,
          encryption: "UNSUPPORTED" as KryptosEncryption,
          initialisationVector: randomBytes(16),
        }),
      ).toThrow("Unexpected algorithm");
    });
  });
});
