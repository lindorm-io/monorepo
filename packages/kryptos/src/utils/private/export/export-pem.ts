import { KryptosError } from "../../../errors";
import { KryptosPem } from "../../../types";
import { ExportOptions } from "../../../types/private/export-options";
import { exportEcToPem } from "../ec/export-pem";
import { isEcDer } from "../ec/is";
import { exportOctToPem } from "../oct/export-pem";
import { isOctDer } from "../oct/is";
import { exportOkpToPem } from "../okp/export-pem";
import { isOkpDer } from "../okp/is";
import { exportRsaToPem } from "../rsa/export-pem";
import { isRsaDer } from "../rsa/is";

export const exportToPem = (options: ExportOptions): KryptosPem => {
  switch (options.type) {
    case "EC":
      if (!isEcDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ...exportEcToPem(options),
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
        algorithm: options.algorithm,
        use: options.use,
        type: "RSA",
      };

    default:
      throw new KryptosError("Unsupported key type");
  }
};
