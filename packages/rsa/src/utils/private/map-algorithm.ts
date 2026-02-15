import { IKryptosRsa, RSA_SIG_ALGORITHMS, RsaSigAlgorithm } from "@lindorm/kryptos";
import { ShaAlgorithm } from "@lindorm/types";
import { RsaError } from "../../errors";

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
      debug: { algorithm: kryptos.algorithm },
    });
  }

  return RSA_SIG_ALGORITHM_MAP[kryptos.algorithm as RsaSigAlgorithm];
};
