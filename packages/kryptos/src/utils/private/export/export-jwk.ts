import { KryptosError } from "../../../errors";
import { KryptosExportMode, KryptosJwk } from "../../../types";
import { ExportOptions } from "../../../types/private/export-options";
import { exportEcToJwk } from "../ec/export-jwk";
import { isEcDer } from "../ec/is";
import { exportOctToJwk } from "../oct/export-jwk";
import { isOctDer } from "../oct/is";
import { exportOkpToJwk } from "../okp/export-jwk";
import { isOkpDer } from "../okp/is";
import { exportRsaToJwk } from "../rsa/export-jwk";
import { isRsaDer } from "../rsa/is";

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
