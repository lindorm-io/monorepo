import type { KryptosEncryption } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { AesError } from "../../../errors/index.js";

export const getInitialisationVector = (encryption: KryptosEncryption): Buffer => {
  switch (encryption) {
    case "A128CBC-HS256":
    case "A192CBC-HS384":
    case "A256CBC-HS512":
      return randomBytes(16);

    case "A128GCM":
    case "A192GCM":
    case "A256GCM":
      return randomBytes(12);

    default:
      throw new AesError("Unexpected algorithm", {
        code: "unsupported_encryption",
        title: "Unsupported Encryption",
        details:
          "The encryption algorithm is not a supported AES-CBC-HMAC or AES-GCM variant for generating an initialisation vector.",
        data: { encryption },
      });
  }
};
