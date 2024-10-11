import { KryptosError } from "../../../errors";
import { KryptosExportMode, KryptosJwk } from "../../../types";
import { ExportOptions } from "../../../types/private";
import { exportEcToJwk, isEcDer } from "../ec";
import { exportOctToJwk, isOctDer } from "../oct";
import { exportOkpToJwk, isOkpDer } from "../okp";
import { exportRsaToJwk, isRsaDer } from "../rsa";

type Options = ExportOptions & {
  mode: KryptosExportMode;
};

export const exportToJwk = (options: Options): KryptosJwk => {
  switch (options.type) {
    case "EC":
      if (!isEcDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ...exportEcToJwk(options),
        alg: options.algorithm,
        use: options.use,
        kty: "EC",
      };

    case "oct":
      if (!isOctDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ...exportOctToJwk(options),
        alg: options.algorithm,
        use: options.use,
        kty: "oct",
      };

    case "OKP":
      if (!isOkpDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ...exportOkpToJwk(options),
        alg: options.algorithm,
        use: options.use,
        kty: "OKP",
      };

    case "RSA":
      if (!isRsaDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ...exportRsaToJwk(options),
        alg: options.algorithm,
        use: options.use,
        kty: "RSA",
      };

    default:
      throw new KryptosError("Unsupported key type");
  }
};
