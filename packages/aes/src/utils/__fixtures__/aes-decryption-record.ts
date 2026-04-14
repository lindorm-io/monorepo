import type { AesDecryptionRecord } from "../../types";

export const createTestAesDecryptionRecord = (
  overrides: Partial<AesDecryptionRecord> = {},
): AesDecryptionRecord => ({
  algorithm: "dir",
  authTag: Buffer.from("tag"),
  content: Buffer.from("test"),
  contentType: "text/plain",
  encryption: "A256GCM",
  initialisationVector: Buffer.from("iv"),
  keyId: "test-key-id",
  pbkdfIterations: undefined,
  pbkdfSalt: undefined,
  publicEncryptionIv: undefined,
  publicEncryptionJwk: undefined,
  publicEncryptionKey: undefined,
  publicEncryptionTag: undefined,
  version: "1.0",
  ...overrides,
});
