import { EC_SIG_ALGORITHMS, EcSigAlgorithm, IKryptosEc } from "@lindorm/kryptos";
import { ShaAlgorithm } from "@lindorm/types";
import { EcError } from "../../errors";

const EC_SIG_ALGORITHM_MAP: Record<EcSigAlgorithm, ShaAlgorithm> = {
  ES256: "SHA256",
  ES384: "SHA384",
  ES512: "SHA512",
};

export const mapEcAlgorithm = (kryptos: IKryptosEc): ShaAlgorithm => {
  if (!EC_SIG_ALGORITHMS.includes(kryptos.algorithm as EcSigAlgorithm)) {
    throw new EcError("Unsupported EC algorithm for signing", {
      debug: { algorithm: kryptos.algorithm },
    });
  }

  return EC_SIG_ALGORITHM_MAP[kryptos.algorithm as EcSigAlgorithm];
};
