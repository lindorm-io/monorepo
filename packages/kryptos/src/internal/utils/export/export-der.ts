import { KryptosError } from "../../../errors/index.js";
import type { KryptosBuffer } from "../../../types/index.js";
import type { ExportOptions } from "../../types/export-options.js";
import { isAkpDer } from "../akp/is.js";
import { isEcDer } from "../ec/is.js";
import { isOctDer } from "../oct/is.js";
import { isOkpDer } from "../okp/is.js";
import { isRsaDer } from "../rsa/is.js";

export const exportToDer = (options: ExportOptions): KryptosBuffer => {
  switch (options.type) {
    case "AKP":
      if (!isAkpDer(options)) {
        throw new KryptosError("Invalid options", {
          code: "invalid_der_export_options",
          title: "Invalid DER Export Options",
          details:
            "The provided AKP key options are not valid DER-encoded options and cannot be exported to DER.",
          data: { type: "AKP" },
        });
      }
      return {
        id: options.id,
        algorithm: options.algorithm,
        privateKey: options.privateKey,
        publicKey: options.publicKey,
        type: options.type,
        use: options.use,
      };

    case "EC":
      if (!isEcDer(options)) {
        throw new KryptosError("Invalid options", {
          code: "invalid_der_export_options",
          title: "Invalid DER Export Options",
          details:
            "The provided EC key options are not valid DER-encoded options and cannot be exported to DER.",
          data: { type: "EC" },
        });
      }
      return {
        id: options.id,
        algorithm: options.algorithm,
        curve: options.curve,
        privateKey: options.privateKey,
        publicKey: options.publicKey,
        type: options.type,
        use: options.use,
      };

    case "oct":
      if (!isOctDer(options)) {
        throw new KryptosError("Invalid options", {
          code: "invalid_der_export_options",
          title: "Invalid DER Export Options",
          details:
            "The provided oct key options are not valid DER-encoded options and cannot be exported to DER.",
          data: { type: "oct" },
        });
      }
      return {
        id: options.id,
        algorithm: options.algorithm,
        privateKey: options.privateKey,
        publicKey: Buffer.alloc(0),
        type: options.type,
        use: options.use,
      };

    case "OKP":
      if (!isOkpDer(options)) {
        throw new KryptosError("Invalid options", {
          code: "invalid_der_export_options",
          title: "Invalid DER Export Options",
          details:
            "The provided OKP key options are not valid DER-encoded options and cannot be exported to DER.",
          data: { type: "OKP" },
        });
      }
      return {
        id: options.id,
        algorithm: options.algorithm,
        curve: options.curve,
        privateKey: options.privateKey,
        publicKey: options.publicKey,
        type: options.type,
        use: options.use,
      };

    case "RSA":
      if (!isRsaDer(options)) {
        throw new KryptosError("Invalid options", {
          code: "invalid_der_export_options",
          title: "Invalid DER Export Options",
          details:
            "The provided RSA key options are not valid DER-encoded options and cannot be exported to DER.",
          data: { type: "RSA" },
        });
      }
      return {
        id: options.id,
        algorithm: options.algorithm,
        privateKey: options.privateKey,
        publicKey: options.publicKey,
        type: options.type,
        use: options.use,
      };

    default:
      throw new KryptosError("Unsupported key type", {
        code: "unsupported_export_key_type",
        title: "Unsupported Export Key Type",
        details: `The key type "${options.type as string}" is not supported for DER export.`,
        data: { type: options.type },
      });
  }
};
