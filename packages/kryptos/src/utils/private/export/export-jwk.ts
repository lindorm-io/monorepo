import { KryptosError } from "../../../errors";
import { KryptosExportMode, KryptosJwk } from "../../../types";
import { _ExportOptions } from "../../../types/private/export-options";
import { _exportEcToJwk } from "../ec/export-jwk";
import { _isEcDer } from "../ec/is";
import { _exportOctToJwk } from "../oct/export-jwk";
import { _isOctDer } from "../oct/is";
import { _exportOkpToJwk } from "../okp/export-jwk";
import { _isOkpDer } from "../okp/is";
import { _exportRsaToJwk } from "../rsa/export-jwk";
import { _isRsaDer } from "../rsa/is";

type Options = _ExportOptions & {
  mode: KryptosExportMode;
};

export const _exportToJwk = (options: Options): KryptosJwk => {
  switch (options.type) {
    case "EC":
      if (!_isEcDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ..._exportEcToJwk(options),
        alg: options.algorithm,
        use: options.use,
        kty: "EC",
      };

    case "oct":
      if (!_isOctDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ..._exportOctToJwk(options),
        alg: options.algorithm,
        use: options.use,
        kty: "oct",
      };

    case "OKP":
      if (!_isOkpDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ..._exportOkpToJwk(options),
        alg: options.algorithm,
        use: options.use,
        kty: "OKP",
      };

    case "RSA":
      if (!_isRsaDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        ..._exportRsaToJwk(options),
        alg: options.algorithm,
        use: options.use,
        kty: "RSA",
      };

    default:
      throw new KryptosError("Unsupported key type");
  }
};
