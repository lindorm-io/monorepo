import { KryptosError } from "../../../errors";
import { KryptosString } from "../../../types";
import { ExportOptions } from "../../../types/private";
import { exportEcToPem, isEcDer } from "../ec";
import { exportOctToPem, isOctDer } from "../oct";
import { exportOkpToPem, isOkpDer } from "../okp";
import { exportRsaToPem, isRsaDer } from "../rsa";

export const exportToPem = (options: ExportOptions): KryptosString => {
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
