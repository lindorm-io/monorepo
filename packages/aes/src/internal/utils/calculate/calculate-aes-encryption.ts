import type { KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../../../errors/index.js";
import type { AesInternalEncryption } from "../../../types/index.js";

export const calculateAesEncryption = (
  encryption: KryptosEncryption,
): AesInternalEncryption => {
  if (!encryption) {
    throw new AesError("Encryption algorithm is required", {
      code: "encryption_required",
      title: "Encryption Required",
      details: "An encryption algorithm must be provided but was missing or empty.",
    });
  }

  switch (encryption) {
    case "A128CBC-HS256":
      return "aes-128-cbc";

    case "A192CBC-HS384":
      return "aes-192-cbc";

    case "A256CBC-HS512":
      return "aes-256-cbc";

    case "A128GCM":
      return "aes-128-gcm";

    case "A192GCM":
      return "aes-192-gcm";

    case "A256GCM":
      return "aes-256-gcm";

    default:
      throw new AesError("Unsupported encryption algorithm", {
        code: "unsupported_encryption",
        title: "Unsupported Encryption",
        details:
          "The encryption algorithm is not a supported AES content encryption (A128GCM, A192GCM, A256GCM, A128CBC-HS256, A192CBC-HS384, or A256CBC-HS512).",
        data: { encryption },
      });
  }
};
