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
        throw new KryptosError("Invalid options", {
          code: "invalid_der_export_options",
          title: "Invalid DER Export Options",
          details:
            "The provided AKP key options are not valid DER-encoded options and cannot be exported to PEM.",
          data: { type: "AKP" },
        });
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
        throw new KryptosError("Invalid options", {
          code: "invalid_der_export_options",
          title: "Invalid DER Export Options",
          details:
            "The provided EC key options are not valid DER-encoded options and cannot be exported to PEM.",
          data: { type: "EC" },
        });
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
        throw new KryptosError("Invalid options", {
          code: "invalid_der_export_options",
          title: "Invalid DER Export Options",
          details:
            "The provided oct key options are not valid DER-encoded options and cannot be exported to PEM.",
          data: { type: "oct" },
        });
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
        throw new KryptosError("Invalid options", {
          code: "invalid_der_export_options",
          title: "Invalid DER Export Options",
          details:
            "The provided OKP key options are not valid DER-encoded options and cannot be exported to PEM.",
          data: { type: "OKP" },
        });
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
        throw new KryptosError("Invalid options", {
          code: "invalid_der_export_options",
          title: "Invalid DER Export Options",
          details:
            "The provided RSA key options are not valid DER-encoded options and cannot be exported to PEM.",
          data: { type: "RSA" },
        });
      }
      return {
        ...exportRsaToPem(options),
        id: options.id,
        algorithm: options.algorithm,
        use: options.use,
        type: "RSA",
      };

    default:
      throw new KryptosError("Unsupported key type", {
        code: "unsupported_export_key_type",
        title: "Unsupported Export Key Type",
        details: `The key type "${options.type as string}" is not supported for PEM export.`,
        data: { type: options.type },
      });
  }
};
