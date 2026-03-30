import { KryptosAlgorithm } from "@lindorm/kryptos";
import { AesKeyLength } from "@lindorm/types";
import { AesError } from "../../../errors";

export const calculateKeyWrapSize = (algorithm: KryptosAlgorithm): AesKeyLength => {
  switch (algorithm) {
    case "A128KW":
    case "A128GCMKW":
    case "ECDH-ES+A128KW":
    case "ECDH-ES+A128GCMKW":
    case "PBES2-HS256+A128KW":
      return 16;

    case "A192KW":
    case "A192GCMKW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A192GCMKW":
    case "PBES2-HS384+A192KW":
      return 24;

    case "A256KW":
    case "A256GCMKW":
    case "ECDH-ES+A256KW":
    case "ECDH-ES+A256GCMKW":
    case "PBES2-HS512+A256KW":
      return 32;

    default:
      throw new AesError("Unsupported algorithm", { debug: { algorithm } });
  }
};
