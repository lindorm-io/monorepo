import { AesAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { generateAesEncryptionKey } from "./generate-aes-encryption-key";

describe("generateAesEncryptionKey", () => {
  test("should resolve for aes-128-gcm", () => {
    expect(generateAesEncryptionKey(AesAlgorithm.AES_128_GCM)).toHaveLength(16);
  });

  test("should resolve for aes-192-gcm", () => {
    expect(generateAesEncryptionKey(AesAlgorithm.AES_192_GCM)).toHaveLength(24);
  });

  test("should resolve for aes-256-gcm", () => {
    expect(generateAesEncryptionKey(AesAlgorithm.AES_256_GCM)).toHaveLength(32);
  });

  test("should throw for invalid algorithm", () => {
    expect(() => generateAesEncryptionKey("invalid" as any)).toThrow(AesError);
  });
});
