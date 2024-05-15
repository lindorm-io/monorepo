import { KryptosError } from "../../../errors";
import { KryptosPem } from "../../../types";
import { _ExportOptions } from "../../../types/private/export-options";
import { _exportEcToPem } from "../ec/export-pem";
import { _isEcDer } from "../ec/is";
import { _exportOctToPem } from "../oct/export-pem";
import { _isOctDer } from "../oct/is";
import { _exportOkpToPem } from "../okp/export-pem";
import { _isOkpDer } from "../okp/is";
import { _exportRsaToPem } from "../rsa/export-pem";
import { _isRsaDer } from "../rsa/is";

export const _exportToPem = (options: _ExportOptions): KryptosPem => {
  switch (options.type) {
    case "EC":
      if (!_isEcDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ..._exportEcToPem(options),
        algorithm: options.algorithm,
        use: options.use,
        type: "EC",
      };

    case "oct":
      if (!_isOctDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ..._exportOctToPem(options),
        algorithm: options.algorithm,
        use: options.use,
        type: "oct",
      };

    case "OKP":
      if (!_isOkpDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ..._exportOkpToPem(options),
        algorithm: options.algorithm,
        use: options.use,
        type: "OKP",
      };

    case "RSA":
      if (!_isRsaDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ..._exportRsaToPem(options),
        algorithm: options.algorithm,
        use: options.use,
        type: "RSA",
      };

    default:
      throw new KryptosError("Unsupported key type");
  }
};
