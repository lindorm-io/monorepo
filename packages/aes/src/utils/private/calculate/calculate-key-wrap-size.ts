import { KryptosAlgorithm } from "@lindorm/kryptos";
import { AesKeyLength } from "@lindorm/types";
import { AesError } from "../../../errors";

export const _calculateKeyWrapSize = (algorithm: KryptosAlgorithm): AesKeyLength => {
  switch (algorithm) {
    case "A128KW":
    case "ECDH-ES+A128KW":
    case "PBES2-HS256+A128KW":
      return 16;

    case "A192KW":
    case "ECDH-ES+A192KW":
    case "PBES2-HS384+A192KW":
      return 24;

    case "A256KW":
    case "ECDH-ES+A256KW":
    case "PBES2-HS512+A256KW":
      return 32;

    default:
      throw new AesError("Unsupported algorithm", { debug: { algorithm } });
  }
};
