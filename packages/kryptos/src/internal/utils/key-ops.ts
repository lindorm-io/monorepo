import { KryptosAlgorithm, KryptosOperation, KryptosUse } from "../../types";

type Options = {
  algorithm: KryptosAlgorithm;
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
      return ["deriveKey"];

    case "PBES2-HS256+A128KW":
    case "PBES2-HS384+A192KW":
    case "PBES2-HS512+A256KW":
      return ["deriveKey"];

    case "RSA-OAEP":
    case "RSA-OAEP-256":
    case "RSA-OAEP-384":
    case "RSA-OAEP-512":
      return ["wrapKey", "unwrapKey"];

    case "dir":
      return ["encrypt", "decrypt"];

    default:
      return [];
  }
};

export const calculateKeyOps = (options: Options): Array<KryptosOperation> => {
  switch (options.use) {
    case "enc":
      return calculateEncryptionKeyOps(options);

    case "sig":
      return ["sign", "verify"];

    default:
      return [];
  }
};
