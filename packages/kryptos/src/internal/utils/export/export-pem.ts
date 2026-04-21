import { KryptosError } from "../../../errors/index.js";
import type { KryptosString } from "../../../types/index.js";
import type { ExportOptions } from "../../types/export-options.js";
import { exportAkpToPem } from "../akp/export-pem.js";
import { isAkpDer } from "../akp/is.js";
import { exportEcToPem } from "../ec/export-pem.js";
import { isEcDer } from "../ec/is.js";
import { exportOctToPem } from "../oct/export-pem.js";
import { isOctDer } from "../oct/is.js";
import { exportOkpToPem } from "../okp/export-pem.js";
import { isOkpDer } from "../okp/is.js";
import { exportRsaToPem } from "../rsa/export-pem.js";
import { isRsaDer } from "../rsa/is.js";

export const exportToPem = (options: ExportOptions): KryptosString => {
  switch (options.type) {
    case "AKP":
      if (!isAkpDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ...exportAkpToPem(options),
        id: options.id,
        algorithm: options.algorithm,
        use: options.use,
        type: "AKP",
      };

    case "EC":
      if (!isEcDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ...exportEcToPem(options),
        id: options.id,
        algorithm: options.algorithm,
        use: options.use,
        type: "EC",
      };

    case "oct":
      if (!isOctDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ...exportOctToPem(options),
        id: options.id,
        algorithm: options.algorithm,
        use: options.use,
        type: "oct",
      };

    case "OKP":
      if (!isOkpDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ...exportOkpToPem(options),
        id: options.id,
        algorithm: options.algorithm,
        use: options.use,
        type: "OKP",
      };

    case "RSA":
      if (!isRsaDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ...exportRsaToPem(options),
        id: options.id,
        algorithm: options.algorithm,
        use: options.use,
        type: "RSA",
      };

    default:
      throw new KryptosError("Unsupported key type");
  }
};
