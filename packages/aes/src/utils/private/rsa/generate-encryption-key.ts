import { randomBytes } from "crypto";
import { AesEncryption } from "../../../types";
import { _calculateSecretLength } from "../secret/calculate-secret-length";

export const _generateEncryptionKey = (encryption: AesEncryption): Buffer =>
  randomBytes(_calculateSecretLength(encryption));
