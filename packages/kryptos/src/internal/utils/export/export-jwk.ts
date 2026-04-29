import { KryptosError } from "../../../errors/index.js";
import type { KryptosExportMode, KryptosJwk } from "../../../types/index.js";
import type { ExportOptions } from "../../types/export-options.js";
import { exportAkpToJwk } from "../akp/export-jwk.js";
import { isAkpDer } from "../akp/is.js";
import { exportEcToJwk } from "../ec/export-jwk.js";
import { isEcDer } from "../ec/is.js";
import { exportOctToJwk } from "../oct/export-jwk.js";
import { isOctDer } from "../oct/is.js";
import { exportOkpToJwk } from "../okp/export-jwk.js";
import { isOkpDer } from "../okp/is.js";
import { exportRsaToJwk } from "../rsa/export-jwk.js";
import { isRsaDer } from "../rsa/is.js";

type Options = ExportOptions & {
  mode: KryptosExportMode;
};

export const exportToJwk = (options: Options): KryptosJwk => {
  switch (options.type) {
    case "AKP":
      if (!isAkpDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ...exportAkpToJwk(options),
        kid: options.id,
        alg: options.algorithm,
        use: options.use,
        kty: "AKP",
      };

    case "EC":
      if (!isEcDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ...exportEcToJwk(options),
        kid: options.id,
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
        kid: options.id,
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
        kid: options.id,
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
        kid: options.id,
        alg: options.algorithm,
        use: options.use,
        kty: "RSA",
      };

    default:
      throw new KryptosError("Unsupported key type");
  }
};
