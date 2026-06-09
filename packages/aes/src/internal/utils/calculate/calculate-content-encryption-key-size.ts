import type { KryptosEncryption } from "@lindorm/kryptos";
import type { AesKeyLength } from "@lindorm/types";
import { AesError } from "../../../errors/index.js";

export const calculateContentEncryptionKeySize = (
  encryption: KryptosEncryption,
): AesKeyLength => {
  if (!encryption) {
    throw new AesError("Encryption algorithm is required", {
      code: "encryption_required",
      title: "Encryption Required",
      details: "An encryption algorithm must be provided but was missing or empty.",
    });
  }

  switch (encryption) {
    case "A128GCM":
      return 16;

    case "A192GCM":
      return 24;

    case "A256GCM":
      return 32;

    case "A128CBC-HS256":
      return 32;

    case "A192CBC-HS384":
      return 48;

    case "A256CBC-HS512":
      return 64;

    default:
      throw new AesError("Unsupported encryption", {
        code: "unsupported_encryption",
        title: "Unsupported Encryption",
        details:
          "The encryption algorithm is not a supported AES content encryption (A128GCM, A192GCM, A256GCM, A128CBC-HS256, A192CBC-HS384, or A256CBC-HS512).",
        data: { encryption },
      });
  }
};
