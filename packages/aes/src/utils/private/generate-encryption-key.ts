import { randomBytes } from "crypto";
import { AesAlgorithm } from "../../enums";
import { calculateSecretLength } from "./secret/calculate-secret-length";

export const generateEncryptionKey = (algorithm: AesAlgorithm): Buffer => {
  const secretLength = calculateSecretLength(algorithm);

  return randomBytes(secretLength);
};
