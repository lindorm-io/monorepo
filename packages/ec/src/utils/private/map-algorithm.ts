import { IKryptosEc, Kryptos } from "@lindorm/kryptos";
import { ShaAlgorithm } from "@lindorm/types";
import { EcError } from "../../errors";

export const mapEcAlgorithm = (kryptos: IKryptosEc): ShaAlgorithm => {
  if (!Kryptos.isEc(kryptos)) {
    throw new EcError("Invalid kryptos type", { debug: { kryptos } });
  }

  if (kryptos.algorithm.endsWith("256")) return "SHA256";
  if (kryptos.algorithm.endsWith("384")) return "SHA384";
  if (kryptos.algorithm.endsWith("512")) return "SHA512";

  throw new EcError("Unsupported EC algorithm", { debug: { kryptos } });
};
