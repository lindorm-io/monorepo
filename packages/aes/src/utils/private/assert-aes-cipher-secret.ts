import { AesAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { AesCipherAlgorithm } from "../../types";

export const assertAesCipherSecret = (secret: string, algorithm: AesCipherAlgorithm): void => {
  if (algorithm === AesAlgorithm.AES_128_GCM && secret.length !== 16) {
    throw new AesError("Invalid secret", {
      description: "Secret must be 16 characters long",
      debug: { secret, length: secret.length },
    });
  }

  if (algorithm === AesAlgorithm.AES_192_GCM && secret.length !== 24) {
    throw new AesError("Invalid secret", {
      description: "Secret must be 24 characters long",
      debug: { secret, length: secret.length },
    });
  }

  if (algorithm === AesAlgorithm.AES_256_GCM && secret.length !== 32) {
    throw new AesError("Invalid secret", {
      description: "Secret must be 32 characters long",
      debug: { secret, length: secret.length },
    });
  }
};
