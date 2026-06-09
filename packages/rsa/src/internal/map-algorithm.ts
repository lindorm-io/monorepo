import {
  type IKryptosRsa,
  RSA_SIG_ALGORITHMS,
  type RsaSigAlgorithm,
} from "@lindorm/kryptos";
import type { ShaAlgorithm } from "@lindorm/types";
import { RsaError } from "../errors/index.js";

const RSA_SIG_ALGORITHM_MAP: Record<RsaSigAlgorithm, ShaAlgorithm> = {
  RS256: "SHA256",
  RS384: "SHA384",
  RS512: "SHA512",
  PS256: "SHA256",
  PS384: "SHA384",
  PS512: "SHA512",
};

export const mapRsaAlgorithm = (kryptos: IKryptosRsa): ShaAlgorithm => {
  if (!RSA_SIG_ALGORITHMS.includes(kryptos.algorithm as RsaSigAlgorithm)) {
    throw new RsaError("Unsupported RSA algorithm for signing", {
      code: "unsupported_signing_algorithm",
      title: "Unsupported Signing Algorithm",
      details:
        "The RSA key algorithm cannot be mapped to a SHA hash for signing; expected one of RS256, RS384, RS512, PS256, PS384, or PS512.",
      data: { algorithm: kryptos.algorithm },
    });
  }

  return RSA_SIG_ALGORITHM_MAP[kryptos.algorithm as RsaSigAlgorithm];
};
