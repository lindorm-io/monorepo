import type { ShaAlgorithm } from "@lindorm/types";
import { OctError } from "../errors/index.js";

export const assertKeySize = (algorithm: ShaAlgorithm, privateKey: Buffer): void => {
  switch (algorithm) {
    case "SHA256":
      if (privateKey.length >= 16) return;
      throw new OctError("Invalid key size for SHA256", {
        code: "invalid_key_size",
        title: "Invalid Key Size",
        details: "The secret key for SHA256 must be at least 16 bytes long.",
        data: { algorithm, actual: privateKey.length, minimum: 16 },
      });

    case "SHA384":
      if (privateKey.length >= 24) return;
      throw new OctError("Invalid key size for SHA384", {
        code: "invalid_key_size",
        title: "Invalid Key Size",
        details: "The secret key for SHA384 must be at least 24 bytes long.",
        data: { algorithm, actual: privateKey.length, minimum: 24 },
      });

    case "SHA512":
      if (privateKey.length >= 32) return;
      throw new OctError("Invalid key size for SHA512", {
        code: "invalid_key_size",
        title: "Invalid Key Size",
        details: "The secret key for SHA512 must be at least 32 bytes long.",
        data: { algorithm, actual: privateKey.length, minimum: 32 },
      });

    default:
      throw new OctError("Unsupported algorithm", {
        code: "unsupported_algorithm",
        title: "Unsupported Algorithm",
        details:
          "The hash algorithm is not supported; expected one of SHA256, SHA384, or SHA512.",
        data: { algorithm },
      });
  }
};
