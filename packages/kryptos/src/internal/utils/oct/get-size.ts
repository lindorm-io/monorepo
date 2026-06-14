import { KryptosError } from "../../../errors/index.js";
import type {
  KryptosAlgorithm,
  KryptosEncryption,
  OctSize,
} from "../../../types/index.js";

type Options = {
  algorithm: KryptosAlgorithm;
  encryption?: KryptosEncryption | null;
};

export const getOctSize = (options: Options): OctSize => {
  if (options.algorithm === "dir") {
    switch (options.encryption) {
      case "A128GCM":
        return 16;

      case "A192GCM":
        return 24;

      case "A256GCM":
        return 32;

      case "A128CBC-HS256":
        return 32;

      case "A192CBC-HS384":
        return 48;

      case "A256CBC-HS512":
        return 64;

      // AES-CCM is AEAD (single key, no enc+mac split), so the `dir` CEK size
      // is the key size directly: the trailing segment of the name (128 ⇒ 16,
      // 256 ⇒ 32). RFC 9053 §4.2.
      case "AES-CCM-16-64-128":
      case "AES-CCM-64-64-128":
      case "AES-CCM-16-128-128":
      case "AES-CCM-64-128-128":
        return 16;

      case "AES-CCM-16-64-256":
      case "AES-CCM-64-64-256":
      case "AES-CCM-16-128-256":
      case "AES-CCM-64-128-256":
        return 32;

      default:
        throw new KryptosError("Unsupported size", {
          code: "unsupported_encryption",
          title: "Unsupported Encryption",
          details: `The encryption '${options.encryption}' has no defined oct key size for the 'dir' algorithm.`,
          data: { encryption: options.encryption },
        });
    }
  }

  switch (options.algorithm) {
    case "A128KW":
    case "A128GCMKW":
    case "PBES2-HS256+A128KW":
      return 16;

    case "A192KW":
    case "A192GCMKW":
    case "PBES2-HS384+A192KW":
      return 24;

    case "A256KW":
    case "A256GCMKW":
    case "PBES2-HS512+A256KW":
      return 32;

    case "HS256":
      return 64;

    case "HS384":
      return 96;

    case "HS512":
      return 128;

    default:
      throw new KryptosError("Unsupported size", {
        code: "unsupported_algorithm",
        title: "Unsupported Algorithm",
        details: `The algorithm '${options.algorithm}' has no defined oct key size.`,
        data: { algorithm: options.algorithm },
      });
  }
};
