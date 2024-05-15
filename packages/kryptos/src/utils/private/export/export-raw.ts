import { KryptosError } from "../../../errors";
import { KryptosRaw } from "../../../types";
import { _ExportOptions } from "../../../types/private/export-options";
import { _exportEcToRaw } from "../ec/export-raw";
import { _isEcDer } from "../ec/is";

export const _exportToRaw = (options: _ExportOptions): KryptosRaw => {
  switch (options.type) {
    case "EC":
      if (!_isEcDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ..._exportEcToRaw(options),
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

    case "oct":
    case "OKP":
    case "RSA":
      throw new KryptosError("Raw export not supported for this key type");

    default:
      throw new KryptosError("Invalid key type");
  }
};
