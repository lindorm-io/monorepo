import { KryptosError } from "../../errors/index.js";
import type {
  KryptosAlgorithm,
  KryptosOperation,
  KryptosUse,
} from "../../types/index.js";

// The capability of the KEY MATERIAL — see `Kryptos.operations` for why this is
// deliberately neither JOSE `key_ops` nor WebCrypto usages. Every row of the
// table is decidable from `hasPrivateKey` alone: a Kryptos always holds at least
// one half, an asymmetric private key embeds its public half, and an oct secret
// lives in the private half. So `hasPublicKey` is not an input — it would be a
// second, unread source of truth for the same fact.
type Options = {
  algorithm: KryptosAlgorithm;
  hasPrivateKey: boolean;
  use: KryptosUse;
};

const calculateEncryptionKeyOps = (options: Options): Array<KryptosOperation> => {
  switch (options.algorithm) {
    case "A128KW":
    case "A192KW":
    case "A256KW":
    case "A128GCMKW":
    case "A192GCMKW":
    case "A256GCMKW":
      return ["wrapKey", "unwrapKey"];

    case "ECDH-ES":
    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW":
    case "ECDH-ES+A128GCMKW":
    case "ECDH-ES+A192GCMKW":
    case "ECDH-ES+A256GCMKW":
      // Deliberately half-INDEPENDENT: the sender derives with the recipient's
      // public key and the recipient with its own private one, so deriveKey /
      // deriveBits cannot separate the directions. A caller that needs to know
      // which side it holds asks `hasPrivateKey`, not `operations`.
      return ["deriveKey", "deriveBits"];

    case "PBES2-HS256+A128KW":
    case "PBES2-HS384+A192KW":
    case "PBES2-HS512+A256KW":
      return ["deriveKey"];

    case "RSA-OAEP":
    case "RSA-OAEP-256":
    case "RSA-OAEP-384":
    case "RSA-OAEP-512":
      return options.hasPrivateKey
        ? ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
        : ["encrypt", "wrapKey"];

    case "dir":
      return ["encrypt", "decrypt"];

    default:
      throw new KryptosError(
        `Algorithm "${options.algorithm}" is not an encryption algorithm`,
        {
          code: "unsupported_algorithm",
          title: "Unsupported Algorithm",
          details: `The algorithm "${options.algorithm}" cannot be used with key use "enc"; its operations cannot be derived.`,
          data: { algorithm: options.algorithm, use: options.use },
        },
      );
  }
};

export const calculateKeyOps = (options: Options): Array<KryptosOperation> => {
  switch (options.use) {
    case "enc":
      return calculateEncryptionKeyOps(options);

    case "sig":
      // An asymmetric private key embeds its public half, and an oct secret both
      // signs and verifies — so anything holding the private half does both. A
      // public-only key can only verify.
      return options.hasPrivateKey ? ["sign", "verify"] : ["verify"];

    default:
      throw new KryptosError(`Unsupported key use: ${options.use as string}`, {
        code: "unsupported_key_use",
        title: "Unsupported Key Use",
        details: `The key use "${options.use as string}" is not supported; use "sig" or "enc".`,
        data: { use: options.use },
      });
  }
};
