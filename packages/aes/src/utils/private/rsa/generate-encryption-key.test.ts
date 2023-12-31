import { AesError } from "../../../errors";
import { generateEncryptionKey } from "./generate-encryption-key";

describe("generateEncryptionKey", () => {
  test("should resolve for aes-128-cbc", () => {
    expect(generateEncryptionKey("aes-128-cbc")).toHaveLength(16);
  });

  test("should resolve for aes-192-cbc", () => {
    expect(generateEncryptionKey("aes-192-cbc")).toHaveLength(24);
  });

  test("should resolve for aes-256-cbc", () => {
    expect(generateEncryptionKey("aes-256-cbc")).toHaveLength(32);
  });

  test("should resolve for aes-128-gcm", () => {
    expect(generateEncryptionKey("aes-128-gcm")).toHaveLength(16);
  });

  test("should resolve for aes-192-gcm", () => {
    expect(generateEncryptionKey("aes-192-gcm")).toHaveLength(24);
  });

  test("should resolve for aes-256-gcm", () => {
    expect(generateEncryptionKey("aes-256-gcm")).toHaveLength(32);
  });

  test("should throw for invalid algorithm", () => {
    expect(() => generateEncryptionKey("invalid" as any)).toThrow(AesError);
  });
});
