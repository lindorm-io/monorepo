import { randomBytes } from "crypto";
import { Encryption } from "../../../types";
import { calculateSecretLength } from "../secret/calculate-secret-length";

export const generateEncryptionKey = (encryption: Encryption): Buffer =>
  randomBytes(calculateSecretLength(encryption));
