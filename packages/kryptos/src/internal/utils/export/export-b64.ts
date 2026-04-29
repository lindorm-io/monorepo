import { B64 } from "@lindorm/b64";
import { KryptosError } from "../../../errors/index.js";
import type { KryptosString } from "../../../types/index.js";
import type { ExportOptions } from "../../types/export-options.js";
import { isAkpDer } from "../akp/is.js";
import { isEcDer } from "../ec/is.js";
import { isOctDer } from "../oct/is.js";
import { isOkpDer } from "../okp/is.js";
import { isRsaDer } from "../rsa/is.js";

export const exportToB64 = (options: ExportOptions): KryptosString => {
  switch (options.type) {
    case "AKP":
      if (!isAkpDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        id: options.id,
        algorithm: options.algorithm,
        privateKey: options.privateKey
          ? B64.encode(options.privateKey, "base64url")
          : undefined,
        publicKey: B64.encode(options.publicKey, "base64url"),
        type: options.type,
        use: options.use,
      };

    case "EC":
      if (!isEcDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        id: options.id,
        algorithm: options.algorithm,
        curve: options.curve,
        privateKey: options.privateKey
          ? B64.encode(options.privateKey, "base64url")
          : undefined,
        publicKey: B64.encode(options.publicKey, "base64url"),
        type: options.type,
        use: options.use,
      };

    case "oct":
      if (!isOctDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        id: options.id,
        algorithm: options.algorithm,
        privateKey: B64.encode(options.privateKey, "base64url"),
        publicKey: "",
        type: options.type,
        use: options.use,
      };

    case "OKP":
      if (!isOkpDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        id: options.id,
        algorithm: options.algorithm,
        curve: options.curve,
        privateKey: options.privateKey
          ? B64.encode(options.privateKey, "base64url")
          : undefined,
        publicKey: B64.encode(options.publicKey, "base64url"),
        type: options.type,
        use: options.use,
      };

    case "RSA":
      if (!isRsaDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        id: options.id,
        algorithm: options.algorithm,
        privateKey: options.privateKey
          ? B64.encode(options.privateKey, "base64url")
          : undefined,
        publicKey: B64.encode(options.publicKey, "base64url"),
        type: options.type,
        use: options.use,
      };

    default:
      throw new KryptosError("Unsupported key type");
  }
};
