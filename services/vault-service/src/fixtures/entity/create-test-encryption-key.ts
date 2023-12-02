import { randomBytes, randomUUID } from "crypto";
import { EncryptionKey, EncryptionKeyOptions } from "../../entity";
import { cryptoAes } from "../../instance";

export const createTestEncryptionKey = (
  options: Partial<EncryptionKeyOptions> = {},
): EncryptionKey =>
  new EncryptionKey({
    owner: randomUUID(),
    ownerType: "client",
    key: cryptoAes.encrypt(randomBytes(16).toString("hex")),
    ...options,
  });
