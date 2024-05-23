import { IKryptosRsa } from "@lindorm/kryptos";
import { ShaAlgorithm } from "@lindorm/types";
import { RsaError } from "../../errors";

export const mapRsaAlgorithm = (kryptos: IKryptosRsa): ShaAlgorithm => {
  if (kryptos.algorithm.endsWith("256")) return "SHA256";
  if (kryptos.algorithm.endsWith("384")) return "SHA384";
  if (kryptos.algorithm.endsWith("512")) return "SHA512";

  throw new RsaError("Unsupported RSA algorithm", { debug: { kryptos } });
};
