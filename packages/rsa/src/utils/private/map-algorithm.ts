import { Kryptos } from "@lindorm/kryptos";
import { ShaAlgorithm } from "@lindorm/types";
import { RsaError } from "../../errors";

export const _mapRsaAlgorithm = (kryptos: Kryptos): ShaAlgorithm => {
  if (!Kryptos.isRsa(kryptos)) {
    throw new RsaError("Invalid kryptos type", { debug: { kryptos } });
  }

  if (kryptos.algorithm.endsWith("256")) return "SHA256";
  if (kryptos.algorithm.endsWith("384")) return "SHA384";
  if (kryptos.algorithm.endsWith("512")) return "SHA512";

  throw new RsaError("Unsupported RSA algorithm", { debug: { kryptos } });
};
