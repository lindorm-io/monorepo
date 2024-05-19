import { OctAlgorithm } from "@lindorm/kryptos";
import { AesError } from "../../../errors";

type KeyDerivation = "hkdf" | "pbkdf2";

export const _calculateOctKeyDerivation = (
  algorithm: OctAlgorithm,
  privateKey: Buffer,
): KeyDerivation => {
  switch (algorithm) {
    case "A128KW":
      if (privateKey.length >= 16) return "hkdf";
      return "pbkdf2";

    case "A192KW":
      if (privateKey.length >= 24) return "hkdf";
      return "pbkdf2";

    case "A256KW":
      if (privateKey.length >= 32) return "hkdf";
      return "pbkdf2";

    case "dir":
      if (privateKey.length >= 32) return "hkdf";
      return "pbkdf2";

    default:
      throw new AesError("Unsupported algorithm", { debug: { algorithm } });
  }
};
