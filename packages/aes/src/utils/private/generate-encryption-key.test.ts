import { AesAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { generateEncryptionKey } from "./generate-encryption-key";

describe("generateEncryptionKey", () => {
  test("should resolve for aes-128-cbc", () => {
    expect(generateEncryptionKey(AesAlgorithm.AES_128_CBC)).toHaveLength(16);
  });

  test("should resolve for aes-192-cbc", () => {
    expect(generateEncryptionKey(AesAlgorithm.AES_192_CBC)).toHaveLength(24);
  });

  test("should resolve for aes-256-cbc", () => {
    expect(generateEncryptionKey(AesAlgorithm.AES_256_CBC)).toHaveLength(32);
  });

  test("should resolve for aes-128-gcm", () => {
    expect(generateEncryptionKey(AesAlgorithm.AES_128_GCM)).toHaveLength(16);
  });

  test("should resolve for aes-192-gcm", () => {
    expect(generateEncryptionKey(AesAlgorithm.AES_192_GCM)).toHaveLength(24);
  });

  test("should resolve for aes-256-gcm", () => {
    expect(generateEncryptionKey(AesAlgorithm.AES_256_GCM)).toHaveLength(32);
  });

  test("should throw for invalid algorithm", () => {
    expect(() => generateEncryptionKey("invalid" as any)).toThrow(AesError);
  });
});
