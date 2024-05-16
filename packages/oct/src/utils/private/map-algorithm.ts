import { IKryptosOct, Kryptos } from "@lindorm/kryptos";
import { ShaAlgorithm } from "@lindorm/types";
import { OctError } from "../../errors";

export const _mapOctAlgorithm = (kryptos: IKryptosOct): ShaAlgorithm => {
  if (!Kryptos.isOct(kryptos)) {
    throw new OctError("Invalid kryptos type", { debug: { kryptos } });
  }

  if (kryptos.algorithm.endsWith("256")) return "SHA256";
  if (kryptos.algorithm.endsWith("384")) return "SHA384";
  if (kryptos.algorithm.endsWith("512")) return "SHA512";

  throw new OctError("Unsupported OCT algorithm", { debug: { kryptos } });
};
