import { IKryptos } from "@lindorm/kryptos";
import { ShaAlgorithm } from "@lindorm/types";
import { AesError } from "../../../errors";

export const _calculatePbkdfAlgorithm = (kryptos: IKryptos): ShaAlgorithm => {
  switch (kryptos.algorithm) {
    case "PBES2-HS256+A128KW":
      return "SHA256";

    case "PBES2-HS384+A192KW":
      return "SHA384";

    case "PBES2-HS512+A256KW":
      return "SHA512";

    default:
      throw new AesError("Unsupported PBKDF2 algorithm");
  }
};
