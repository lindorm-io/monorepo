import { B64 } from "@lindorm/b64";
import { KryptosError } from "../../../errors";
import { KryptosB64 } from "../../../types";
import { ExportOptions } from "../../../types/private/export-options";
import { isEcDer } from "../ec/is";
import { isOctDer } from "../oct/is";
import { isOkpDer } from "../okp/is";
import { isRsaDer } from "../rsa/is";

export const exportToB64 = (options: ExportOptions): KryptosB64 => {
  switch (options.type) {
    case "EC":
      if (!isEcDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
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
