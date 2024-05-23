import { ShaAlgorithm } from "@lindorm/types";
import { OctError } from "../../errors";

export const assertKeySize = (algorithm: ShaAlgorithm, privateKey: Buffer): void => {
  switch (algorithm) {
    case "SHA256":
      if (privateKey.length >= 16) return;
      throw new OctError("Invalid key size for SHA256");

    case "SHA384":
      if (privateKey.length >= 24) return;
      throw new OctError("Invalid key size for SHA384");

    case "SHA512":
      if (privateKey.length >= 32) return;
      throw new OctError("Invalid key size for SHA512");

    default:
      throw new OctError("Unsupported algorithm", { debug: { algorithm } });
  }
};
