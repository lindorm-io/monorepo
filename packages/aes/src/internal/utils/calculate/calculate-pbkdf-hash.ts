import type { IKryptos } from "@lindorm/kryptos";
import type { ShaAlgorithm } from "@lindorm/types";
import { AesError } from "../../../errors/index.js";

export const calculatePbkdfAlgorithm = (kryptos: IKryptos): ShaAlgorithm => {
  switch (kryptos.algorithm) {
    case "PBES2-HS256+A128KW":
      return "SHA256";

    case "PBES2-HS384+A192KW":
      return "SHA384";

    case "PBES2-HS512+A256KW":
      return "SHA512";

    default:
      throw new AesError("Unsupported PBKDF2 algorithm", {
        code: "unsupported_pbkdf2_algorithm",
        title: "Unsupported PBKDF2 Algorithm",
        details:
          "The Kryptos algorithm is not a supported PBES2 PBKDF2 algorithm (PBES2-HS256+A128KW, PBES2-HS384+A192KW, or PBES2-HS512+A256KW).",
        data: { algorithm: kryptos.algorithm },
      });
  }
};
