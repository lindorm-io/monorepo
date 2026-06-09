import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { ShaAlgorithm } from "@lindorm/types";
import { AesError } from "../../../errors/index.js";

export const calculateRsaOaepHash = (algorithm: KryptosAlgorithm): ShaAlgorithm => {
  switch (algorithm) {
    case "RSA-OAEP":
      return "SHA1";

    case "RSA-OAEP-256":
      return "SHA256";

    case "RSA-OAEP-384":
      return "SHA384";

    case "RSA-OAEP-512":
      return "SHA512";

    default:
      throw new AesError("Unexpected encryption key algorithm", {
        code: "unexpected_key_algorithm",
        title: "Unexpected Key Algorithm",
        details:
          "The key algorithm is not a supported RSA-OAEP variant (RSA-OAEP, RSA-OAEP-256, RSA-OAEP-384, or RSA-OAEP-512).",
        data: { algorithm },
      });
  }
};
