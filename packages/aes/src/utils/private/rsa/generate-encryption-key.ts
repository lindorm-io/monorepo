import { randomBytes } from "crypto";
import { Encryption } from "../../../types";
import { _calculateSecretLength } from "../secret/calculate-secret-length";

export const _generateEncryptionKey = (encryption: Encryption): Buffer =>
  randomBytes(_calculateSecretLength(encryption));
