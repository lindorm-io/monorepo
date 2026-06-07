import type { ShaAlgorithm } from "@lindorm/types";
import { OctError } from "../errors/index.js";

export const assertKeySize = (algorithm: ShaAlgorithm, privateKey: Buffer): void => {
  switch (algorithm) {
    case "SHA256":
      if (privateKey.length >= 16) return;
      throw new OctError("Invalid key size for SHA256", {
        code: "invalid_key_size",
        data: { algorithm, actual: privateKey.length, minimum: 16 },
      });

    case "SHA384":
      if (privateKey.length >= 24) return;
      throw new OctError("Invalid key size for SHA384", {
        code: "invalid_key_size",
        data: { algorithm, actual: privateKey.length, minimum: 24 },
      });

    case "SHA512":
      if (privateKey.length >= 32) return;
      throw new OctError("Invalid key size for SHA512", {
        code: "invalid_key_size",
        data: { algorithm, actual: privateKey.length, minimum: 32 },
      });

    default:
      throw new OctError("Unsupported algorithm", {
        code: "unsupported_algorithm",
        data: { algorithm },
      });
  }
};
