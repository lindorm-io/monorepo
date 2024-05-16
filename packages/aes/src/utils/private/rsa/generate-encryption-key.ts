import { randomBytes } from "crypto";
import { AesEncryption } from "../../../types";
import { _calculateEncryptionKeyLength } from "../encryption-keys/calculate-encryption-key-length";

export const _generateEncryptionKey = (encryption: AesEncryption): Buffer =>
  randomBytes(_calculateEncryptionKeyLength(encryption));
