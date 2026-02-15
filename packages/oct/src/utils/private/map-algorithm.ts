import { IKryptosOct, OCT_SIG_ALGORITHMS, OctSigAlgorithm } from "@lindorm/kryptos";
import { ShaAlgorithm } from "@lindorm/types";
import { OctError } from "../../errors";

const OCT_SIG_ALGORITHM_MAP: Record<OctSigAlgorithm, ShaAlgorithm> = {
  HS256: "SHA256",
  HS384: "SHA384",
  HS512: "SHA512",
};

export const mapOctAlgorithm = (kryptos: IKryptosOct): ShaAlgorithm => {
  if (!OCT_SIG_ALGORITHMS.includes(kryptos.algorithm as OctSigAlgorithm)) {
    throw new OctError("Unsupported OCT algorithm for signing", {
      debug: { algorithm: kryptos.algorithm },
    });
  }

  return OCT_SIG_ALGORITHM_MAP[kryptos.algorithm as OctSigAlgorithm];
};
